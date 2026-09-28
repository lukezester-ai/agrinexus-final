-- Finance v1.1 gate 2. Does not alter 001-005 and does not recreate 006-013.
-- Version 2 specs add AND/OR, entry/exit, SMA/EMA/RSI, and deterministic execution.
-- The v1 long rule and its backtest stay in place. There is no broker.

CREATE OR REPLACE FUNCTION public.finance_indicator_sma(p_closes numeric[], p_period integer) RETURNS numeric[]
LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
DECLARE
    n integer := COALESCE(array_length(p_closes, 1), 0);
    out numeric[];
BEGIN
    SELECT array_agg(val ORDER BY i) INTO out
    FROM (
        SELECT i,
            CASE
                WHEN i >= p_period THEN (
                    SELECT round(avg(value), 6) FROM unnest(p_closes[i - p_period + 1:i]) AS value
                )
                ELSE NULL
            END AS val
        FROM generate_series(1, n) AS i
    ) points;
    RETURN out;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_indicator_ema(p_closes numeric[], p_period integer) RETURNS numeric[]
LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
DECLARE
    n integer := COALESCE(array_length(p_closes, 1), 0);
    out numeric[] := '{}';
    i integer;
    previous numeric;
BEGIN
    FOR i IN 1..n LOOP
        IF i < p_period THEN
            out := out || ARRAY[NULL::numeric];
        ELSIF i = p_period THEN
            SELECT sum(value) / p_period INTO previous FROM unnest(p_closes[1:p_period]) AS value;
            out := out || ARRAY[round(previous, 6)];
        ELSE
            previous := (p_closes[i] - previous) * (2::numeric / (p_period + 1)) + previous;
            out := out || ARRAY[round(previous, 6)];
        END IF;
    END LOOP;
    RETURN out;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_indicator_rsi(p_closes numeric[], p_period integer) RETURNS numeric[]
LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
DECLARE
    n integer := COALESCE(array_length(p_closes, 1), 0);
    out numeric[] := '{}';
    i integer;
    g integer;
    delta numeric;
    gain numeric;
    loss numeric;
    avg_gain numeric := 0;
    avg_loss numeric := 0;
    published numeric;
BEGIN
    IF n <= p_period THEN
        RETURN array_fill(NULL::numeric, ARRAY[GREATEST(n, 0)]);
    END IF;
    FOR g IN 2..(p_period + 1) LOOP
        delta := p_closes[g] - p_closes[g - 1];
        IF delta > 0 THEN
            avg_gain := avg_gain + delta;
        ELSE
            avg_loss := avg_loss + (-delta);
        END IF;
    END LOOP;
    avg_gain := avg_gain / p_period;
    avg_loss := avg_loss / p_period;
    FOR i IN 1..n LOOP
        published := NULL;
        IF i = p_period + 1 THEN
            IF avg_loss = 0 THEN
                published := 100;
            ELSE
                published := round(100 - (100 / (1 + (avg_gain / avg_loss))), 6);
            END IF;
        ELSIF i > p_period + 1 THEN
            delta := p_closes[i] - p_closes[i - 1];
            gain := CASE WHEN delta > 0 THEN delta ELSE 0 END;
            loss := CASE WHEN delta < 0 THEN -delta ELSE 0 END;
            avg_gain := (avg_gain * (p_period - 1) + gain) / p_period;
            avg_loss := (avg_loss * (p_period - 1) + loss) / p_period;
            IF avg_loss = 0 THEN
                published := 100;
            ELSE
                published := round(100 - (100 / (1 + (avg_gain / avg_loss))), 6);
            END IF;
        END IF;
        out := out || ARRAY[published];
    END LOOP;
    RETURN out;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_spec_operand(p_node jsonb) RETURNS boolean
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
    IF key = 'close' THEN
        RETURN jsonb_typeof(p_node->'close') = 'boolean' AND (p_node->>'close')::boolean IS TRUE;
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
    IF key IN ('sma', 'ema') THEN
        RETURN amount >= 2 AND amount <= 200;
    END IF;
    IF key = 'rsi' THEN
        RETURN amount >= 2 AND amount <= 100;
    END IF;
    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_spec_comparison(p_node jsonb) RETURNS boolean
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
    RETURN public.finance_spec_operand(p_node->'left') AND public.finance_spec_operand(p_node->'right');
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_spec_clause(p_node jsonb, p_depth integer) RETURNS integer
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
            part := public.finance_spec_clause(child, p_depth + 1);
        ELSIF public.finance_spec_comparison(child) THEN
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

