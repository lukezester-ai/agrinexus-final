-- Business Opportunities v1 — second product domain on Universal Business Core.
-- Intent      = a declared want of an organization.
-- Opportunity = a concrete opening: system-discovered, manual, or external signal.
-- Match       = scored link between Intent↔Opportunity or two compatible Intents.
--
-- Match scores MUST NOT live on this table. One opportunity can score differently
-- against different intents; scores belong to matches (008+).
-- Visibility token is `confidential`, same spelling as intents.

DO $$ BEGIN
    CREATE TYPE public.business_opportunity_source_type AS ENUM (
        'manual',
        'system_discovery',
        'external_signal'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.business_opportunity_visibility AS ENUM (
        'private',
        'confidential',
        'network',
        'public'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.business_opportunity_lifecycle AS ENUM (
        'draft',
        'open',
        'paused',
        'pursuing',
        'fulfilled',
        'expired',
        'withdrawn'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.business_opportunities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by uuid,
    source_type public.business_opportunity_source_type NOT NULL,
    source_ref text NOT NULL DEFAULT '',
    external_origin text,
    title text NOT NULL CHECK (btrim(title) <> ''),
    summary text NOT NULL DEFAULT '',
    industry text NOT NULL CHECK (btrim(industry) <> ''),
    target_markets text[] NOT NULL DEFAULT '{}',
    visibility public.business_opportunity_visibility NOT NULL DEFAULT 'confidential',
    lifecycle public.business_opportunity_lifecycle NOT NULL DEFAULT 'draft',
    expires_at timestamptz,
    published_at timestamptz,
    facets jsonb NOT NULL DEFAULT '{}'::jsonb,
    provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT business_opportunities_expiry_ok
        CHECK (expires_at IS NULL OR expires_at > created_at),
    CONSTRAINT business_opportunities_has_origin
        CHECK (organization_id IS NOT NULL OR btrim(COALESCE(external_origin, '')) <> ''),
    CONSTRAINT business_opportunities_manual_has_owner
        CHECK (
            source_type <> 'manual'
            OR (organization_id IS NOT NULL AND created_by IS NOT NULL)
        ),
    CONSTRAINT business_opportunities_facets_have_no_score
        CHECK (
            NOT (facets ? 'score')
            AND NOT (facets ? 'match_score')
            AND NOT (facets ? 'matchScore')
        ),
    CONSTRAINT business_opportunities_provenance_has_no_score
        CHECK (
            NOT (provenance ? 'score')
            AND NOT (provenance ? 'match_score')
            AND NOT (provenance ? 'matchScore')
        )
);

CREATE INDEX IF NOT EXISTS idx_business_opportunities_org
    ON public.business_opportunities(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_opportunities_match_scan
    ON public.business_opportunities(lifecycle, visibility, expires_at);

CREATE TABLE IF NOT EXISTS public.business_opportunity_secrets (
    opportunity_id uuid PRIMARY KEY REFERENCES public.business_opportunities(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    private_brief text NOT NULL DEFAULT '',
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Privileged matching surface. No scores. app_user must not read or write it.
CREATE TABLE IF NOT EXISTS public.business_opportunity_match_index (
    opportunity_id uuid PRIMARY KEY REFERENCES public.business_opportunities(id) ON DELETE CASCADE,
    organization_id uuid,
    industry text NOT NULL,
    target_markets text[] NOT NULL DEFAULT '{}',
    visibility public.business_opportunity_visibility NOT NULL,
    expires_at timestamptz,
    facets jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.sync_business_opportunity_match_index()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.lifecycle = 'open'
       AND NEW.visibility IN ('confidential', 'network', 'public')
       AND (NEW.expires_at IS NULL OR NEW.expires_at > pg_catalog.now()) THEN
        INSERT INTO public.business_opportunity_match_index (
            opportunity_id, organization_id, industry, target_markets, visibility, expires_at, facets, updated_at
        ) VALUES (
            NEW.id,
            NEW.organization_id,
            NEW.industry,
            NEW.target_markets,
            NEW.visibility,
            NEW.expires_at,
            NEW.facets,
            pg_catalog.now()
        )
        ON CONFLICT (opportunity_id) DO UPDATE SET
            organization_id = EXCLUDED.organization_id,
            industry = EXCLUDED.industry,
            target_markets = EXCLUDED.target_markets,
            visibility = EXCLUDED.visibility,
            expires_at = EXCLUDED.expires_at,
            facets = EXCLUDED.facets,
            updated_at = pg_catalog.now();
    ELSE
        DELETE FROM public.business_opportunity_match_index WHERE opportunity_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_business_opportunity_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
           OR NEW.created_by IS DISTINCT FROM OLD.created_by
           OR NEW.source_type IS DISTINCT FROM OLD.source_type
           OR NEW.source_ref IS DISTINCT FROM OLD.source_ref
           OR NEW.external_origin IS DISTINCT FROM OLD.external_origin THEN
            RAISE EXCEPTION 'opportunity identity and provenance origin columns are immutable';
        END IF;
    END IF;
    NEW.updated_at = pg_catalog.now();
    IF NEW.lifecycle = 'open' AND (TG_OP = 'INSERT' OR OLD.lifecycle IS DISTINCT FROM 'open') THEN
        NEW.published_at = COALESCE(NEW.published_at, pg_catalog.now());
        IF NEW.provenance = '{}'::jsonb THEN
            NEW.provenance = pg_catalog.jsonb_build_object(
                'recorded_at', pg_catalog.now(),
                'source_type', NEW.source_type::text
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_business_opportunity_secret_org()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    opportunity_org uuid;
BEGIN
    SELECT o.organization_id INTO opportunity_org
    FROM public.business_opportunities AS o
    WHERE o.id = NEW.opportunity_id;
    IF opportunity_org IS NULL OR NEW.organization_id IS DISTINCT FROM opportunity_org THEN
        RAISE EXCEPTION 'secret organization_id must match the opportunity organization';
    END IF;
    NEW.updated_at = pg_catalog.now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_opportunity_match_index ON public.business_opportunities;
CREATE TRIGGER trg_business_opportunity_match_index
    AFTER INSERT OR UPDATE ON public.business_opportunities
    FOR EACH ROW
    EXECUTE PROCEDURE public.sync_business_opportunity_match_index();

DROP TRIGGER IF EXISTS trg_business_opportunity_touch ON public.business_opportunities;
CREATE TRIGGER trg_business_opportunity_touch
    BEFORE INSERT OR UPDATE ON public.business_opportunities
    FOR EACH ROW
    EXECUTE PROCEDURE public.tg_business_opportunity_touch();

DROP TRIGGER IF EXISTS trg_business_opportunity_secret_org ON public.business_opportunity_secrets;
CREATE TRIGGER trg_business_opportunity_secret_org
    BEFORE INSERT OR UPDATE ON public.business_opportunity_secrets
    FOR EACH ROW
    EXECUTE PROCEDURE public.tg_business_opportunity_secret_org();

ALTER TABLE public.business_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_opportunities FORCE ROW LEVEL SECURITY;
ALTER TABLE public.business_opportunity_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_opportunity_secrets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.business_opportunity_match_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_opportunity_match_index FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_opportunities_select ON public.business_opportunities;
CREATE POLICY business_opportunities_select ON public.business_opportunities
FOR SELECT TO app_user
USING (
    (organization_id IS NOT NULL AND public.is_organization_member(organization_id))
    OR (
        lifecycle = 'open'
        AND visibility IN ('network', 'public')
        AND (expires_at IS NULL OR expires_at > now())
    )
);

DROP POLICY IF EXISTS business_opportunities_insert ON public.business_opportunities;
CREATE POLICY business_opportunities_insert ON public.business_opportunities
FOR INSERT TO app_user
WITH CHECK (
    source_type = 'manual'
    AND organization_id IS NOT NULL
    AND public.can_write_organization(organization_id)
    AND created_by = auth.uid()
);

DROP POLICY IF EXISTS business_opportunities_update ON public.business_opportunities;
CREATE POLICY business_opportunities_update ON public.business_opportunities
FOR UPDATE TO app_user
USING (organization_id IS NOT NULL AND public.can_write_organization(organization_id))
WITH CHECK (organization_id IS NOT NULL AND public.can_write_organization(organization_id));

DROP POLICY IF EXISTS business_opportunities_delete ON public.business_opportunities;
CREATE POLICY business_opportunities_delete ON public.business_opportunities
FOR DELETE TO app_user
USING (organization_id IS NOT NULL AND public.can_write_organization(organization_id));

DROP POLICY IF EXISTS business_opportunity_secrets_member ON public.business_opportunity_secrets;
CREATE POLICY business_opportunity_secrets_member ON public.business_opportunity_secrets
FOR ALL TO app_user
USING (public.is_organization_member(organization_id))
WITH CHECK (public.can_write_organization(organization_id));

DO $$ BEGIN
    CREATE ROLE intent_matcher NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP POLICY IF EXISTS business_opportunity_match_index_matcher ON public.business_opportunity_match_index;
CREATE POLICY business_opportunity_match_index_matcher ON public.business_opportunity_match_index
FOR SELECT TO intent_matcher
USING (true);

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE 'DROP POLICY IF EXISTS business_opportunity_match_index_service ON public.business_opportunity_match_index';
        EXECUTE $p$
            CREATE POLICY business_opportunity_match_index_service ON public.business_opportunity_match_index
            FOR SELECT TO service_role
            USING (true)
        $p$;
        EXECUTE 'GRANT SELECT ON public.business_opportunity_match_index TO service_role';
    END IF;
END $$;

REVOKE ALL ON FUNCTION public.sync_business_opportunity_match_index() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_business_opportunity_match_index() FROM app_user;
REVOKE ALL ON FUNCTION public.tg_business_opportunity_touch() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_business_opportunity_secret_org() FROM PUBLIC;
REVOKE ALL ON public.business_opportunity_match_index FROM PUBLIC;
REVOKE ALL ON public.business_opportunity_match_index FROM app_user;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON FUNCTION public.sync_business_opportunity_match_index() FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.tg_business_opportunity_touch() FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.tg_business_opportunity_secret_org() FROM %I', r);
            EXECUTE format('REVOKE ALL ON public.business_opportunity_match_index FROM %I', r);
        END IF;
    END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO intent_matcher;
GRANT SELECT ON public.business_opportunity_match_index TO intent_matcher;

GRANT USAGE ON TYPE public.business_opportunity_source_type TO app_user;
GRANT USAGE ON TYPE public.business_opportunity_visibility TO app_user;
GRANT USAGE ON TYPE public.business_opportunity_lifecycle TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_opportunities TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_opportunity_secrets TO app_user;
