-- Finance v1.2 gate 1. Does not alter 001-005 and does not recreate 006-013.
-- A screener filters an organization's 1d bars into a deterministic candidate set.
-- The same bars and the same rule produce the same digest. There is no AI and no broker.

CREATE TABLE public.finance_screeners (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (btrim(name) <> ''),
    spec jsonb NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_screener_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    screener_id uuid NOT NULL UNIQUE REFERENCES public.finance_screeners(id) ON DELETE CASCADE,
    candidate_count integer NOT NULL,
    result_digest text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_screener_candidates (
    run_id uuid NOT NULL REFERENCES public.finance_screener_runs(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    instrument_id uuid NOT NULL REFERENCES public.finance_instruments(id) ON DELETE CASCADE,
    exchange text NOT NULL,
    symbol text NOT NULL,
    close numeric NOT NULL,
    volume numeric NOT NULL,
    PRIMARY KEY (run_id, instrument_id),
    UNIQUE (run_id, exchange, symbol)
);

CREATE INDEX idx_finance_screeners_org ON public.finance_screeners (organization_id);
CREATE INDEX idx_finance_screener_runs_org ON public.finance_screener_runs (organization_id);
CREATE INDEX idx_finance_screener_candidates_org ON public.finance_screener_candidates (organization_id);

CREATE OR REPLACE FUNCTION public.finance_screen_operand(p_node jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
DECLARE
    key text;
    amount numeric;
BEGIN
    IF p_node IS NULL OR jsonb_typeof(p_node) <> 'object' THEN
        RETURN false;
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(p_node)) <> 1 THEN
        RETURN false;
    END IF;
    key := (SELECT k FROM jsonb_object_keys(p_node) AS k LIMIT 1);
    IF key IN ('close', 'volume') THEN
        RETURN jsonb_typeof(p_node->key) = 'boolean' AND (p_node->>key)::boolean IS TRUE;
    END IF;
    IF jsonb_typeof(p_node->key) <> 'number' THEN
        RETURN false;
    END IF;
    amount := (p_node->>key)::numeric;
    IF key <> 'value' AND amount <> trunc(amount) THEN
        RETURN false;
    END IF;
    IF key = 'value' THEN
        RETURN amount >= -1000000000 AND amount <= 1000000000;
    END IF;
    IF key IN ('sma', 'ema', 'momentum') THEN
        RETURN amount >= CASE WHEN key = 'momentum' THEN 1 ELSE 2 END AND amount <= 200;
    END IF;
    IF key = 'volatility' THEN
        RETURN amount >= 2 AND amount <= 200;
    END IF;
    IF key = 'rsi' THEN
        RETURN amount >= 2 AND amount <= 100;
    END IF;
    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_screen_comparison(p_node jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
BEGIN
    IF p_node IS NULL OR jsonb_typeof(p_node) <> 'object' THEN
        RETURN false;
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(p_node)) <> 3 THEN
        RETURN false;
    END IF;
    IF NOT (p_node ? 'op' AND p_node ? 'left' AND p_node ? 'right') THEN
        RETURN false;
    END IF;
    IF jsonb_typeof(p_node->'op') <> 'string' OR (p_node->>'op') NOT IN ('gt', 'gte', 'lt', 'lte') THEN
        RETURN false;
    END IF;
    RETURN public.finance_screen_operand(p_node->'left') AND public.finance_screen_operand(p_node->'right');
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_screen_clause(p_node jsonb, p_depth integer) RETURNS integer
LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
DECLARE
    key text;
    child jsonb;
    part integer;
    total integer := 0;
    child_key text;
BEGIN
    IF p_depth > 3 OR p_node IS NULL OR jsonb_typeof(p_node) <> 'object' THEN
        RETURN NULL;
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(p_node)) <> 1 THEN
        RETURN NULL;
    END IF;
    key := (SELECT k FROM jsonb_object_keys(p_node) AS k LIMIT 1);
    IF key NOT IN ('all', 'any') OR jsonb_typeof(p_node->key) <> 'array' THEN
        RETURN NULL;
    END IF;
    IF jsonb_array_length(p_node->key) < 1 OR jsonb_array_length(p_node->key) > 8 THEN
        RETURN NULL;
    END IF;
    FOR child IN SELECT value FROM jsonb_array_elements(p_node->key) LOOP
        child_key := NULL;
        IF jsonb_typeof(child) = 'object' AND (SELECT count(*) FROM jsonb_object_keys(child)) = 1 THEN
            child_key := (SELECT k FROM jsonb_object_keys(child) AS k LIMIT 1);
        END IF;
        IF child_key IN ('all', 'any') THEN
            part := public.finance_screen_clause(child, p_depth + 1);
        ELSIF public.finance_screen_comparison(child) THEN
            part := 1;
        ELSE
            RETURN NULL;
        END IF;
        IF part IS NULL THEN
            RETURN NULL;
        END IF;
        total := total + part;
        IF total > 8 THEN
            RETURN NULL;
        END IF;
    END LOOP;
    RETURN total;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_screen_spec(p_spec jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
DECLARE
    version_number numeric;
    comparison_count integer;
BEGIN
    IF p_spec IS NULL OR jsonb_typeof(p_spec) <> 'object' THEN
        RETURN false;
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(p_spec)) <> 2 THEN
        RETURN false;
    END IF;
    IF NOT (p_spec ? 'version' AND p_spec ? 'where') THEN
        RETURN false;
    END IF;
    IF jsonb_typeof(p_spec->'version') <> 'number' THEN
        RETURN false;
    END IF;
    version_number := (p_spec->>'version')::numeric;
    IF version_number <> 1 OR version_number <> trunc(version_number) THEN
        RETURN false;
    END IF;
    comparison_count := public.finance_screen_clause(p_spec->'where', 1);
    RETURN comparison_count IS NOT NULL AND comparison_count >= 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_screen_value(p_operand jsonb, p_snapshot jsonb) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
DECLARE
    key text;
BEGIN
    key := (SELECT k FROM jsonb_object_keys(p_operand) AS k LIMIT 1);
    IF key IN ('close', 'volume') THEN
        RETURN (p_snapshot->>key)::numeric;
    END IF;
    IF key = 'value' THEN
        RETURN (p_operand->>'value')::numeric;
    END IF;
    RETURN (p_snapshot->key->>(p_operand->>key))::numeric;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_screen_eval(p_node jsonb, p_snapshot jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
DECLARE
    child jsonb;
    left_value numeric;
    right_value numeric;
    op text;
BEGIN
    IF p_node ? 'all' THEN
        FOR child IN SELECT value FROM jsonb_array_elements(p_node->'all') LOOP
            IF NOT public.finance_screen_eval(child, p_snapshot) THEN
                RETURN false;
            END IF;
        END LOOP;
        RETURN true;
    END IF;
    IF p_node ? 'any' THEN
        FOR child IN SELECT value FROM jsonb_array_elements(p_node->'any') LOOP
            IF public.finance_screen_eval(child, p_snapshot) THEN
                RETURN true;
            END IF;
        END LOOP;
        RETURN false;
    END IF;
    op := p_node->>'op';
    left_value := public.finance_screen_value(p_node->'left', p_snapshot);
    right_value := public.finance_screen_value(p_node->'right', p_snapshot);
    IF left_value IS NULL OR right_value IS NULL THEN
        RETURN false;
    END IF;
    IF op = 'gt' THEN
        RETURN left_value > right_value;
    ELSIF op = 'gte' THEN
        RETURN left_value >= right_value;
    ELSIF op = 'lt' THEN
        RETURN left_value < right_value;
    ELSIF op = 'lte' THEN
        RETURN left_value <= right_value;
    END IF;
    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_create_screener(
    p_organization_id uuid,
    p_name text,
    p_spec jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    new_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF NOT public.can_write_organization(p_organization_id) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    IF NOT public.finance_screen_spec(p_spec) THEN
        RAISE EXCEPTION 'screener spec is invalid';
    END IF;
    INSERT INTO public.finance_screeners (organization_id, name, spec, created_by)
    VALUES (p_organization_id, btrim(p_name), p_spec, auth.uid())
    RETURNING id INTO new_id;
    PERFORM public.finance_audit(p_organization_id, 'screener.created', 'finance_screener', new_id, '{}'::jsonb);
    RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_run_screener(p_screener_id uuid) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    org_id uuid;
    rule_spec jsonb;
    new_run uuid;
    inst record;
    closes numeric[];
    volumes numeric[];
    n integer;
    min_bar integer;
    max_bar integer;
    sma_periods integer[];
    ema_periods integer[];
    rsi_periods integer[];
    momentum_periods integer[];
    volatility_periods integer[];
    indicator_period integer;
    series numeric[];
    sma_map jsonb;
    ema_map jsonb;
    rsi_map jsonb;
    momentum_map jsonb;
    volatility_map jsonb;
    last_value numeric;
    hi numeric;
    lo numeric;
    snapshot jsonb;
    payload text;
    digest text;
    passed_count integer := 0;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    SELECT s.organization_id, s.spec INTO org_id, rule_spec
    FROM public.finance_screeners s WHERE s.id = p_screener_id;
    IF org_id IS NULL THEN
        RAISE EXCEPTION 'screener not found';
    END IF;
    IF NOT public.can_write_organization(org_id) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    IF NOT public.finance_screen_spec(rule_spec) THEN
        RAISE EXCEPTION 'screener spec is invalid';
    END IF;
    SELECT COALESCE(array_agg(DISTINCT found_period), '{}') INTO sma_periods
    FROM unnest(public.finance_spec_periods(rule_spec->'where', 'sma')) AS found_period;
    SELECT COALESCE(array_agg(DISTINCT found_period), '{}') INTO ema_periods
    FROM unnest(public.finance_spec_periods(rule_spec->'where', 'ema')) AS found_period;
    SELECT COALESCE(array_agg(DISTINCT found_period), '{}') INTO rsi_periods
    FROM unnest(public.finance_spec_periods(rule_spec->'where', 'rsi')) AS found_period;
    SELECT COALESCE(array_agg(DISTINCT found_period), '{}') INTO momentum_periods
    FROM unnest(public.finance_spec_periods(rule_spec->'where', 'momentum')) AS found_period;
    SELECT COALESCE(array_agg(DISTINCT found_period), '{}') INTO volatility_periods
    FROM unnest(public.finance_spec_periods(rule_spec->'where', 'volatility')) AS found_period;

    DELETE FROM public.finance_screener_runs WHERE screener_id = p_screener_id;
    INSERT INTO public.finance_screener_runs (organization_id, screener_id, candidate_count, result_digest)
    VALUES (org_id, p_screener_id, 0, repeat('0', 32))
    RETURNING id INTO new_run;

    FOR inst IN
        SELECT i.id, i.exchange, i.symbol
        FROM public.finance_instruments i
        WHERE i.organization_id = org_id
          AND EXISTS (
              SELECT 1 FROM public.finance_market_bars bars
              WHERE bars.instrument_id = i.id AND bars.timeframe = '1d'
          )
        ORDER BY i.exchange, i.symbol
    LOOP
        IF position('|' IN inst.exchange) > 0 OR position('|' IN inst.symbol) > 0 THEN
            RAISE EXCEPTION 'screener symbol is invalid';
        END IF;
        SELECT array_agg(bars.close ORDER BY bars.bar_index),
               array_agg(bars.volume ORDER BY bars.bar_index),
               count(*),
               min(bars.bar_index),
               max(bars.bar_index)
        INTO closes, volumes, n, min_bar, max_bar
        FROM public.finance_market_bars bars
        WHERE bars.instrument_id = inst.id AND bars.timeframe = '1d';
        IF n < 1 OR min_bar <> 0 OR max_bar <> n - 1 THEN
            RAISE EXCEPTION 'screener needs a contiguous 1d series';
        END IF;
        sma_map := '{}'::jsonb;
        ema_map := '{}'::jsonb;
        rsi_map := '{}'::jsonb;
        momentum_map := '{}'::jsonb;
        volatility_map := '{}'::jsonb;
        FOREACH indicator_period IN ARRAY sma_periods LOOP
            series := public.finance_indicator_sma(closes, indicator_period);
            sma_map := sma_map || jsonb_build_object(indicator_period::text, to_jsonb(series[n]));
        END LOOP;
        FOREACH indicator_period IN ARRAY ema_periods LOOP
            series := public.finance_indicator_ema(closes, indicator_period);
            ema_map := ema_map || jsonb_build_object(indicator_period::text, to_jsonb(series[n]));
        END LOOP;
        FOREACH indicator_period IN ARRAY rsi_periods LOOP
            series := public.finance_indicator_rsi(closes, indicator_period);
            rsi_map := rsi_map || jsonb_build_object(indicator_period::text, to_jsonb(series[n]));
        END LOOP;
        FOREACH indicator_period IN ARRAY momentum_periods LOOP
            IF n <= indicator_period THEN
                last_value := NULL;
            ELSE
                last_value := round(closes[n] - closes[n - indicator_period], 6);
            END IF;
            momentum_map := momentum_map || jsonb_build_object(indicator_period::text, to_jsonb(last_value));
        END LOOP;
        FOREACH indicator_period IN ARRAY volatility_periods LOOP
            IF n < indicator_period OR closes[n] = 0 THEN
                last_value := NULL;
            ELSE
                SELECT max(value), min(value) INTO hi, lo
                FROM unnest(closes[n - indicator_period + 1:n]) AS value;
                last_value := round((hi - lo) / closes[n], 6);
            END IF;
            volatility_map := volatility_map || jsonb_build_object(indicator_period::text, to_jsonb(last_value));
        END LOOP;
        snapshot := jsonb_build_object(
            'close', to_jsonb(closes[n]),
            'volume', to_jsonb(volumes[n]),
            'sma', sma_map,
            'ema', ema_map,
            'rsi', rsi_map,
            'momentum', momentum_map,
            'volatility', volatility_map
        );
        IF public.finance_screen_eval(rule_spec->'where', snapshot) THEN
            INSERT INTO public.finance_screener_candidates (
                run_id, organization_id, instrument_id, exchange, symbol, close, volume
            ) VALUES (
                new_run, org_id, inst.id, inst.exchange, inst.symbol,
                round(closes[n], 6), round(volumes[n], 6)
            );
            passed_count := passed_count + 1;
        END IF;
    END LOOP;

    SELECT coalesce(string_agg(
        'C|' || candidates.exchange || '|' || candidates.symbol || '|'
        || candidates.close::text || '|' || candidates.volume::text,
        E'\n' ORDER BY candidates.exchange, candidates.symbol
    ), '')
    INTO payload
    FROM public.finance_screener_candidates candidates
    WHERE candidates.run_id = new_run;
    digest := md5(payload);
    UPDATE public.finance_screener_runs
    SET candidate_count = passed_count, result_digest = digest
    WHERE id = new_run;
    PERFORM public.finance_audit(org_id, 'screener.completed', 'finance_screener', p_screener_id, jsonb_build_object('digest', digest));
    RETURN new_run;
END;
$$;

ALTER TABLE public.finance_screeners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_screener_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_screener_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_screeners FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_screener_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_screener_candidates FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_screeners_select ON public.finance_screeners FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));
CREATE POLICY finance_screener_runs_select ON public.finance_screener_runs FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));
CREATE POLICY finance_screener_candidates_select ON public.finance_screener_candidates FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_screen_operand(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_screen_comparison(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_screen_clause(jsonb, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_screen_spec(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_screen_value(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_screen_eval(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_create_screener(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_run_screener(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_create_screener(uuid, text, jsonb) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_run_screener(uuid) TO app_user;

DO $$
DECLARE
    rel text;
BEGIN
    FOREACH rel IN ARRAY ARRAY['finance_screeners', 'finance_screener_runs', 'finance_screener_candidates'] LOOP
        EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', rel);
        EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM app_user', rel);
        EXECUTE format('GRANT SELECT ON public.%I TO app_user', rel);
    END LOOP;
END $$;

DO $$
DECLARE
    r text;
    rel text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            FOREACH rel IN ARRAY ARRAY['finance_screeners', 'finance_screener_runs', 'finance_screener_candidates'] LOOP
                EXECUTE format('REVOKE ALL ON public.%I FROM %I', rel, r);
            END LOOP;
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_create_screener(uuid, text, jsonb) FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_run_screener(uuid) FROM %I', r);
        END IF;
    END LOOP;
END $$;