CREATE OR REPLACE FUNCTION public.finance_strategy_spec_v2(p_spec jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
DECLARE
    entry_count integer;
    exit_count integer;
    version_number numeric;
BEGIN
    IF p_spec IS NULL OR jsonb_typeof(p_spec) <> 'object' THEN
        RETURN false;
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(p_spec)) <> 3 THEN
        RETURN false;
    END IF;
    IF NOT (p_spec ? 'version' AND p_spec ? 'entry' AND p_spec ? 'exit') THEN
        RETURN false;
    END IF;
    IF jsonb_typeof(p_spec->'version') <> 'number' THEN
        RETURN false;
    END IF;
    version_number := (p_spec->>'version')::numeric;
    IF version_number <> 2 OR version_number <> trunc(version_number) THEN
        RETURN false;
    END IF;
    entry_count := public.finance_spec_clause(p_spec->'entry', 1);
    exit_count := public.finance_spec_clause(p_spec->'exit', 1);
    RETURN entry_count IS NOT NULL AND exit_count IS NOT NULL AND entry_count >= 1 AND exit_count >= 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_operand_value(p_operand jsonb, p_snapshot jsonb) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
DECLARE
    key text;
BEGIN
    key := (SELECT k FROM jsonb_object_keys(p_operand) AS k LIMIT 1);
    IF key = 'close' THEN
        RETURN (p_snapshot->>'close')::numeric;
    END IF;
    IF key = 'value' THEN
        RETURN (p_operand->>'value')::numeric;
    END IF;
    RETURN (p_snapshot->key->>(p_operand->>key))::numeric;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_eval_rule(p_node jsonb, p_snapshot jsonb) RETURNS boolean
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
            IF NOT public.finance_eval_rule(child, p_snapshot) THEN
                RETURN false;
            END IF;
        END LOOP;
        RETURN true;
    END IF;
    IF p_node ? 'any' THEN
        FOR child IN SELECT value FROM jsonb_array_elements(p_node->'any') LOOP
            IF public.finance_eval_rule(child, p_snapshot) THEN
                RETURN true;
            END IF;
        END LOOP;
        RETURN false;
    END IF;
    op := p_node->>'op';
    left_value := public.finance_operand_value(p_node->'left', p_snapshot);
    right_value := public.finance_operand_value(p_node->'right', p_snapshot);
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

CREATE OR REPLACE FUNCTION public.finance_spec_periods(p_node jsonb, p_kind text) RETURNS integer[]
LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
DECLARE
    key text;
    child jsonb;
    found integer[] := '{}';
BEGIN
    IF p_node IS NULL OR jsonb_typeof(p_node) <> 'object' THEN
        RETURN found;
    END IF;
    IF (SELECT count(*) FROM jsonb_object_keys(p_node)) = 1 THEN
        key := (SELECT k FROM jsonb_object_keys(p_node) AS k LIMIT 1);
        IF key IN ('all', 'any') THEN
            FOR child IN SELECT value FROM jsonb_array_elements(p_node->key) LOOP
                found := found || public.finance_spec_periods(child, p_kind);
            END LOOP;
            RETURN found;
        END IF;
    END IF;
    IF p_node ? 'left' THEN
        IF p_node->'left' ? p_kind THEN
            found := found || ARRAY[(p_node->'left'->>p_kind)::integer];
        END IF;
        IF p_node->'right' ? p_kind THEN
            found := found || ARRAY[(p_node->'right'->>p_kind)::integer];
        END IF;
    END IF;
    RETURN found;
END;
$$;

