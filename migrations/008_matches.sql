-- Business Matches v1 — scored links. Not a copy of Intent or Opportunity.
-- Intent      = declared want.
-- Opportunity = concrete opening.
-- Match       = evaluation of one Intent against one Opportunity
--               (Intent↔Intent matching is a later unique key, not this table).
--
-- Score lives only here. Range is [0, 1] — the single standard.
-- Confidence is independent of score. Reasons/explanation are independent of score.
-- App users cannot insert matches or mutate scoring fields.
-- Confidential payloads stay on intent/opportunity rows; this table stores references only.

DO $$ BEGIN
    CREATE TYPE public.business_match_lifecycle AS ENUM (
        'candidate',
        'qualified',
        'dismissed',
        'introduced',
        'converted'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.business_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    intent_id uuid NOT NULL REFERENCES public.business_intents(id) ON DELETE CASCADE,
    opportunity_id uuid NOT NULL REFERENCES public.business_opportunities(id) ON DELETE CASCADE,
    matcher_engine text NOT NULL CHECK (btrim(matcher_engine) <> ''),
    matcher_version text NOT NULL CHECK (btrim(matcher_version) <> ''),
    score numeric(8, 6) NOT NULL CHECK (score >= 0 AND score <= 1),
    confidence numeric(8, 6) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
    explanation text NOT NULL DEFAULT '',
    lifecycle public.business_match_lifecycle NOT NULL DEFAULT 'candidate',
    provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT business_matches_unique_version
        UNIQUE (intent_id, opportunity_id, matcher_engine, matcher_version),
    CONSTRAINT business_matches_reasons_are_array
        CHECK (jsonb_typeof(reasons) = 'array'),
    CONSTRAINT business_matches_reasons_have_no_payload_copy
        CHECK (
            NOT (reasons ? 'headline')
            AND NOT (reasons ? 'private_brief')
            AND NOT (reasons ? 'title')
            AND NOT (reasons ? 'summary')
        ),
    CONSTRAINT business_matches_provenance_is_matcher_only
        CHECK (
            NOT (provenance ? 'headline')
            AND NOT (provenance ? 'private_brief')
            AND NOT (provenance ? 'title')
            AND NOT (provenance ? 'summary')
            AND NOT (provenance ? 'industry')
            AND NOT (provenance ? 'target_markets')
        )
);

CREATE INDEX IF NOT EXISTS idx_business_matches_intent
    ON public.business_matches(intent_id, lifecycle, score DESC);
CREATE INDEX IF NOT EXISTS idx_business_matches_opportunity
    ON public.business_matches(opportunity_id, lifecycle, score DESC);

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

DROP TRIGGER IF EXISTS trg_business_match_guard ON public.business_matches;
CREATE TRIGGER trg_business_match_guard
    BEFORE INSERT OR UPDATE ON public.business_matches
    FOR EACH ROW
    EXECUTE PROCEDURE public.tg_business_match_guard();

ALTER TABLE public.business_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_matches FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_matches_select ON public.business_matches;
CREATE POLICY business_matches_select ON public.business_matches
FOR SELECT TO app_user
USING (
    EXISTS (
        SELECT 1
        FROM public.business_intents i
        WHERE i.id = intent_id
          AND public.is_organization_member(i.organization_id)
    )
    OR EXISTS (
        SELECT 1
        FROM public.business_opportunities o
        WHERE o.id = opportunity_id
          AND o.organization_id IS NOT NULL
          AND public.is_organization_member(o.organization_id)
    )
);

DROP POLICY IF EXISTS business_matches_update_lifecycle ON public.business_matches;
CREATE POLICY business_matches_update_lifecycle ON public.business_matches
FOR UPDATE TO app_user
USING (
    EXISTS (
        SELECT 1
        FROM public.business_intents i
        WHERE i.id = intent_id
          AND public.can_write_organization(i.organization_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.business_intents i
        WHERE i.id = intent_id
          AND public.can_write_organization(i.organization_id)
    )
);

DO $$ BEGIN
    CREATE ROLE intent_matcher NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP POLICY IF EXISTS business_matches_matcher ON public.business_matches;
CREATE POLICY business_matches_matcher ON public.business_matches
FOR ALL TO intent_matcher
USING (true)
WITH CHECK (true);

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE 'DROP POLICY IF EXISTS business_matches_service ON public.business_matches';
        EXECUTE $p$
            CREATE POLICY business_matches_service ON public.business_matches
            FOR ALL TO service_role
            USING (true)
            WITH CHECK (true)
        $p$;
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_matches TO service_role';
    END IF;
END $$;

REVOKE ALL ON FUNCTION public.tg_business_match_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_business_match_guard() FROM app_user;
REVOKE ALL ON public.business_matches FROM PUBLIC;
REVOKE INSERT, DELETE ON public.business_matches FROM app_user;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON FUNCTION public.tg_business_match_guard() FROM %I', r);
            EXECUTE format('REVOKE ALL ON public.business_matches FROM %I', r);
        END IF;
    END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO intent_matcher;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_matches TO intent_matcher;
GRANT USAGE ON TYPE public.business_match_lifecycle TO intent_matcher;
GRANT USAGE ON TYPE public.business_match_lifecycle TO app_user;
GRANT SELECT, UPDATE ON public.business_matches TO app_user;
