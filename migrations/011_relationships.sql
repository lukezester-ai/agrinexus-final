-- Relationships v1 — established org↔org link after introduction.
-- Matching Engine v1 and Qualification / Introduction v1 stay frozen.
-- A relationship is opened only when a match becomes introduced and both sides have orgs.
-- Score stays on the match. This table stores identity of the relationship, not the evaluation.

DO $$ BEGIN
    CREATE TYPE public.business_relationship_status AS ENUM (
        'active',
        'paused',
        'closed'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.business_relationship_kind AS ENUM (
        'introduced'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.business_relationship_event_kind AS ENUM (
        'opened',
        'reintroduced',
        'touched',
        'paused',
        'resumed',
        'closed'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.business_relationships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_a uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    organization_b uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    origin_match_id uuid NOT NULL REFERENCES public.business_matches(id) ON DELETE RESTRICT,
    kind public.business_relationship_kind NOT NULL DEFAULT 'introduced',
    status public.business_relationship_status NOT NULL DEFAULT 'active',
    started_at timestamptz NOT NULL DEFAULT now(),
    last_interaction_at timestamptz NOT NULL DEFAULT now(),
    pair_low uuid GENERATED ALWAYS AS (LEAST(organization_a, organization_b)) STORED,
    pair_high uuid GENERATED ALWAYS AS (GREATEST(organization_a, organization_b)) STORED,
    provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT business_relationships_distinct_orgs
        CHECK (organization_a <> organization_b),
    CONSTRAINT business_relationships_no_score
        CHECK (
            NOT (provenance ? 'score')
            AND NOT (provenance ? 'match_score')
            AND NOT (provenance ? 'matchScore')
            AND NOT (provenance ? 'confidence')
            AND NOT (provenance ? 'headline')
            AND NOT (provenance ? 'private_brief')
            AND NOT (provenance ? 'title')
            AND NOT (provenance ? 'summary')
        ),
    CONSTRAINT business_relationships_unique_pair UNIQUE (pair_low, pair_high)
);

CREATE INDEX IF NOT EXISTS idx_business_relationships_org_a
    ON public.business_relationships(organization_a, status);
CREATE INDEX IF NOT EXISTS idx_business_relationships_org_b
    ON public.business_relationships(organization_b, status);
CREATE INDEX IF NOT EXISTS idx_business_relationships_origin_match
    ON public.business_relationships(origin_match_id);

CREATE TABLE IF NOT EXISTS public.business_relationship_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    relationship_id uuid NOT NULL REFERENCES public.business_relationships(id) ON DELETE CASCADE,
    kind public.business_relationship_event_kind NOT NULL,
    actor_user_id uuid,
    actor_organization_id uuid,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT business_relationship_events_no_score
        CHECK (
            NOT (payload ? 'score')
            AND NOT (payload ? 'match_score')
            AND NOT (payload ? 'matchScore')
            AND NOT (payload ? 'confidence')
            AND NOT (payload ? 'headline')
            AND NOT (payload ? 'private_brief')
        )
);

CREATE INDEX IF NOT EXISTS idx_business_relationship_events_rel
    ON public.business_relationship_events(relationship_id, created_at);

CREATE OR REPLACE FUNCTION public.ensure_business_relationship_from_match(p_match_id uuid)
RETURNS public.business_relationships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    intent_org uuid;
    opp_org uuid;
    rec public.business_relationships;
    event_kind public.business_relationship_event_kind;
    pair_exists boolean;
BEGIN
    SELECT i.organization_id, o.organization_id
    INTO intent_org, opp_org
    FROM public.business_matches m
    JOIN public.business_intents i ON i.id = m.intent_id
    JOIN public.business_opportunities o ON o.id = m.opportunity_id
    WHERE m.id = p_match_id
      AND m.lifecycle IN ('introduced', 'converted');
    IF intent_org IS NULL OR opp_org IS NULL THEN
        RETURN NULL;
    END IF;
    IF intent_org = opp_org THEN
        RETURN NULL;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.business_relationships r
        WHERE r.pair_low = LEAST(intent_org, opp_org)
          AND r.pair_high = GREATEST(intent_org, opp_org)
    ) INTO pair_exists;

    INSERT INTO public.business_relationships (
        organization_a,
        organization_b,
        origin_match_id,
        kind,
        status,
        provenance
    ) VALUES (
        intent_org,
        opp_org,
        p_match_id,
        'introduced'::public.business_relationship_kind,
        'active'::public.business_relationship_status,
        pg_catalog.jsonb_build_object(
            'origin', 'introduction_accepted',
            'origin_match_id', p_match_id
        )
    )
    ON CONFLICT (pair_low, pair_high) DO UPDATE SET
        last_interaction_at = pg_catalog.now(),
        updated_at = pg_catalog.now(),
        status = CASE
            WHEN public.business_relationships.status = 'closed'::public.business_relationship_status
                THEN 'closed'::public.business_relationship_status
            ELSE 'active'::public.business_relationship_status
        END,
        provenance = CASE
            WHEN public.business_relationships.origin_match_id = EXCLUDED.origin_match_id THEN
                public.business_relationships.provenance
            ELSE
                COALESCE(public.business_relationships.provenance, '{}'::jsonb)
                || pg_catalog.jsonb_build_object('later_match_id', EXCLUDED.origin_match_id)
        END
    RETURNING * INTO rec;

    event_kind := CASE WHEN pair_exists THEN 'reintroduced' ELSE 'opened' END;
    INSERT INTO public.business_relationship_events (
        relationship_id, kind, payload
    ) VALUES (
        rec.id,
        event_kind,
        pg_catalog.jsonb_build_object('origin_match_id', p_match_id)
    );
    RETURN rec;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_business_match_open_relationship()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.lifecycle IN ('introduced', 'converted')
       AND OLD.lifecycle IS DISTINCT FROM NEW.lifecycle THEN
        PERFORM public.ensure_business_relationship_from_match(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_match_open_relationship ON public.business_matches;
CREATE TRIGGER trg_business_match_open_relationship
    AFTER UPDATE ON public.business_matches
    FOR EACH ROW
    EXECUTE PROCEDURE public.tg_business_match_open_relationship();

CREATE OR REPLACE FUNCTION public._assert_relationship_writer(p_relationship_id uuid)
RETURNS public.business_relationships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    rec public.business_relationships;
BEGIN
    SELECT * INTO rec
    FROM public.business_relationships
    WHERE id = p_relationship_id;
    IF rec.id IS NULL THEN
        RAISE EXCEPTION 'relationship not found';
    END IF;
    IF NOT (
        public.can_write_organization(rec.organization_a)
        OR public.can_write_organization(rec.organization_b)
    ) THEN
        RAISE EXCEPTION 'only relationship-party writers can change the relationship';
    END IF;
    RETURN rec;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_business_relationship(p_relationship_id uuid)
RETURNS public.business_relationships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    rec public.business_relationships;
BEGIN
    rec := public._assert_relationship_writer(p_relationship_id);
    IF rec.status = 'closed' THEN
        RAISE EXCEPTION 'closed relationships cannot be touched';
    END IF;
    UPDATE public.business_relationships
    SET last_interaction_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE id = p_relationship_id
    RETURNING * INTO rec;
    INSERT INTO public.business_relationship_events (
        relationship_id, kind, actor_user_id, payload
    ) VALUES (
        rec.id, 'touched', auth.uid(), '{}'::jsonb
    );
    RETURN rec;
END;
$$;

CREATE OR REPLACE FUNCTION public.pause_business_relationship(p_relationship_id uuid)
RETURNS public.business_relationships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    rec public.business_relationships;
BEGIN
    rec := public._assert_relationship_writer(p_relationship_id);
    IF rec.status <> 'active' THEN
        RAISE EXCEPTION 'only active relationships can be paused';
    END IF;
    UPDATE public.business_relationships
    SET status = 'paused',
        updated_at = pg_catalog.now()
    WHERE id = p_relationship_id
    RETURNING * INTO rec;
    INSERT INTO public.business_relationship_events (
        relationship_id, kind, actor_user_id, payload
    ) VALUES (
        rec.id, 'paused', auth.uid(), '{}'::jsonb
    );
    RETURN rec;
END;
$$;

CREATE OR REPLACE FUNCTION public.resume_business_relationship(p_relationship_id uuid)
RETURNS public.business_relationships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    rec public.business_relationships;
BEGIN
    rec := public._assert_relationship_writer(p_relationship_id);
    IF rec.status <> 'paused' THEN
        RAISE EXCEPTION 'only paused relationships can be resumed';
    END IF;
    UPDATE public.business_relationships
    SET status = 'active',
        last_interaction_at = pg_catalog.now(),
        updated_at = pg_catalog.now()
    WHERE id = p_relationship_id
    RETURNING * INTO rec;
    INSERT INTO public.business_relationship_events (
        relationship_id, kind, actor_user_id, payload
    ) VALUES (
        rec.id, 'resumed', auth.uid(), '{}'::jsonb
    );
    RETURN rec;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_business_relationship(p_relationship_id uuid)
RETURNS public.business_relationships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    rec public.business_relationships;
BEGIN
    rec := public._assert_relationship_writer(p_relationship_id);
    IF rec.status = 'closed' THEN
        RAISE EXCEPTION 'relationship already closed';
    END IF;
    UPDATE public.business_relationships
    SET status = 'closed',
        updated_at = pg_catalog.now()
    WHERE id = p_relationship_id
    RETURNING * INTO rec;
    INSERT INTO public.business_relationship_events (
        relationship_id, kind, actor_user_id, payload
    ) VALUES (
        rec.id, 'closed', auth.uid(), '{}'::jsonb
    );
    RETURN rec;
END;
$$;

ALTER TABLE public.business_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_relationships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.business_relationship_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_relationship_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_relationships_select ON public.business_relationships;
CREATE POLICY business_relationships_select ON public.business_relationships
FOR SELECT TO app_user
USING (
    public.is_organization_member(organization_a)
    OR public.is_organization_member(organization_b)
);

DROP POLICY IF EXISTS business_relationship_events_select ON public.business_relationship_events;
CREATE POLICY business_relationship_events_select ON public.business_relationship_events
FOR SELECT TO app_user
USING (
    EXISTS (
        SELECT 1
        FROM public.business_relationships r
        WHERE r.id = relationship_id
          AND (
              public.is_organization_member(r.organization_a)
              OR public.is_organization_member(r.organization_b)
          )
    )
);

REVOKE ALL ON FUNCTION public.ensure_business_relationship_from_match(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_business_relationship_from_match(uuid) FROM app_user;
REVOKE ALL ON FUNCTION public.tg_business_match_open_relationship() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_business_match_open_relationship() FROM app_user;
REVOKE ALL ON FUNCTION public._assert_relationship_writer(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._assert_relationship_writer(uuid) FROM app_user;

REVOKE ALL ON FUNCTION public.touch_business_relationship(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pause_business_relationship(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resume_business_relationship(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.close_business_relationship(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.touch_business_relationship(uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.pause_business_relationship(uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.resume_business_relationship(uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.close_business_relationship(uuid) TO app_user;

REVOKE ALL ON public.business_relationships FROM PUBLIC;
REVOKE ALL ON public.business_relationship_events FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.business_relationships FROM app_user;
REVOKE INSERT, UPDATE, DELETE ON public.business_relationship_events FROM app_user;
GRANT SELECT ON public.business_relationships TO app_user;
GRANT SELECT ON public.business_relationship_events TO app_user;
GRANT USAGE ON TYPE public.business_relationship_status TO app_user;
GRANT USAGE ON TYPE public.business_relationship_kind TO app_user;
GRANT USAGE ON TYPE public.business_relationship_event_kind TO app_user;

DO $$
DECLARE
    r text;
    fn text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON public.business_relationships FROM %I', r);
            EXECUTE format('REVOKE ALL ON public.business_relationship_events FROM %I', r);
            FOREACH fn IN ARRAY ARRAY[
                'ensure_business_relationship_from_match(uuid)',
                'tg_business_match_open_relationship()',
                '_assert_relationship_writer(uuid)',
                'touch_business_relationship(uuid)',
                'pause_business_relationship(uuid)',
                'resume_business_relationship(uuid)',
                'close_business_relationship(uuid)'
            ] LOOP
                EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM %I', fn, r);
            END LOOP;
        END IF;
    END LOOP;
END $$;
