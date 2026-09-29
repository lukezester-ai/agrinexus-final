-- Finance copilot v1 gate A. Does not alter 001-005 and does not recreate 006-013.
-- A model candidate is accepted only as a version 2 strategy spec.
-- The compiler does not invent fields and does not write a strategy, book, order, or paper state.

CREATE OR REPLACE FUNCTION public.finance_candidate_command(p_value jsonb) RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
    key text;
    item jsonb;
BEGIN
    IF p_value IS NULL OR jsonb_typeof(p_value) IS NULL OR jsonb_typeof(p_value) = 'null' THEN
        RETURN false;
    END IF;
    IF jsonb_typeof(p_value) = 'object' THEN
        FOR key IN SELECT object_key FROM jsonb_object_keys(p_value) AS object_key LOOP
            IF key IN ('action', 'broker', 'execute', 'live', 'order', 'side') THEN
                RETURN true;
            END IF;
            IF public.finance_candidate_command(p_value -> key) THEN
                RETURN true;
            END IF;
        END LOOP;
        RETURN false;
    END IF;
    IF jsonb_typeof(p_value) = 'array' THEN
        FOR item IN SELECT value FROM jsonb_array_elements(p_value) LOOP
            IF public.finance_candidate_command(item) THEN
                RETURN true;
            END IF;
        END LOOP;
    END IF;
    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_canonical_json(p_value jsonb) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
    kind text;
    item jsonb;
    key text;
    parts text[] := ARRAY[]::text[];
BEGIN
    IF p_value IS NULL OR jsonb_typeof(p_value) = 'null' THEN
        RETURN 'null';
    END IF;
    kind := jsonb_typeof(p_value);
    IF kind = 'boolean' OR kind = 'number' OR kind = 'string' THEN
        RETURN p_value::text;
    ELSIF kind = 'array' THEN
        FOR item IN SELECT value FROM jsonb_array_elements(p_value) LOOP
            parts := parts || ARRAY[public.finance_canonical_json(item)];
        END LOOP;
        RETURN '[' || array_to_string(parts, ',') || ']';
    ELSIF kind = 'object' THEN
        FOR key IN
            SELECT object_key
            FROM jsonb_object_keys(p_value) AS object_key
            ORDER BY object_key COLLATE "C"
        LOOP
            parts := parts || ARRAY[to_json(key)::text || ':' || public.finance_canonical_json(p_value -> key)];
        END LOOP;
        RETURN '{' || array_to_string(parts, ',') || '}';
    END IF;
    RAISE EXCEPTION 'strategy spec is invalid';
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_compile_strategy_candidate(p_candidate jsonb)
RETURNS TABLE (spec jsonb, digest text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_candidate IS NULL
        OR jsonb_typeof(p_candidate) <> 'object'
        OR public.finance_candidate_command(p_candidate)
        OR NOT public.finance_strategy_spec_v2(p_candidate) THEN
        RAISE EXCEPTION 'strategy spec is invalid';
    END IF;
    spec := p_candidate;
    digest := md5(public.finance_canonical_json(p_candidate));
    RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.finance_candidate_command(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_canonical_json(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_compile_strategy_candidate(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_compile_strategy_candidate(jsonb) TO app_user;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_candidate_command(jsonb) FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_canonical_json(jsonb) FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_compile_strategy_candidate(jsonb) FROM %I', r);
        END IF;
    END LOOP;
END $$;
