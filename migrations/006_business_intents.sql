-- Business Intents v1 — first product domain on Universal Business Core.
-- Intent = what an organization wants.
-- Opportunity (later) = a concrete opening discovered or created from intents.
-- Match (later) = scored link between two compatible parties/objects.
--
-- Canonical visibility token is `confidential` (not CONFIDENTIAL_MATCH).
-- Same spelling in this enum, TypeScript, RLS, API payloads, and UI.

DO $$ BEGIN
    CREATE TYPE public.business_intent_kind AS ENUM (
        'buy',
        'sell',
        'partner',
        'invest',
        'supply',
        'distribute',
        'hire',
        'seek_capability'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.business_intent_visibility AS ENUM (
        'private',
        'confidential',
        'network',
        'public'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.business_intent_lifecycle AS ENUM (
        'draft',
        'active',
        'paused',
        'matched',
        'introducing',
        'fulfilled',
        'expired',
        'withdrawn'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.business_intents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by uuid NOT NULL,
    kind public.business_intent_kind NOT NULL,
    headline text NOT NULL CHECK (btrim(headline) <> ''),
    public_summary text NOT NULL DEFAULT '',
    industry text NOT NULL CHECK (btrim(industry) <> ''),
    target_markets text[] NOT NULL DEFAULT '{}',
    visibility public.business_intent_visibility NOT NULL DEFAULT 'confidential',
    lifecycle public.business_intent_lifecycle NOT NULL DEFAULT 'draft',
    expires_at timestamptz,
    published_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT business_intents_expiry_ok CHECK (expires_at IS NULL OR expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_business_intents_org
    ON public.business_intents(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_intents_match_scan
    ON public.business_intents(lifecycle, visibility, expires_at);

CREATE TABLE IF NOT EXISTS public.business_intent_secrets (
    intent_id uuid PRIMARY KEY REFERENCES public.business_intents(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    private_brief text NOT NULL DEFAULT '',
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Privileged matching surface. app_user must not read or write this table.
-- The matching engine reads it as intent_matcher (or Supabase service_role).
CREATE TABLE IF NOT EXISTS public.business_intent_match_index (
    intent_id uuid PRIMARY KEY REFERENCES public.business_intents(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    kind public.business_intent_kind NOT NULL,
    industry text NOT NULL,
    target_markets text[] NOT NULL DEFAULT '{}',
    visibility public.business_intent_visibility NOT NULL,
    expires_at timestamptz,
    facets jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.sync_business_intent_match_index()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.lifecycle = 'active'
       AND NEW.visibility IN ('confidential', 'network', 'public')
       AND (NEW.expires_at IS NULL OR NEW.expires_at > pg_catalog.now()) THEN
        INSERT INTO public.business_intent_match_index (
            intent_id, organization_id, kind, industry, target_markets, visibility, expires_at, facets, updated_at
        ) VALUES (
            NEW.id,
            NEW.organization_id,
            NEW.kind,
            NEW.industry,
            NEW.target_markets,
            NEW.visibility,
            NEW.expires_at,
            pg_catalog.jsonb_build_object(
                'kind', NEW.kind::text,
                'industry', NEW.industry,
                'target_markets', pg_catalog.to_jsonb(NEW.target_markets),
                'visibility', NEW.visibility::text
            ),
            pg_catalog.now()
        )
        ON CONFLICT (intent_id) DO UPDATE SET
            organization_id = EXCLUDED.organization_id,
            kind = EXCLUDED.kind,
            industry = EXCLUDED.industry,
            target_markets = EXCLUDED.target_markets,
            visibility = EXCLUDED.visibility,
            expires_at = EXCLUDED.expires_at,
            facets = EXCLUDED.facets,
            updated_at = pg_catalog.now();
    ELSE
        DELETE FROM public.business_intent_match_index WHERE intent_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_business_intent_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
           OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
            RAISE EXCEPTION 'organization_id and created_by are immutable';
        END IF;
    END IF;
    NEW.updated_at = pg_catalog.now();
    IF NEW.lifecycle = 'active' AND (TG_OP = 'INSERT' OR OLD.lifecycle IS DISTINCT FROM 'active') THEN
        NEW.published_at = COALESCE(NEW.published_at, pg_catalog.now());
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_business_intent_secret_org()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    intent_org uuid;
BEGIN
    SELECT i.organization_id INTO intent_org
    FROM public.business_intents AS i
    WHERE i.id = NEW.intent_id;
    IF intent_org IS NULL OR NEW.organization_id IS DISTINCT FROM intent_org THEN
        RAISE EXCEPTION 'secret organization_id must match the intent organization';
    END IF;
    NEW.updated_at = pg_catalog.now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_intent_match_index ON public.business_intents;
CREATE TRIGGER trg_business_intent_match_index
    AFTER INSERT OR UPDATE ON public.business_intents
    FOR EACH ROW
    EXECUTE PROCEDURE public.sync_business_intent_match_index();

DROP TRIGGER IF EXISTS trg_business_intent_touch ON public.business_intents;
CREATE TRIGGER trg_business_intent_touch
    BEFORE INSERT OR UPDATE ON public.business_intents
    FOR EACH ROW
    EXECUTE PROCEDURE public.tg_business_intent_touch();

DROP TRIGGER IF EXISTS trg_business_intent_secret_org ON public.business_intent_secrets;
CREATE TRIGGER trg_business_intent_secret_org
    BEFORE INSERT OR UPDATE ON public.business_intent_secrets
    FOR EACH ROW
    EXECUTE PROCEDURE public.tg_business_intent_secret_org();

ALTER TABLE public.business_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_intents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.business_intent_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_intent_secrets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.business_intent_match_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_intent_match_index FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_intents_select ON public.business_intents;
CREATE POLICY business_intents_select ON public.business_intents
FOR SELECT TO app_user
USING (
    public.is_organization_member(organization_id)
    OR (
        lifecycle = 'active'
        AND visibility IN ('network', 'public')
        AND (expires_at IS NULL OR expires_at > now())
    )
);

DROP POLICY IF EXISTS business_intents_insert ON public.business_intents;
CREATE POLICY business_intents_insert ON public.business_intents
FOR INSERT TO app_user
WITH CHECK (public.can_write_organization(organization_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS business_intents_update ON public.business_intents;
CREATE POLICY business_intents_update ON public.business_intents
FOR UPDATE TO app_user
USING (public.can_write_organization(organization_id))
WITH CHECK (public.can_write_organization(organization_id));

DROP POLICY IF EXISTS business_intents_delete ON public.business_intents;
CREATE POLICY business_intents_delete ON public.business_intents
FOR DELETE TO app_user
USING (public.can_write_organization(organization_id));

DROP POLICY IF EXISTS business_intent_secrets_member ON public.business_intent_secrets;
CREATE POLICY business_intent_secrets_member ON public.business_intent_secrets
FOR ALL TO app_user
USING (public.is_organization_member(organization_id))
WITH CHECK (public.can_write_organization(organization_id));

DO $$ BEGIN
    CREATE ROLE intent_matcher NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP POLICY IF EXISTS business_intent_match_index_matcher ON public.business_intent_match_index;
CREATE POLICY business_intent_match_index_matcher ON public.business_intent_match_index
FOR SELECT TO intent_matcher
USING (true);

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE 'DROP POLICY IF EXISTS business_intent_match_index_service ON public.business_intent_match_index';
        EXECUTE $p$
            CREATE POLICY business_intent_match_index_service ON public.business_intent_match_index
            FOR SELECT TO service_role
            USING (true)
        $p$;
        EXECUTE 'GRANT SELECT ON public.business_intent_match_index TO service_role';
    END IF;
END $$;

REVOKE ALL ON FUNCTION public.sync_business_intent_match_index() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_business_intent_match_index() FROM app_user;
REVOKE ALL ON FUNCTION public.tg_business_intent_touch() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_business_intent_secret_org() FROM PUBLIC;
REVOKE ALL ON public.business_intent_match_index FROM PUBLIC;
REVOKE ALL ON public.business_intent_match_index FROM app_user;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON FUNCTION public.sync_business_intent_match_index() FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.tg_business_intent_touch() FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.tg_business_intent_secret_org() FROM %I', r);
            EXECUTE format('REVOKE ALL ON public.business_intent_match_index FROM %I', r);
        END IF;
    END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO intent_matcher;
GRANT SELECT ON public.business_intent_match_index TO intent_matcher;

GRANT USAGE ON TYPE public.business_intent_kind TO app_user;
GRANT USAGE ON TYPE public.business_intent_visibility TO app_user;
GRANT USAGE ON TYPE public.business_intent_lifecycle TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_intents TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_intent_secrets TO app_user;
