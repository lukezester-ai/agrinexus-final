-- Finance v1 foundation. Does not alter 001-005 and does not recreate 006-013.
-- Core link is organization_id plus the existing member/writer helpers.
-- Commands are the only write path. There is no broker or order execution.
-- Apply as a superuser: FORCE RLS would block the command body otherwise.

CREATE TABLE public.finance_instruments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    symbol text NOT NULL CHECK (btrim(symbol) <> ''),
    name text NOT NULL CHECK (btrim(name) <> ''),
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, symbol)
);

CREATE TABLE public.finance_market_bars (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    instrument_id uuid NOT NULL REFERENCES public.finance_instruments(id) ON DELETE CASCADE,
    bar_index integer NOT NULL CHECK (bar_index >= 0),
    bar_time timestamptz NOT NULL,
    open numeric NOT NULL,
    high numeric NOT NULL,
    low numeric NOT NULL,
    close numeric NOT NULL CHECK (close > 0),
    volume numeric NOT NULL CHECK (volume >= 0),
    CHECK (high >= low),
    CHECK (close BETWEEN low AND high),
    CHECK (open BETWEEN low AND high),
    UNIQUE (instrument_id, bar_index)
);

CREATE TABLE public.finance_strategies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    instrument_id uuid NOT NULL REFERENCES public.finance_instruments(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (btrim(name) <> ''),
    spec jsonb NOT NULL,
    lifecycle text NOT NULL DEFAULT 'draft' CHECK (lifecycle IN ('draft', 'validated', 'backtested')),
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_backtests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    strategy_id uuid NOT NULL UNIQUE REFERENCES public.finance_strategies(id) ON DELETE CASCADE,
    starting_cash numeric NOT NULL,
    ending_cash numeric NOT NULL,
    ending_quantity numeric NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_indicator_points (
    backtest_id uuid NOT NULL REFERENCES public.finance_backtests(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    bar_index integer NOT NULL,
    sma_fast numeric,
    sma_slow numeric,
    rsi numeric,
    signal boolean NOT NULL,
    PRIMARY KEY (backtest_id, bar_index)
);

CREATE TABLE public.finance_backtest_trades (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    backtest_id uuid NOT NULL REFERENCES public.finance_backtests(id) ON DELETE CASCADE,
    bar_index integer NOT NULL,
    side text NOT NULL CHECK (side IN ('buy', 'sell')),
    price numeric NOT NULL,
    quantity numeric NOT NULL,
    pnl numeric
);

CREATE TABLE public.finance_risk_metrics (
    backtest_id uuid PRIMARY KEY REFERENCES public.finance_backtests(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    trade_count integer NOT NULL,
    closed_pnl numeric NOT NULL,
    paper_pnl numeric NOT NULL,
    ending_equity numeric NOT NULL,
    total_return numeric NOT NULL,
    max_drawdown numeric NOT NULL
);

CREATE TABLE public.finance_paper_portfolios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (btrim(name) <> ''),
    cash numeric NOT NULL CHECK (cash >= 0),
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_paper_positions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    portfolio_id uuid NOT NULL REFERENCES public.finance_paper_portfolios(id) ON DELETE CASCADE,
    instrument_id uuid NOT NULL REFERENCES public.finance_instruments(id) ON DELETE CASCADE,
    quantity numeric NOT NULL CHECK (quantity >= 0),
    avg_price numeric NOT NULL,
    UNIQUE (portfolio_id, instrument_id)
);

CREATE TABLE public.finance_paper_trades (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    portfolio_id uuid NOT NULL REFERENCES public.finance_paper_portfolios(id) ON DELETE CASCADE,
    instrument_id uuid NOT NULL REFERENCES public.finance_instruments(id) ON DELETE CASCADE,
    backtest_id uuid NOT NULL REFERENCES public.finance_backtests(id) ON DELETE CASCADE,
    bar_index integer NOT NULL,
    side text NOT NULL CHECK (side IN ('buy', 'sell')),
    price numeric NOT NULL,
    quantity numeric NOT NULL,
    pnl numeric
);

CREATE TABLE public.finance_audit_log (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_user_id uuid NOT NULL,
    action text NOT NULL,
    subject_type text NOT NULL,
    subject_id uuid,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_finance_instruments_org ON public.finance_instruments (organization_id);
CREATE INDEX idx_finance_market_bars_instrument ON public.finance_market_bars (instrument_id, bar_index);
CREATE INDEX idx_finance_strategies_org ON public.finance_strategies (organization_id);
CREATE INDEX idx_finance_audit_org ON public.finance_audit_log (organization_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.finance_audit(
    p_organization_id uuid,
    p_action text,
    p_subject_type text,
    p_subject_id uuid,
    p_details jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.finance_audit_log (
        organization_id, actor_user_id, action, subject_type, subject_id, details
    ) VALUES (
        p_organization_id, auth.uid(), p_action, p_subject_type, p_subject_id, COALESCE(p_details, '{}'::jsonb)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_create_instrument(
    p_organization_id uuid,
    p_symbol text,
    p_name text
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
    INSERT INTO public.finance_instruments (organization_id, symbol, name, created_by)
    VALUES (p_organization_id, btrim(p_symbol), btrim(p_name), auth.uid())
    RETURNING id INTO new_id;
    PERFORM public.finance_audit(p_organization_id, 'instrument.created', 'finance_instrument', new_id, jsonb_build_object('symbol', btrim(p_symbol)));
    RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_replace_market_bars(
    p_instrument_id uuid,
    p_bars jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    org_id uuid;
    loaded integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    SELECT organization_id INTO org_id
    FROM public.finance_instruments
    WHERE id = p_instrument_id;
    IF org_id IS NULL THEN
        RAISE EXCEPTION 'instrument not found';
    END IF;
    IF NOT public.can_write_organization(org_id) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    IF jsonb_typeof(p_bars) <> 'array' OR jsonb_array_length(p_bars) < 50 THEN
        RAISE EXCEPTION 'market series needs at least 50 bars';
    END IF;
    DELETE FROM public.finance_market_bars WHERE instrument_id = p_instrument_id;
    INSERT INTO public.finance_market_bars (
        organization_id, instrument_id, bar_index, bar_time, open, high, low, close, volume
    )
    SELECT
        org_id,
        p_instrument_id,
        (bar->>'bar_index')::integer,
        (bar->>'bar_time')::timestamptz,
        (bar->>'open')::numeric,
        (bar->>'high')::numeric,
        (bar->>'low')::numeric,
        (bar->>'close')::numeric,
        (bar->>'volume')::numeric
    FROM jsonb_array_elements(p_bars) AS bar;
    SELECT count(*) INTO loaded FROM public.finance_market_bars WHERE instrument_id = p_instrument_id;
    IF loaded <> jsonb_array_length(p_bars) THEN
        RAISE EXCEPTION 'market bars were not stored one-to-one';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM public.finance_market_bars
        WHERE instrument_id = p_instrument_id
          AND bar_index <> (
            SELECT count(*) FROM public.finance_market_bars earlier
            WHERE earlier.instrument_id = p_instrument_id
              AND earlier.bar_index < finance_market_bars.bar_index
          )
    ) THEN
        RAISE EXCEPTION 'bar_index must be contiguous from 0';
    END IF;
    PERFORM public.finance_audit(org_id, 'market_bars.replaced', 'finance_instrument', p_instrument_id, jsonb_build_object('bars', loaded));
    RETURN loaded;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_v1_long_rule(p_spec jsonb) RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT p_spec = '{"version":1,"entry":"long","all":[{"op":"gt","left":{"sma":20},"right":{"sma":50}},{"op":"lt","left":{"rsi":14},"right":{"value":70}}]}'::jsonb;
$$;

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
    IF NOT public.finance_v1_long_rule(p_spec) THEN
        RAISE EXCEPTION 'strategy spec is not the v1 long rule';
    END IF;
    SELECT organization_id INTO org_id FROM public.finance_instruments WHERE id = p_instrument_id;
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
    IF current_lifecycle <> 'draft' OR NOT public.finance_v1_long_rule(rule_spec) THEN
        RAISE EXCEPTION 'only a draft v1 long rule can be validated';
    END IF;
    UPDATE public.finance_strategies SET lifecycle = 'validated' WHERE id = p_strategy_id;
    PERFORM public.finance_audit(org_id, 'strategy.validated', 'finance_strategy', p_strategy_id, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_run_backtest(p_strategy_id uuid) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    org_id uuid;
    instrument uuid;
    current_lifecycle text;
    closes numeric[];
    n integer;
    i integer;
    sma_fast numeric;
    sma_slow numeric;
    avg_gain numeric;
    avg_loss numeric;
    gain numeric;
    loss numeric;
    delta numeric;
    rsi_value numeric;
    is_signal boolean;
    cash numeric := 100000;
    quantity numeric := 0;
    entry_price numeric;
    closed_pnl numeric := 0;
    trade_count integer := 0;
    equity numeric;
    peak numeric;
    max_drawdown numeric := 0;
    drawdown numeric;
    unrealized numeric := 0;
    backtest_id uuid;
    g integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    SELECT organization_id, instrument_id, lifecycle
    INTO org_id, instrument, current_lifecycle
    FROM public.finance_strategies WHERE id = p_strategy_id;
    IF org_id IS NULL THEN
        RAISE EXCEPTION 'strategy not found';
    END IF;
    IF NOT public.can_write_organization(org_id) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    IF current_lifecycle <> 'validated' THEN
        RAISE EXCEPTION 'only a validated strategy can be backtested';
    END IF;
    SELECT array_agg(close ORDER BY bar_index) INTO closes
    FROM public.finance_market_bars WHERE instrument_id = instrument;
    n := COALESCE(array_length(closes, 1), 0);
    IF n < 50 THEN
        RAISE EXCEPTION 'v1 long rule needs at least 50 closes';
    END IF;

    INSERT INTO public.finance_backtests (organization_id, strategy_id, starting_cash, ending_cash, ending_quantity)
    VALUES (org_id, p_strategy_id, 100000, 100000, 0)
    RETURNING id INTO backtest_id;

    avg_gain := 0;
    avg_loss := 0;
    FOR g IN 1..14 LOOP
        delta := closes[g + 1] - closes[g];
        IF delta > 0 THEN
            avg_gain := avg_gain + delta;
        ELSE
            avg_loss := avg_loss + (-delta);
        END IF;
    END LOOP;
    avg_gain := avg_gain / 14;
    avg_loss := avg_loss / 14;

    peak := 100000;
    FOR i IN 1..n LOOP
        sma_fast := NULL;
        sma_slow := NULL;
        rsi_value := NULL;
        IF i >= 20 THEN
            SELECT round(avg(value), 6) INTO sma_fast FROM unnest(closes[i - 19:i]) AS value;
        END IF;
        IF i >= 50 THEN
            SELECT round(avg(value), 6) INTO sma_slow FROM unnest(closes[i - 49:i]) AS value;
        END IF;
        IF i = 15 THEN
            IF avg_loss = 0 THEN
                rsi_value := 100;
            ELSE
                rsi_value := round(100 - (100 / (1 + (avg_gain / avg_loss))), 6);
            END IF;
        ELSIF i > 15 THEN
            delta := closes[i] - closes[i - 1];
            gain := CASE WHEN delta > 0 THEN delta ELSE 0 END;
            loss := CASE WHEN delta < 0 THEN -delta ELSE 0 END;
            avg_gain := (avg_gain * 13 + gain) / 14;
            avg_loss := (avg_loss * 13 + loss) / 14;
            IF avg_loss = 0 THEN
                rsi_value := 100;
            ELSE
                rsi_value := round(100 - (100 / (1 + (avg_gain / avg_loss))), 6);
            END IF;
        END IF;
        is_signal := sma_fast IS NOT NULL AND sma_slow IS NOT NULL AND rsi_value IS NOT NULL
            AND sma_fast > sma_slow AND rsi_value < 70;
        IF quantity = 0 AND is_signal THEN
            quantity := 1;
            cash := cash - closes[i];
            entry_price := closes[i];
            INSERT INTO public.finance_backtest_trades (organization_id, backtest_id, bar_index, side, price, quantity, pnl)
            VALUES (org_id, backtest_id, i - 1, 'buy', closes[i], 1, NULL);
        ELSIF quantity = 1 AND NOT is_signal THEN
            closed_pnl := closed_pnl + (closes[i] - entry_price);
            trade_count := trade_count + 1;
            cash := cash + closes[i];
            INSERT INTO public.finance_backtest_trades (organization_id, backtest_id, bar_index, side, price, quantity, pnl)
            VALUES (org_id, backtest_id, i - 1, 'sell', closes[i], 1, round(closes[i] - entry_price, 6));
            quantity := 0;
            entry_price := NULL;
        END IF;
        equity := cash + quantity * closes[i];
        IF equity > peak THEN
            peak := equity;
        END IF;
        IF peak > 0 THEN
            drawdown := (peak - equity) / peak;
            IF drawdown > max_drawdown THEN
                max_drawdown := drawdown;
            END IF;
        END IF;
        INSERT INTO public.finance_indicator_points (
            backtest_id, organization_id, bar_index, sma_fast, sma_slow, rsi, signal
        ) VALUES (
            backtest_id, org_id, i - 1, sma_fast, sma_slow, rsi_value, is_signal
        );
    END LOOP;

    unrealized := 0;
    IF quantity = 1 THEN
        unrealized := closes[n] - entry_price;
    END IF;
    UPDATE public.finance_backtests
    SET ending_cash = round(cash, 6), ending_quantity = quantity
    WHERE id = backtest_id;
    INSERT INTO public.finance_risk_metrics (
        backtest_id, organization_id, trade_count, closed_pnl, paper_pnl, ending_equity, total_return, max_drawdown
    ) VALUES (
        backtest_id,
        org_id,
        trade_count,
        round(closed_pnl, 6),
        round(closed_pnl + unrealized, 6),
        round(equity, 6),
        round((equity - 100000) / 100000, 6),
        round(max_drawdown, 6)
    );
    UPDATE public.finance_strategies SET lifecycle = 'backtested' WHERE id = p_strategy_id;
    PERFORM public.finance_audit(org_id, 'backtest.completed', 'finance_backtest', backtest_id, jsonb_build_object('trades', trade_count));
    RETURN backtest_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_open_paper_portfolio(
    p_organization_id uuid,
    p_name text,
    p_cash numeric
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
    IF p_cash < 0 THEN
        RAISE EXCEPTION 'paper cash cannot be negative';
    END IF;
    INSERT INTO public.finance_paper_portfolios (organization_id, name, cash, created_by)
    VALUES (p_organization_id, btrim(p_name), p_cash, auth.uid())
    RETURNING id INTO new_id;
    PERFORM public.finance_audit(p_organization_id, 'paper.opened', 'finance_paper_portfolio', new_id, jsonb_build_object('cash', p_cash));
    RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_post_paper_from_backtest(
    p_portfolio_id uuid,
    p_backtest_id uuid
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    portfolio_org uuid;
    backtest_org uuid;
    instrument uuid;
    ending_cash numeric;
    paper_pnl numeric;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    SELECT organization_id INTO portfolio_org FROM public.finance_paper_portfolios WHERE id = p_portfolio_id;
    SELECT b.organization_id, s.instrument_id, b.ending_cash, r.paper_pnl
    INTO backtest_org, instrument, ending_cash, paper_pnl
    FROM public.finance_backtests b
    JOIN public.finance_strategies s ON s.id = b.strategy_id
    JOIN public.finance_risk_metrics r ON r.backtest_id = b.id
    WHERE b.id = p_backtest_id;
    IF portfolio_org IS NULL OR backtest_org IS NULL OR portfolio_org <> backtest_org THEN
        RAISE EXCEPTION 'paper portfolio and backtest must share an organization';
    END IF;
    IF NOT public.can_write_organization(portfolio_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    IF EXISTS (SELECT 1 FROM public.finance_paper_trades WHERE portfolio_id = p_portfolio_id) THEN
        RAISE EXCEPTION 'paper portfolio already has trades';
    END IF;
    INSERT INTO public.finance_paper_trades (
        organization_id, portfolio_id, instrument_id, backtest_id, bar_index, side, price, quantity, pnl
    )
    SELECT organization_id, p_portfolio_id, instrument, backtest_id, bar_index, side, price, quantity, pnl
    FROM public.finance_backtest_trades
    WHERE backtest_id = p_backtest_id;
    UPDATE public.finance_paper_portfolios SET cash = ending_cash WHERE id = p_portfolio_id;
    PERFORM public.finance_audit(portfolio_org, 'paper.posted', 'finance_paper_portfolio', p_portfolio_id, jsonb_build_object('backtest_id', p_backtest_id, 'paper_pnl', paper_pnl));
    RETURN paper_pnl;
END;
$$;

ALTER TABLE public.finance_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_market_bars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_backtests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_indicator_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_backtest_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_risk_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_paper_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_paper_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_paper_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_audit_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.finance_instruments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_market_bars FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_strategies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_backtests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_indicator_points FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_backtest_trades FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_risk_metrics FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_paper_portfolios FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_paper_positions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_paper_trades FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_audit_log FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_instruments_select ON public.finance_instruments FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));
CREATE POLICY finance_market_bars_select ON public.finance_market_bars FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));
CREATE POLICY finance_strategies_select ON public.finance_strategies FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));
CREATE POLICY finance_backtests_select ON public.finance_backtests FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));
CREATE POLICY finance_indicator_points_select ON public.finance_indicator_points FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));
CREATE POLICY finance_backtest_trades_select ON public.finance_backtest_trades FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));
CREATE POLICY finance_risk_metrics_select ON public.finance_risk_metrics FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));
CREATE POLICY finance_paper_portfolios_select ON public.finance_paper_portfolios FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));
CREATE POLICY finance_paper_positions_select ON public.finance_paper_positions FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));
CREATE POLICY finance_paper_trades_select ON public.finance_paper_trades FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));
CREATE POLICY finance_audit_select ON public.finance_audit_log FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_audit(uuid, text, text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_v1_long_rule(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_create_instrument(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_replace_market_bars(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_create_strategy(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_validate_strategy(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_run_backtest(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_open_paper_portfolio(uuid, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_post_paper_from_backtest(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.finance_create_instrument(uuid, text, text) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_replace_market_bars(uuid, jsonb) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_create_strategy(uuid, text, jsonb) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_validate_strategy(uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_run_backtest(uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_open_paper_portfolio(uuid, text, numeric) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_post_paper_from_backtest(uuid, uuid) TO app_user;

DO $$
DECLARE
    rel text;
BEGIN
    FOREACH rel IN ARRAY ARRAY[
        'finance_instruments',
        'finance_market_bars',
        'finance_strategies',
        'finance_backtests',
        'finance_indicator_points',
        'finance_backtest_trades',
        'finance_risk_metrics',
        'finance_paper_portfolios',
        'finance_paper_positions',
        'finance_paper_trades',
        'finance_audit_log'
    ] LOOP
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
            FOREACH rel IN ARRAY ARRAY[
                'finance_instruments',
                'finance_market_bars',
                'finance_strategies',
                'finance_backtests',
                'finance_indicator_points',
                'finance_backtest_trades',
                'finance_risk_metrics',
                'finance_paper_portfolios',
                'finance_paper_positions',
                'finance_paper_trades',
                'finance_audit_log'
            ] LOOP
                EXECUTE format('REVOKE ALL ON public.%I FROM %I', rel, r);
            END LOOP;
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_run_backtest(uuid) FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_post_paper_from_backtest(uuid, uuid) FROM %I', r);
        END IF;
    END LOOP;
END $$;
