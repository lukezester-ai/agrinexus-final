-- Finance copilot v1 gate B. Does not alter 001-005 and does not recreate 006-022.
-- A model candidate becomes a strategy only through the existing compiler, validator,
-- snapshot run, backtest, and paper book. This function does not calculate indicators.

CREATE OR REPLACE FUNCTION public.finance_run_compiled_strategy(
    p_snapshot_id uuid,
    p_instrument_id uuid,
    p_name text,
    p_candidate jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    canonical jsonb;
    spec_digest text;
    strategy_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    SELECT compiled.spec, compiled.digest
    INTO canonical, spec_digest
    FROM public.finance_compile_strategy_candidate(p_candidate) AS compiled;
    IF canonical IS NULL
        OR spec_digest IS NULL
        OR spec_digest <> md5(public.finance_canonical_json(canonical)) THEN
        RAISE EXCEPTION 'strategy spec is invalid';
    END IF;
    strategy_id := public.finance_create_strategy(p_instrument_id, p_name, canonical);
    PERFORM public.finance_validate_strategy(strategy_id);
    RETURN public.finance_run_snapshot_strategy(p_snapshot_id, strategy_id);
END;
$$;

REVOKE ALL ON FUNCTION public.finance_run_compiled_strategy(uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_run_compiled_strategy(uuid, uuid, text, jsonb) TO app_user;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_run_compiled_strategy(uuid, uuid, text, jsonb) FROM %I',
                r
            );
        END IF;
    END LOOP;
END $$;
