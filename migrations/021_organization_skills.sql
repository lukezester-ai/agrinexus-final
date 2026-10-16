-- Organization Skills v1 — org-scoped AI playbooks authored from free text.
--
-- A skill is an internal capability of exactly one organization: the user writes
-- what they want in plain language, the AI proposes a structured playbook, and the
-- user stores it for their own organization.
--
-- Boundary: skills are never indexed for matching, never scored, and never readable
-- by another organization. They are not Business Intents and carry no visibility
-- token. Contrast with 006_business_intents.sql, where `network`/`public` visibility
-- deliberately exposes a row to other organizations.
--
-- Canonical status token is `archived` (not DELETED). Same spelling in this enum,
-- TypeScript, RLS, API payloads, and UI.

DO $$ BEGIN
    CREATE TYPE public.organization_skill_status AS ENUM (
        'draft',
        'active',
        'archived'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.organization_skills (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by uuid NOT NULL,
    name text NOT NULL CHECK (btrim(name) <> ''),
    description text NOT NULL DEFAULT '',
    when_to_use text NOT NULL DEFAULT '',
    steps jsonb NOT NULL DEFAULT '[]'::jsonb,
    guardrails text[] NOT NULL DEFAULT '{}',
    status public.organization_skill_status NOT NULL DEFAULT 'draft',
    source_text text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT organization_skills_name_length CHECK (char_length(name) <= 120),
    CONSTRAINT organization_skills_description_length CHECK (char_length(description) <= 600),
    CONSTRAINT organization_skills_when_to_use_length CHECK (char_length(when_to_use) <= 600),
    CONSTRAINT organization_skills_source_length CHECK (char_length(source_text) <= 4000),
    CONSTRAINT organization_skills_steps_is_array CHECK (pg_catalog.jsonb_typeof(steps) = 'array')
);

-- One skill name per organization; names are compared case-insensitively.
CREATE UNIQUE INDEX IF NOT EXISTS uq_organization_skills_org_name
    ON public.organization_skills(organization_id, pg_catalog.lower(name));
CREATE INDEX IF NOT EXISTS idx_organization_skills_org
    ON public.organization_skills(organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.tg_organization_skill_touch()
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
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_organization_skill_touch ON public.organization_skills;
CREATE TRIGGER trg_organization_skill_touch
    BEFORE INSERT OR UPDATE ON public.organization_skills
    FOR EACH ROW
    EXECUTE PROCEDURE public.tg_organization_skill_touch();

ALTER TABLE public.organization_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_skills FORCE ROW LEVEL SECURITY;

-- Read: any member of the owning organization. There is no cross-organization branch.
DROP POLICY IF EXISTS organization_skills_select ON public.organization_skills;
CREATE POLICY organization_skills_select ON public.organization_skills
FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));

DROP POLICY IF EXISTS organization_skills_update ON public.organization_skills;
CREATE POLICY organization_skills_update ON public.organization_skills
FOR UPDATE TO app_user
USING (public.can_write_organization(organization_id))
WITH CHECK (public.can_write_organization(organization_id));

DROP POLICY IF EXISTS organization_skills_delete ON public.organization_skills;
CREATE POLICY organization_skills_delete ON public.organization_skills
FOR DELETE TO app_user
USING (public.can_write_organization(organization_id));

-- No INSERT policy by design: rows are created only through the command boundary
-- below, which records the audit event in the same transaction.

REVOKE ALL ON FUNCTION public.tg_organization_skill_touch() FROM PUBLIC;
REVOKE ALL ON public.organization_skills FROM PUBLIC;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON FUNCTION public.tg_organization_skill_touch() FROM %I', r);
            EXECUTE format('REVOKE ALL ON public.organization_skills FROM %I', r);
        END IF;
    END LOOP;
END $$;

GRANT USAGE ON TYPE public.organization_skill_status TO app_user;
GRANT SELECT, UPDATE, DELETE ON public.organization_skills TO app_user;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'GRANT USAGE ON TYPE public.organization_skill_status TO authenticated';
        EXECUTE 'GRANT SELECT, UPDATE, DELETE ON public.organization_skills TO authenticated';

        EXECUTE 'DROP POLICY IF EXISTS organization_skills_select_authenticated ON public.organization_skills';
        EXECUTE $policy$
            CREATE POLICY organization_skills_select_authenticated ON public.organization_skills
            FOR SELECT TO authenticated
            USING (public.is_organization_member(organization_id))
        $policy$;

        EXECUTE 'DROP POLICY IF EXISTS organization_skills_update_authenticated ON public.organization_skills';
        EXECUTE $policy$
            CREATE POLICY organization_skills_update_authenticated ON public.organization_skills
            FOR UPDATE TO authenticated
            USING (public.can_write_organization(organization_id))
            WITH CHECK (public.can_write_organization(organization_id))
        $policy$;

        EXECUTE 'DROP POLICY IF EXISTS organization_skills_delete_authenticated ON public.organization_skills';
        EXECUTE $policy$
            CREATE POLICY organization_skills_delete_authenticated ON public.organization_skills
            FOR DELETE TO authenticated
            USING (public.can_write_organization(organization_id))
        $policy$;
    END IF;
END $$;