CREATE TABLE public.finance_spec_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    strategy_id uuid NOT NULL UNIQUE REFERENCES public.finance_strategies(id) ON DELETE CASCADE,
    bar_count integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_spec_signals (
    run_id uuid NOT NULL REFERENCES public.finance_spec_runs(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    bar_index integer NOT NULL,
    entry_on boolean NOT NULL,
    exit_on boolean NOT NULL,
    position integer NOT NULL CHECK (position IN (0, 1)),
    PRIMARY KEY (run_id, bar_index)
);

CREATE INDEX idx_finance_spec_runs_org ON public.finance_spec_runs (organization_id);

CREATE OR REPLACE FUNCTION public.finance_create_strategy(
    p_instrument_id uuid,
    p_name text,
    p_spec jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    org_id uuid;
    new_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF NOT public.finance_v1_long_rule(p_spec) AND NOT public.finance_strategy_spec_v2(p_spec) THEN
        RAISE EXCEPTION 'strategy spec is invalid';
    END IF;
    SELECT i.organization_id INTO org_id FROM public.finance_instruments i WHERE i.id = p_instrument_id;
    IF org_id IS NULL THEN
        RAISE EXCEPTION 'instrument not found';
    END IF;
    IF NOT public.can_write_organization(org_id) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    INSERT INTO public.finance_strategies (organization_id, instrument_id, name, spec, lifecycle, created_by)
    VALUES (org_id, p_instrument_id, btrim(p_name), p_spec, 'draft', auth.uid())
    RETURNING id INTO new_id;
    PERFORM public.finance_audit(org_id, 'strategy.created', 'finance_strategy', new_id, '{}'::jsonb);
    RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_validate_strategy(p_strategy_id uuid) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    org_id uuid;
    current_lifecycle text;
    rule_spec jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    SELECT s.organization_id, s.lifecycle, s.spec INTO org_id, current_lifecycle, rule_spec
    FROM public.finance_strategies s WHERE s.id = p_strategy_id;
    IF org_id IS NULL THEN
        RAISE EXCEPTION 'strategy not found';
    END IF;
    IF NOT public.can_write_organization(org_id) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    IF current_lifecycle <> 'draft' OR NOT (public.finance_v1_long_rule(rule_spec) OR public.finance_strategy_spec_v2(rule_spec)) THEN
        RAISE EXCEPTION 'only a draft strategy spec can be validated';
    END IF;
    UPDATE public.finance_strategies SET lifecycle = 'validated' WHERE id = p_strategy_id;
    PERFORM public.finance_audit(org_id, 'strategy.validated', 'finance_strategy', p_strategy_id, '{}'::jsonb);
END;
$$;

ALTER FUNCTION public.finance_run_backtest(uuid) RENAME TO finance_run_backtest_v1_body;

CREATE OR REPLACE FUNCTION public.finance_run_backtest(p_strategy_id uuid) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    rule_spec jsonb;
BEGIN
    SELECT s.spec INTO rule_spec FROM public.finance_strategies s WHERE s.id = p_strategy_id;
    IF rule_spec IS NOT NULL AND NOT public.finance_v1_long_rule(rule_spec) THEN
        RAISE EXCEPTION 'v1 backtest only runs the v1 long rule';
    END IF;
    RETURN public.finance_run_backtest_v1_body(p_strategy_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_execute_strategy(p_strategy_id uuid) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    org_id uuid;
    instrument uuid;
    current_lifecycle text;
    rule_spec jsonb;
    closes numeric[];
    n integer;
    i integer;
    run_id uuid;
    sma_periods integer[];
    ema_periods integer[];
    rsi_periods integer[];
    indicator_period integer;
    sma_store jsonb := '{}'::jsonb;
    ema_store jsonb := '{}'::jsonb;
    rsi_store jsonb := '{}'::jsonb;
    sma_bar jsonb;
    ema_bar jsonb;
    rsi_bar jsonb;
    raw text;
    snapshot jsonb;
    entry_on boolean;
    exit_on boolean;
    position integer := 0;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    SELECT s.organization_id, s.instrument_id, s.lifecycle, s.spec
    INTO org_id, instrument, current_lifecycle, rule_spec
    FROM public.finance_strategies s WHERE s.id = p_strategy_id;
    IF org_id IS NULL THEN
        RAISE EXCEPTION 'strategy not found';
    END IF;
    IF NOT public.can_write_organization(org_id) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    IF current_lifecycle <> 'validated' OR NOT public.finance_strategy_spec_v2(rule_spec) THEN
        RAISE EXCEPTION 'only a validated version 2 spec can be executed';
    END IF;
    SELECT array_agg(bars.close ORDER BY bars.bar_index) INTO closes
    FROM public.finance_market_bars bars
    WHERE bars.instrument_id = instrument AND bars.timeframe = '1d';
    n := COALESCE(array_length(closes, 1), 0);
    IF n < 1 THEN
        RAISE EXCEPTION 'strategy execution needs market bars';
    END IF;
    SELECT COALESCE(array_agg(DISTINCT found_period), '{}') INTO sma_periods
    FROM unnest(public.finance_spec_periods(rule_spec->'entry', 'sma') || public.finance_spec_periods(rule_spec->'exit', 'sma')) AS found_period;
    SELECT COALESCE(array_agg(DISTINCT found_period), '{}') INTO ema_periods
    FROM unnest(public.finance_spec_periods(rule_spec->'entry', 'ema') || public.finance_spec_periods(rule_spec->'exit', 'ema')) AS found_period;
    SELECT COALESCE(array_agg(DISTINCT found_period), '{}') INTO rsi_periods
    FROM unnest(public.finance_spec_periods(rule_spec->'entry', 'rsi') || public.finance_spec_periods(rule_spec->'exit', 'rsi')) AS found_period;
    FOREACH indicator_period IN ARRAY sma_periods LOOP
        sma_store := sma_store || jsonb_build_object(indicator_period::text, to_jsonb(public.finance_indicator_sma(closes, indicator_period)));
    END LOOP;
    FOREACH indicator_period IN ARRAY ema_periods LOOP
        ema_store := ema_store || jsonb_build_object(indicator_period::text, to_jsonb(public.finance_indicator_ema(closes, indicator_period)));
    END LOOP;
    FOREACH indicator_period IN ARRAY rsi_periods LOOP
        rsi_store := rsi_store || jsonb_build_object(indicator_period::text, to_jsonb(public.finance_indicator_rsi(closes, indicator_period)));
    END LOOP;
    DELETE FROM public.finance_spec_runs WHERE strategy_id = p_strategy_id;
    INSERT INTO public.finance_spec_runs (organization_id, strategy_id, bar_count)
    VALUES (org_id, p_strategy_id, n)
    RETURNING id INTO run_id;
    FOR i IN 1..n LOOP
        sma_bar := '{}'::jsonb;
        ema_bar := '{}'::jsonb;
        rsi_bar := '{}'::jsonb;
        FOREACH indicator_period IN ARRAY sma_periods LOOP
            raw := sma_store->indicator_period::text->>(i - 1);
            sma_bar := sma_bar || jsonb_build_object(indicator_period::text, CASE WHEN raw IS NULL THEN NULL ELSE raw::numeric END);
        END LOOP;
        FOREACH indicator_period IN ARRAY ema_periods LOOP
            raw := ema_store->indicator_period::text->>(i - 1);
            ema_bar := ema_bar || jsonb_build_object(indicator_period::text, CASE WHEN raw IS NULL THEN NULL ELSE raw::numeric END);
        END LOOP;
        FOREACH indicator_period IN ARRAY rsi_periods LOOP
            raw := rsi_store->indicator_period::text->>(i - 1);
            rsi_bar := rsi_bar || jsonb_build_object(indicator_period::text, CASE WHEN raw IS NULL THEN NULL ELSE raw::numeric END);
        END LOOP;
        snapshot := jsonb_build_object('close', closes[i], 'sma', sma_bar, 'ema', ema_bar, 'rsi', rsi_bar);
        entry_on := public.finance_eval_rule(rule_spec->'entry', snapshot);
        exit_on := public.finance_eval_rule(rule_spec->'exit', snapshot);
        IF position = 0 AND entry_on THEN
            position := 1;
        ELSIF position = 1 AND exit_on THEN
            position := 0;
        END IF;
        INSERT INTO public.finance_spec_signals (run_id, organization_id, bar_index, entry_on, exit_on, position)
        VALUES (run_id, org_id, i - 1, entry_on, exit_on, position);
    END LOOP;
    PERFORM public.finance_audit(org_id, 'strategy.executed', 'finance_strategy', p_strategy_id, jsonb_build_object('bars', n));
    RETURN run_id;
END;
$$;

ALTER TABLE public.finance_spec_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_spec_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_spec_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_spec_signals FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_spec_runs_select ON public.finance_spec_runs FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));
CREATE POLICY finance_spec_signals_select ON public.finance_spec_signals FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_indicator_sma(numeric[], integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_indicator_ema(numeric[], integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_indicator_rsi(numeric[], integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_spec_operand(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_spec_comparison(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_spec_clause(jsonb, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_strategy_spec_v2(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_operand_value(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_eval_rule(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_spec_periods(jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_run_backtest_v1_body(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_execute_strategy(uuid) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.finance_run_backtest_v1_body(uuid) FROM app_user;
REVOKE ALL ON FUNCTION public.finance_run_backtest(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_run_backtest(uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_execute_strategy(uuid) TO app_user;

DO $$
DECLARE
    rel text;
BEGIN
    FOREACH rel IN ARRAY ARRAY['finance_spec_runs', 'finance_spec_signals'] LOOP
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
            FOREACH rel IN ARRAY ARRAY['finance_spec_runs', 'finance_spec_signals'] LOOP
                EXECUTE format('REVOKE ALL ON public.%I FROM %I', rel, r);
            END LOOP;
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_execute_strategy(uuid) FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_run_backtest(uuid) FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_run_backtest_v1_body(uuid) FROM %I', r);
        END IF;
    END LOOP;
END $$;
