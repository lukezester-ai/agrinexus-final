-- Qualification / Introduction v1 — domain process around frozen Matching Engine v1.
-- Engine still writes only candidate. This layer owns:
--   candidate → qualified → (request) → introduced
-- Identities for confidential matches are revealed only after introduction is accepted.
-- Converted remains reserved; app_user cannot set introduced/converted directly.

DO $$ BEGIN
    CREATE TYPE public.business_match_introduction_status AS ENUM (
        'requested',
        'accepted',
        'declined'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.business_match_event_kind AS ENUM (
        'match_created',
        'lifecycle_changed',
        'introduction_requested',
        'introduction_accepted',
        'introduction_declined'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.business_match_introductions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid NOT NULL UNIQUE REFERENCES public.business_matches(id) ON DELETE CASCADE,
    status public.business_match_introduction_status NOT NULL DEFAULT 'requested',
    requested_by_org_id uuid NOT NULL REFERENCES public.organizations(id),
    requested_by_user_id uuid NOT NULL,
    request_note text NOT NULL DEFAULT '',
    responded_by_org_id uuid REFERENCES public.organizations(id),
    responded_by_user_id uuid,
    response_note text NOT NULL DEFAULT '',
    requested_at timestamptz NOT NULL DEFAULT now(),
    responded_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.business_match_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid NOT NULL REFERENCES public.business_matches(id) ON DELETE CASCADE,
    kind public.business_match_event_kind NOT NULL,
    actor_user_id uuid,
    actor_organization_id uuid,
    from_lifecycle public.business_match_lifecycle,
    to_lifecycle public.business_match_lifecycle,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT business_match_events_payload_has_no_payload_copy
        CHECK (
            NOT (payload ? 'headline')
            AND NOT (payload ? 'private_brief')
            AND NOT (payload ? 'title')
            AND NOT (payload ? 'summary')
        )
);

CREATE INDEX IF NOT EXISTS idx_business_match_events_match
    ON public.business_match_events(match_id, created_at);

CREATE OR REPLACE FUNCTION public.tg_business_match_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'INSERT' AND current_user = 'app_user' THEN
        RAISE EXCEPTION 'matches are matching-engine owned';
    END IF;
    IF TG_OP = 'UPDATE' THEN
        IF NEW.intent_id IS DISTINCT FROM OLD.intent_id
           OR NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id
           OR NEW.matcher_engine IS DISTINCT FROM OLD.matcher_engine
           OR NEW.matcher_version IS DISTINCT FROM OLD.matcher_version THEN
            RAISE EXCEPTION 'match identity and matcher provenance origin are immutable';
        END IF;
        IF current_user = 'app_user' THEN
            IF NEW.score IS DISTINCT FROM OLD.score
               OR NEW.confidence IS DISTINCT FROM OLD.confidence
               OR NEW.reasons IS DISTINCT FROM OLD.reasons
               OR NEW.explanation IS DISTINCT FROM OLD.explanation
               OR NEW.provenance IS DISTINCT FROM OLD.provenance THEN
                RAISE EXCEPTION 'scoring fields are matching-engine owned';
            END IF;
            IF OLD.lifecycle IN ('dismissed', 'introduced', 'converted') THEN
                RAISE EXCEPTION 'match lifecycle is domain-locked';
            END IF;
            IF NEW.lifecycle NOT IN ('candidate', 'qualified', 'dismissed') THEN
                RAISE EXCEPTION 'app_user cannot set introduced or converted';
            END IF;
            IF OLD.lifecycle = 'qualified' AND NEW.lifecycle = 'candidate' THEN
                RAISE EXCEPTION 'qualified matches cannot return to candidate';
            END IF;
        END IF;
        NEW.updated_at = pg_catalog.now();
    END IF;
    IF TG_OP = 'INSERT' THEN
        NEW.updated_at = pg_catalog.now();
        IF NEW.provenance = '{}'::jsonb THEN
            NEW.provenance = pg_catalog.jsonb_build_object(
                'recorded_at', pg_catalog.now(),
                'matcher_engine', NEW.matcher_engine,
                'matcher_version', NEW.matcher_version
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS business_matches_update_lifecycle ON public.business_matches;
CREATE POLICY business_matches_update_lifecycle ON public.business_matches
FOR UPDATE TO app_user
USING (
    lifecycle IN ('candidate', 'qualified')
    AND EXISTS (
        SELECT 1
        FROM public.business_intents i
        WHERE i.id = intent_id
          AND public.can_write_organization(i.organization_id)
    )
)
WITH CHECK (
    lifecycle IN ('candidate', 'qualified', 'dismissed')
    AND EXISTS (
        SELECT 1
        FROM public.business_intents i
        WHERE i.id = intent_id
          AND public.can_write_organization(i.organization_id)
    )
);

CREATE OR REPLACE FUNCTION public.tg_business_match_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.business_match_events (match_id, kind, to_lifecycle, payload)
        VALUES (
            NEW.id,
            'match_created',
            NEW.lifecycle,
            pg_catalog.jsonb_build_object('matcher_engine', NEW.matcher_engine, 'matcher_version', NEW.matcher_version)
        );
        RETURN NEW;
    END IF;
    IF NEW.lifecycle IS DISTINCT FROM OLD.lifecycle THEN
        INSERT INTO public.business_match_events (
            match_id, kind, actor_user_id, from_lifecycle, to_lifecycle, payload
        ) VALUES (
            NEW.id,
            'lifecycle_changed',
            auth.uid(),
            OLD.lifecycle,
            NEW.lifecycle,
            '{}'::jsonb
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_match_audit ON public.business_matches;
CREATE TRIGGER trg_business_match_audit
    AFTER INSERT OR UPDATE ON public.business_matches
    FOR EACH ROW
    EXECUTE PROCEDURE public.tg_business_match_audit();

CREATE OR REPLACE FUNCTION public.tg_business_match_introduction_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    event_kind public.business_match_event_kind;
BEGIN
    NEW.updated_at := pg_catalog.now();
    IF TG_OP = 'INSERT' THEN
        event_kind := 'introduction_requested';
        INSERT INTO public.business_match_events (
            match_id, kind, actor_user_id, actor_organization_id, payload
        ) VALUES (
            NEW.match_id,
            event_kind,
            NEW.requested_by_user_id,
            NEW.requested_by_org_id,
            pg_catalog.jsonb_build_object('status', NEW.status::text)
        );
        RETURN NEW;
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        event_kind := CASE NEW.status
            WHEN 'accepted' THEN 'introduction_accepted'::public.business_match_event_kind
            WHEN 'declined' THEN 'introduction_declined'::public.business_match_event_kind
            ELSE 'introduction_requested'::public.business_match_event_kind
        END;
        INSERT INTO public.business_match_events (
            match_id, kind, actor_user_id, actor_organization_id, payload
        ) VALUES (
            NEW.match_id,
            event_kind,
            NEW.responded_by_user_id,
            NEW.responded_by_org_id,
            pg_catalog.jsonb_build_object('status', NEW.status::text)
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_match_introduction_audit ON public.business_match_introductions;
CREATE TRIGGER trg_business_match_introduction_audit
    BEFORE INSERT OR UPDATE ON public.business_match_introductions
    FOR EACH ROW
    EXECUTE PROCEDURE public.tg_business_match_introduction_audit();

CREATE OR REPLACE FUNCTION public.qualify_business_match(p_match_id uuid)
RETURNS public.business_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    intent_org uuid;
    rec public.business_matches;
BEGIN
    SELECT i.organization_id
    INTO intent_org
    FROM public.business_matches m
    JOIN public.business_intents i ON i.id = m.intent_id
    WHERE m.id = p_match_id;
    IF intent_org IS NULL THEN
        RAISE EXCEPTION 'match not found';
    END IF;
    IF NOT public.can_write_organization(intent_org) THEN
        RAISE EXCEPTION 'only intent-organization writers can qualify a match';
    END IF;
    UPDATE public.business_matches
    SET lifecycle = 'qualified'
    WHERE id = p_match_id
      AND lifecycle = 'candidate'
    RETURNING * INTO rec;
    IF rec.id IS NULL THEN
        RAISE EXCEPTION 'only candidate matches can be qualified';
    END IF;
    RETURN rec;
END;
$$;

CREATE OR REPLACE FUNCTION public.dismiss_business_match(p_match_id uuid)
RETURNS public.business_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    intent_org uuid;
    rec public.business_matches;
BEGIN
    SELECT i.organization_id
    INTO intent_org
    FROM public.business_matches m
    JOIN public.business_intents i ON i.id = m.intent_id
    WHERE m.id = p_match_id;
    IF intent_org IS NULL THEN
        RAISE EXCEPTION 'match not found';
    END IF;
    IF NOT public.can_write_organization(intent_org) THEN
        RAISE EXCEPTION 'only intent-organization writers can dismiss a match';
    END IF;
    UPDATE public.business_matches
    SET lifecycle = 'dismissed'
    WHERE id = p_match_id
      AND lifecycle IN ('candidate', 'qualified')
    RETURNING * INTO rec;
    IF rec.id IS NULL THEN
        RAISE EXCEPTION 'match lifecycle is domain-locked';
    END IF;
    RETURN rec;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_business_match_introduction(p_match_id uuid, p_note text DEFAULT '')
RETURNS public.business_match_introductions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    intent_org uuid;
    match_lifecycle public.business_match_lifecycle;
    rec public.business_match_introductions;
    existing public.business_match_introduction_status;
BEGIN
    SELECT i.organization_id, m.lifecycle
    INTO intent_org, match_lifecycle
    FROM public.business_matches m
    JOIN public.business_intents i ON i.id = m.intent_id
    WHERE m.id = p_match_id;
    IF intent_org IS NULL THEN
        RAISE EXCEPTION 'match not found';
    END IF;
    IF NOT public.can_write_organization(intent_org) THEN
        RAISE EXCEPTION 'only intent-organization writers can request introduction';
    END IF;
    IF match_lifecycle <> 'qualified' THEN
        RAISE EXCEPTION 'introduction requires a qualified match';
    END IF;

    INSERT INTO public.business_match_introductions (
        match_id, status, requested_by_org_id, requested_by_user_id, request_note
    ) VALUES (
        p_match_id, 'requested', intent_org, auth.uid(), COALESCE(p_note, '')
    )
    ON CONFLICT (match_id) DO UPDATE SET
        status = 'requested',
        requested_by_org_id = EXCLUDED.requested_by_org_id,
        requested_by_user_id = EXCLUDED.requested_by_user_id,
        request_note = EXCLUDED.request_note,
        requested_at = pg_catalog.now(),
        responded_by_org_id = NULL,
        responded_by_user_id = NULL,
        response_note = '',
        responded_at = NULL
    WHERE public.business_match_introductions.status = 'declined'
    RETURNING * INTO rec;

    IF rec.id IS NULL THEN
        SELECT status INTO existing
        FROM public.business_match_introductions
        WHERE match_id = p_match_id;
        IF existing = 'requested' THEN
            RAISE EXCEPTION 'introduction already requested';
        END IF;
        IF existing = 'accepted' THEN
            RAISE EXCEPTION 'introduction already accepted';
        END IF;
        RAISE EXCEPTION 'introduction request failed';
    END IF;
    RETURN rec;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_business_match_introduction(
    p_match_id uuid,
    p_accept boolean,
    p_note text DEFAULT ''
)
RETURNS public.business_match_introductions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    opp_org uuid;
    match_lifecycle public.business_match_lifecycle;
    rec public.business_match_introductions;
    new_status public.business_match_introduction_status;
BEGIN
    SELECT o.organization_id, m.lifecycle
    INTO opp_org, match_lifecycle
    FROM public.business_matches m
    JOIN public.business_opportunities o ON o.id = m.opportunity_id
    WHERE m.id = p_match_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'match not found';
    END IF;
    IF opp_org IS NULL THEN
        RAISE EXCEPTION 'external opportunities cannot accept in-app introductions';
    END IF;
    IF NOT public.can_write_organization(opp_org) THEN
        RAISE EXCEPTION 'only opportunity-organization writers can respond to introduction';
    END IF;
    IF match_lifecycle <> 'qualified' THEN
        RAISE EXCEPTION 'introduction can only be answered on a qualified match';
    END IF;

    new_status := CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END;

    UPDATE public.business_match_introductions
    SET
        status = new_status,
        responded_by_org_id = opp_org,
        responded_by_user_id = auth.uid(),
        response_note = COALESCE(p_note, ''),
        responded_at = pg_catalog.now()
    WHERE match_id = p_match_id
      AND status = 'requested'
    RETURNING * INTO rec;
    IF rec.id IS NULL THEN
        RAISE EXCEPTION 'no pending introduction request';
    END IF;

    IF p_accept THEN
        UPDATE public.business_matches
        SET lifecycle = 'introduced'
        WHERE id = p_match_id
          AND lifecycle = 'qualified';
    END IF;
    RETURN rec;
END;
$$;

CREATE OR REPLACE FUNCTION public.reveal_match_parties(p_match_id uuid)
RETURNS TABLE (
    side text,
    organization_id uuid,
    organization_name text,
    opportunity_origin text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    intent_org uuid;
    opp_org uuid;
    opp_origin text;
    match_lifecycle public.business_match_lifecycle;
    is_party boolean;
BEGIN
    SELECT i.organization_id, o.organization_id, o.external_origin, m.lifecycle
    INTO intent_org, opp_org, opp_origin, match_lifecycle
    FROM public.business_matches m
    JOIN public.business_intents i ON i.id = m.intent_id
    JOIN public.business_opportunities o ON o.id = m.opportunity_id
    WHERE m.id = p_match_id;
    IF intent_org IS NULL THEN
        RETURN;
    END IF;

    is_party := public.is_organization_member(intent_org)
        OR (opp_org IS NOT NULL AND public.is_organization_member(opp_org));
    IF NOT is_party THEN
        RETURN;
    END IF;
    IF match_lifecycle NOT IN ('introduced', 'converted') THEN
        RETURN;
    END IF;

    side := 'intent';
    organization_id := intent_org;
    organization_name := (SELECT name FROM public.organizations WHERE id = intent_org);
    opportunity_origin := NULL;
    RETURN NEXT;

    side := 'opportunity';
    organization_id := opp_org;
    organization_name := CASE
        WHEN opp_org IS NULL THEN NULL
        ELSE (SELECT name FROM public.organizations WHERE id = opp_org)
    END;
    opportunity_origin := opp_origin;
    RETURN NEXT;
END;
$$;

ALTER TABLE public.business_match_introductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_match_introductions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.business_match_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_match_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_match_introductions_select ON public.business_match_introductions;
CREATE POLICY business_match_introductions_select ON public.business_match_introductions
FOR SELECT TO app_user
USING (
    EXISTS (
        SELECT 1
        FROM public.business_matches m
        JOIN public.business_intents i ON i.id = m.intent_id
        WHERE m.id = match_id
          AND public.is_organization_member(i.organization_id)
    )
    OR (
        status = 'accepted'
        AND EXISTS (
            SELECT 1
            FROM public.business_matches m
            JOIN public.business_opportunities o ON o.id = m.opportunity_id
            WHERE m.id = match_id
              AND o.organization_id IS NOT NULL
              AND public.is_organization_member(o.organization_id)
        )
    )
    OR (
        EXISTS (
            SELECT 1
            FROM public.business_matches m
            JOIN public.business_intents i ON i.id = m.intent_id
            JOIN public.business_opportunities o ON o.id = m.opportunity_id
            WHERE m.id = match_id
              AND i.visibility IN ('network', 'public')
              AND o.organization_id IS NOT NULL
              AND public.is_organization_member(o.organization_id)
        )
    )
);

DROP POLICY IF EXISTS business_match_events_select ON public.business_match_events;
CREATE POLICY business_match_events_select ON public.business_match_events
FOR SELECT TO app_user
USING (
    EXISTS (
        SELECT 1
        FROM public.business_matches m
        JOIN public.business_intents i ON i.id = m.intent_id
        WHERE m.id = match_id
          AND public.is_organization_member(i.organization_id)
    )
    OR (
        kind IN ('match_created', 'lifecycle_changed')
        AND EXISTS (
            SELECT 1
            FROM public.business_matches m
            JOIN public.business_opportunities o ON o.id = m.opportunity_id
            WHERE m.id = match_id
              AND o.organization_id IS NOT NULL
              AND public.is_organization_member(o.organization_id)
        )
    )
    OR (
        EXISTS (
            SELECT 1
            FROM public.business_matches m
            JOIN public.business_opportunities o ON o.id = m.opportunity_id
            WHERE m.id = match_id
              AND m.lifecycle IN ('introduced', 'converted')
              AND o.organization_id IS NOT NULL
              AND public.is_organization_member(o.organization_id)
        )
    )
);

REVOKE ALL ON FUNCTION public.tg_business_match_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_business_match_guard() FROM app_user;
REVOKE ALL ON FUNCTION public.tg_business_match_audit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_business_match_audit() FROM app_user;
REVOKE ALL ON FUNCTION public.tg_business_match_introduction_audit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_business_match_introduction_audit() FROM app_user;

REVOKE ALL ON FUNCTION public.qualify_business_match(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dismiss_business_match(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_business_match_introduction(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.respond_business_match_introduction(uuid, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reveal_match_parties(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.qualify_business_match(uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.dismiss_business_match(uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.request_business_match_introduction(uuid, text) TO app_user;
GRANT EXECUTE ON FUNCTION public.respond_business_match_introduction(uuid, boolean, text) TO app_user;
GRANT EXECUTE ON FUNCTION public.reveal_match_parties(uuid) TO app_user;

REVOKE ALL ON public.business_match_introductions FROM PUBLIC;
REVOKE ALL ON public.business_match_events FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.business_match_introductions FROM app_user;
REVOKE INSERT, UPDATE, DELETE ON public.business_match_events FROM app_user;
GRANT SELECT ON public.business_match_introductions TO app_user;
GRANT SELECT ON public.business_match_events TO app_user;
GRANT USAGE ON TYPE public.business_match_introduction_status TO app_user;
GRANT USAGE ON TYPE public.business_match_event_kind TO app_user;

DO $$
DECLARE
    r text;
    fn text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON public.business_match_introductions FROM %I', r);
            EXECUTE format('REVOKE ALL ON public.business_match_events FROM %I', r);
            FOREACH fn IN ARRAY ARRAY[
                'tg_business_match_guard()',
                'tg_business_match_audit()',
                'tg_business_match_introduction_audit()',
                'qualify_business_match(uuid)',
                'dismiss_business_match(uuid)',
                'request_business_match_introduction(uuid, text)',
                'respond_business_match_introduction(uuid, boolean, text)',
                'reveal_match_parties(uuid)'
            ] LOOP
                EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM %I', fn, r);
            END LOOP;
        END IF;
    END LOOP;
END $$;
