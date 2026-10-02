-- Matching Engine invocation v1 — enqueue only. Does not run the engine in-session.
-- Scoring (009), RLS, and Radar stay frozen. Users never EXECUTE run_matching_engine_v1().
--
-- Intent/Opportunity change → matching_jobs → privileged worker → engine → Radar
--
-- If an older 013 installed in-transaction PERFORM run_matching_engine_v1(), drop it.

DROP TRIGGER IF EXISTS trg_invoke_matching_engine_intent ON public.business_intents;
DROP TRIGGER IF EXISTS trg_invoke_matching_engine_opportunity ON public.business_opportunities;
DROP FUNCTION IF EXISTS public.invoke_matching_engine_v1() CASCADE;

DO $$ BEGIN
    CREATE TYPE public.matching_job_entity_type AS ENUM ('intent', 'opportunity');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE public.matching_job_status AS ENUM (
        'pending',
        'processing',
        'completed',
        'failed'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.matching_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type public.matching_job_entity_type NOT NULL,
    entity_id uuid NOT NULL,
    reason text NOT NULL DEFAULT '',
    status public.matching_job_status NOT NULL DEFAULT 'pending',
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz,
    completed_at timestamptz,
    last_error text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_matching_jobs_claim
    ON public.matching_jobs (created_at)
    WHERE status IN ('pending', 'processing');

CREATE UNIQUE INDEX IF NOT EXISTS idx_matching_jobs_pending_entity
    ON public.matching_jobs (entity_type, entity_id)
    WHERE status = 'pending';

COMMENT ON TABLE public.matching_jobs IS
    'Matcher work queue. Identifiers and reason only — no confidential business payload.';

CREATE OR REPLACE FUNCTION public.enqueue_matching_job(
    p_entity_type public.matching_job_entity_type,
    p_entity_id uuid,
    p_reason text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    job_id uuid;
BEGIN
    BEGIN
        INSERT INTO public.matching_jobs (entity_type, entity_id, reason, status)
        VALUES (p_entity_type, p_entity_id, COALESCE(btrim(p_reason), ''), 'pending')
        RETURNING id INTO job_id;
    EXCEPTION WHEN unique_violation THEN
        SELECT j.id INTO job_id
        FROM public.matching_jobs AS j
        WHERE j.entity_type = p_entity_type
          AND j.entity_id = p_entity_id
          AND j.status = 'pending'
        LIMIT 1;
    END;
    RETURN job_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_matching_job(public.matching_job_entity_type, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_matching_job(public.matching_job_entity_type, uuid, text) FROM app_user;
REVOKE ALL ON public.matching_jobs FROM PUBLIC;
REVOKE ALL ON public.matching_jobs FROM app_user;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON FUNCTION public.enqueue_matching_job(public.matching_job_entity_type, uuid, text) FROM %I', r);
            EXECUTE format('REVOKE ALL ON public.matching_jobs FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.run_matching_engine_v1() FROM %I', r);
        END IF;
    END LOOP;
END $$;

GRANT INSERT, SELECT, UPDATE ON public.matching_jobs TO postgres;
GRANT EXECUTE ON FUNCTION public.enqueue_matching_job(public.matching_job_entity_type, uuid, text) TO postgres;
GRANT EXECUTE ON FUNCTION public.run_matching_engine_v1() TO postgres;
GRANT EXECUTE ON FUNCTION public.kind_compatible(public.business_intent_kind, text) TO postgres;

-- Hosted pooler logins are often postgres.<project_ref>, not the name "postgres".
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT rolname
        FROM pg_roles
        WHERE rolname = 'postgres'
           OR rolname LIKE 'postgres.%'
    LOOP
        EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.matching_jobs TO %I', r.rolname);
        EXECUTE format(
            'GRANT EXECUTE ON FUNCTION public.enqueue_matching_job(public.matching_job_entity_type, uuid, text) TO %I',
            r.rolname
        );
        EXECUTE format(
            'GRANT EXECUTE ON FUNCTION public.run_matching_engine_v1() TO %I',
            r.rolname
        );
        EXECUTE format(
            'GRANT EXECUTE ON FUNCTION public.kind_compatible(public.business_intent_kind, text) TO %I',
            r.rolname
        );
    END LOOP;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'intent_matcher') THEN
        EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.matching_jobs TO intent_matcher';
        EXECUTE 'GRANT SELECT ON public.business_intent_match_index TO intent_matcher';
        EXECUTE 'GRANT SELECT ON public.business_opportunity_match_index TO intent_matcher';
        EXECUTE 'GRANT SELECT, INSERT, UPDATE ON public.business_matches TO intent_matcher';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.run_matching_engine_v1() TO intent_matcher';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.enqueue_matching_job(public.matching_job_entity_type, uuid, text) TO intent_matcher';
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.tg_enqueue_matching_job_intent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    why text := 'insert';
BEGIN
    IF TG_OP = 'UPDATE' THEN
        why := CASE
            WHEN OLD.lifecycle IS DISTINCT FROM NEW.lifecycle THEN 'lifecycle'
            WHEN OLD.kind IS DISTINCT FROM NEW.kind THEN 'kind'
            WHEN OLD.industry IS DISTINCT FROM NEW.industry THEN 'industry'
            WHEN OLD.target_markets IS DISTINCT FROM NEW.target_markets THEN 'target_markets'
            WHEN OLD.visibility IS DISTINCT FROM NEW.visibility THEN 'visibility'
            WHEN OLD.expires_at IS DISTINCT FROM NEW.expires_at THEN 'expiry'
            ELSE 'update'
        END;
    END IF;
    PERFORM public.enqueue_matching_job('intent', NEW.id, why);
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_enqueue_matching_job_opportunity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    why text := 'insert';
BEGIN
    IF TG_OP = 'UPDATE' THEN
        why := CASE
            WHEN OLD.lifecycle IS DISTINCT FROM NEW.lifecycle THEN 'lifecycle'
            WHEN (OLD.facets->>'kind') IS DISTINCT FROM (NEW.facets->>'kind') THEN 'kind'
            WHEN OLD.industry IS DISTINCT FROM NEW.industry THEN 'industry'
            WHEN OLD.target_markets IS DISTINCT FROM NEW.target_markets THEN 'target_markets'
            WHEN OLD.visibility IS DISTINCT FROM NEW.visibility THEN 'visibility'
            ELSE 'update'
        END;
    END IF;
    PERFORM public.enqueue_matching_job('opportunity', NEW.id, why);
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_enqueue_matching_job_intent() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_enqueue_matching_job_opportunity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tg_enqueue_matching_job_intent() FROM app_user;
REVOKE ALL ON FUNCTION public.tg_enqueue_matching_job_opportunity() FROM app_user;

DROP TRIGGER IF EXISTS trg_enqueue_matching_job_intent ON public.business_intents;
DROP TRIGGER IF EXISTS trg_enqueue_matching_job_intent_ins ON public.business_intents;
DROP TRIGGER IF EXISTS trg_enqueue_matching_job_intent_upd ON public.business_intents;
CREATE TRIGGER trg_enqueue_matching_job_intent_ins
    AFTER INSERT ON public.business_intents
    FOR EACH ROW
    WHEN (
        NEW.lifecycle = 'active'
        AND NEW.visibility IN ('confidential', 'network', 'public')
    )
    EXECUTE PROCEDURE public.tg_enqueue_matching_job_intent();

CREATE TRIGGER trg_enqueue_matching_job_intent_upd
    AFTER UPDATE ON public.business_intents
    FOR EACH ROW
    WHEN (
        NEW.lifecycle = 'active'
        AND NEW.visibility IN ('confidential', 'network', 'public')
        AND (
            OLD.lifecycle IS DISTINCT FROM NEW.lifecycle
            OR OLD.kind IS DISTINCT FROM NEW.kind
            OR OLD.industry IS DISTINCT FROM NEW.industry
            OR OLD.target_markets IS DISTINCT FROM NEW.target_markets
            OR OLD.visibility IS DISTINCT FROM NEW.visibility
            OR OLD.expires_at IS DISTINCT FROM NEW.expires_at
        )
    )
    EXECUTE PROCEDURE public.tg_enqueue_matching_job_intent();

DROP TRIGGER IF EXISTS trg_enqueue_matching_job_opportunity ON public.business_opportunities;
DROP TRIGGER IF EXISTS trg_enqueue_matching_job_opportunity_ins ON public.business_opportunities;
DROP TRIGGER IF EXISTS trg_enqueue_matching_job_opportunity_upd ON public.business_opportunities;
CREATE TRIGGER trg_enqueue_matching_job_opportunity_ins
    AFTER INSERT ON public.business_opportunities
    FOR EACH ROW
    WHEN (
        NEW.lifecycle = 'open'
        AND NEW.visibility IN ('confidential', 'network', 'public')
    )
    EXECUTE PROCEDURE public.tg_enqueue_matching_job_opportunity();

CREATE TRIGGER trg_enqueue_matching_job_opportunity_upd
    AFTER UPDATE ON public.business_opportunities
    FOR EACH ROW
    WHEN (
        NEW.lifecycle = 'open'
        AND NEW.visibility IN ('confidential', 'network', 'public')
        AND (
            OLD.lifecycle IS DISTINCT FROM NEW.lifecycle
            OR (OLD.facets->>'kind') IS DISTINCT FROM (NEW.facets->>'kind')
            OR OLD.industry IS DISTINCT FROM NEW.industry
            OR OLD.target_markets IS DISTINCT FROM NEW.target_markets
            OR OLD.visibility IS DISTINCT FROM NEW.visibility
        )
    )
    EXECUTE PROCEDURE public.tg_enqueue_matching_job_opportunity();

-- Rows created before 013 never fired enqueue triggers.
SELECT public.enqueue_matching_job('intent', i.id, 'backfill')
FROM public.business_intents i
WHERE i.lifecycle = 'active'
  AND i.visibility IN ('confidential', 'network', 'public');

SELECT public.enqueue_matching_job('opportunity', o.id, 'backfill')
FROM public.business_opportunities o
WHERE o.lifecycle = 'open'
  AND o.visibility IN ('confidential', 'network', 'public');
