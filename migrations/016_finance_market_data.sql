-- Finance v1.1 gate 1. Does not alter 001-005 and does not recreate 006-013.
-- Extends the finance market surface: exchange metadata, timeframe, fixture ingestion, watchlists.
-- The v1 backtest keeps reading the 1d series only. There is no broker and no network provider.

ALTER TABLE public.finance_instruments
    ADD COLUMN exchange text NOT NULL DEFAULT 'NONE',
    ADD COLUMN asset_class text NOT NULL DEFAULT 'equity',
    ADD COLUMN currency text NOT NULL DEFAULT 'USD';

ALTER TABLE public.finance_instruments
    DROP CONSTRAINT finance_instruments_organization_id_symbol_key;

ALTER TABLE public.finance_instruments
    ADD CONSTRAINT finance_instruments_org_exchange_symbol_key UNIQUE (organization_id, exchange, symbol);

ALTER TABLE public.finance_instruments
    ADD CONSTRAINT finance_instruments_exchange_code CHECK (exchange ~ '^[A-Z0-9][A-Z0-9._-]{0,15}$'),
    ADD CONSTRAINT finance_instruments_asset_class CHECK (asset_class IN ('equity', 'etf', 'fx', 'crypto', 'index')),
    ADD CONSTRAINT finance_instruments_currency CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE public.finance_market_bars
    ADD COLUMN timeframe text NOT NULL DEFAULT '1d';

ALTER TABLE public.finance_market_bars
    DROP CONSTRAINT finance_market_bars_instrument_id_bar_index_key;

ALTER TABLE public.finance_market_bars
    ADD CONSTRAINT finance_market_bars_series_key UNIQUE (instrument_id, timeframe, bar_index),
    ADD CONSTRAINT finance_market_bars_timeframe CHECK (timeframe IN ('1m', '5m', '15m', '1h', '1d', '1w'));

CREATE TABLE public.finance_data_providers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (btrim(name) <> ''),
    kind text NOT NULL CHECK (kind = 'fixture'),
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, name)
);

CREATE TABLE public.finance_watchlists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (btrim(name) <> ''),
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, name)
);

CREATE TABLE public.finance_watchlist_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    watchlist_id uuid NOT NULL REFERENCES public.finance_watchlists(id) ON DELETE CASCADE,
    instrument_id uuid NOT NULL REFERENCES public.finance_instruments(id) ON DELETE CASCADE,
    position integer NOT NULL CHECK (position >= 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (watchlist_id, instrument_id),
    UNIQUE (watchlist_id, position)
);

CREATE INDEX idx_finance_data_providers_org ON public.finance_data_providers (organization_id);
CREATE INDEX idx_finance_watchlists_org ON public.finance_watchlists (organization_id);
CREATE INDEX idx_finance_market_bars_series ON public.finance_market_bars (instrument_id, timeframe, bar_index);

CREATE OR REPLACE FUNCTION public.finance_register_instrument(
    p_organization_id uuid,
    p_symbol text,
    p_name text,
    p_exchange text,
    p_asset_class text,
    p_currency text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    new_id uuid;
    symbol_code text;
    exchange_code text;
    currency_code text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF NOT public.can_write_organization(p_organization_id) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    symbol_code := upper(btrim(p_symbol));
    exchange_code := upper(btrim(p_exchange));
    currency_code := upper(btrim(p_currency));
    IF symbol_code = '' OR symbol_code !~ '^[A-Z0-9][A-Z0-9._-]{0,15}$' THEN
        RAISE EXCEPTION 'symbol is invalid';
    END IF;
    IF exchange_code !~ '^[A-Z0-9][A-Z0-9._-]{0,15}$' THEN
        RAISE EXCEPTION 'exchange code is invalid';
    END IF;
    IF p_asset_class NOT IN ('equity', 'etf', 'fx', 'crypto', 'index') THEN
        RAISE EXCEPTION 'asset class is not supported';
    END IF;
    IF currency_code !~ '^[A-Z]{3}$' THEN
        RAISE EXCEPTION 'currency must be three letters';
    END IF;
    INSERT INTO public.finance_instruments (
        organization_id, symbol, name, exchange, asset_class, currency, created_by
    ) VALUES (
        p_organization_id, symbol_code, btrim(p_name), exchange_code, p_asset_class, currency_code, auth.uid()
    )
    RETURNING id INTO new_id;
    PERFORM public.finance_audit(
        p_organization_id,
        'instrument.registered',
        'finance_instrument',
        new_id,
        jsonb_build_object('symbol', symbol_code, 'exchange', exchange_code, 'asset_class', p_asset_class)
    );
    RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_register_data_provider(
    p_organization_id uuid,
    p_name text,
    p_kind text
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
    IF p_kind <> 'fixture' THEN
        RAISE EXCEPTION 'only the fixture data provider is available';
    END IF;
    IF btrim(p_name) = '' THEN
        RAISE EXCEPTION 'provider name is required';
    END IF;
    INSERT INTO public.finance_data_providers (organization_id, name, kind, created_by)
    VALUES (p_organization_id, btrim(p_name), 'fixture', auth.uid())
    RETURNING id INTO new_id;
    PERFORM public.finance_audit(
        p_organization_id,
        'provider.registered',
        'finance_data_provider',
        new_id,
        jsonb_build_object('name', btrim(p_name), 'kind', 'fixture')
    );
    RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_ingest_market_bars(
    p_instrument_id uuid,
    p_timeframe text,
    p_provider_id uuid,
    p_bars jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    instrument_org uuid;
    provider_org uuid;
    provider_kind text;
    loaded integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF p_timeframe NOT IN ('1m', '5m', '15m', '1h', '1d', '1w') THEN
        RAISE EXCEPTION 'timeframe is not supported';
    END IF;
    SELECT i.organization_id INTO instrument_org
    FROM public.finance_instruments i
    WHERE i.id = p_instrument_id;
    SELECT p.organization_id, p.kind INTO provider_org, provider_kind
    FROM public.finance_data_providers p
    WHERE p.id = p_provider_id;
    IF instrument_org IS NULL OR provider_org IS NULL OR instrument_org <> provider_org THEN
        RAISE EXCEPTION 'instrument and data provider must share an organization';
    END IF;
    IF provider_kind <> 'fixture' THEN
        RAISE EXCEPTION 'only the fixture data provider is available';
    END IF;
    IF NOT public.can_write_organization(instrument_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    IF jsonb_typeof(p_bars) <> 'array' OR jsonb_array_length(p_bars) < 1 THEN
        RAISE EXCEPTION 'market series is empty';
    END IF;
    DELETE FROM public.finance_market_bars
    WHERE instrument_id = p_instrument_id AND timeframe = p_timeframe;
    INSERT INTO public.finance_market_bars (
        organization_id, instrument_id, timeframe, bar_index, bar_time, open, high, low, close, volume
    )
    SELECT
        instrument_org,
        p_instrument_id,
        p_timeframe,
        (bar->>'bar_index')::integer,
        (bar->>'bar_time')::timestamptz,
        (bar->>'open')::numeric,
        (bar->>'high')::numeric,
        (bar->>'low')::numeric,
        (bar->>'close')::numeric,
        (bar->>'volume')::numeric
    FROM jsonb_array_elements(p_bars) AS bar;
    SELECT count(*) INTO loaded
    FROM public.finance_market_bars
    WHERE instrument_id = p_instrument_id AND timeframe = p_timeframe;
    IF loaded <> jsonb_array_length(p_bars) THEN
        RAISE EXCEPTION 'market bars were not stored one-to-one';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM public.finance_market_bars bars
        WHERE bars.instrument_id = p_instrument_id
          AND bars.timeframe = p_timeframe
          AND bars.bar_index <> (
            SELECT count(*) FROM public.finance_market_bars earlier
            WHERE earlier.instrument_id = bars.instrument_id
              AND earlier.timeframe = bars.timeframe
              AND earlier.bar_index < bars.bar_index
          )
    ) THEN
        RAISE EXCEPTION 'bar_index must be contiguous from 0';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM public.finance_market_bars bars
        JOIN public.finance_market_bars earlier
          ON earlier.instrument_id = bars.instrument_id
         AND earlier.timeframe = bars.timeframe
         AND earlier.bar_index = bars.bar_index - 1
        WHERE bars.instrument_id = p_instrument_id
          AND bars.timeframe = p_timeframe
          AND earlier.bar_time >= bars.bar_time
    ) THEN
        RAISE EXCEPTION 'bar_time must increase with bar_index';
    END IF;
    PERFORM public.finance_audit(
        instrument_org,
        'market_bars.ingested',
        'finance_instrument',
        p_instrument_id,
        jsonb_build_object('timeframe', p_timeframe, 'bars', loaded, 'provider_id', p_provider_id)
    );
    RETURN loaded;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_create_watchlist(
    p_organization_id uuid,
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
    INSERT INTO public.finance_watchlists (organization_id, name, created_by)
    VALUES (p_organization_id, btrim(p_name), auth.uid())
    RETURNING id INTO new_id;
    PERFORM public.finance_audit(p_organization_id, 'watchlist.created', 'finance_watchlist', new_id, jsonb_build_object('name', btrim(p_name)));
    RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_add_watchlist_instrument(
    p_watchlist_id uuid,
    p_instrument_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    watch_org uuid;
    instrument_org uuid;
    next_position integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    SELECT w.organization_id INTO watch_org
    FROM public.finance_watchlists w
    WHERE w.id = p_watchlist_id;
    SELECT i.organization_id INTO instrument_org
    FROM public.finance_instruments i
    WHERE i.id = p_instrument_id;
    IF watch_org IS NULL OR instrument_org IS NULL OR watch_org <> instrument_org THEN
        RAISE EXCEPTION 'watchlist and instrument must share an organization';
    END IF;
    IF NOT public.can_write_organization(watch_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    SELECT COALESCE(max(items.position) + 1, 0) INTO next_position
    FROM public.finance_watchlist_items items
    WHERE items.watchlist_id = p_watchlist_id;
    INSERT INTO public.finance_watchlist_items (organization_id, watchlist_id, instrument_id, position)
    VALUES (watch_org, p_watchlist_id, p_instrument_id, next_position);
    PERFORM public.finance_audit(
        watch_org,
        'watchlist.instrument_added',
        'finance_watchlist',
        p_watchlist_id,
        jsonb_build_object('instrument_id', p_instrument_id, 'position', next_position)
    );
    RETURN next_position;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_remove_watchlist_instrument(
    p_watchlist_id uuid,
    p_instrument_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    watch_org uuid;
    removed integer;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    SELECT w.organization_id INTO watch_org
    FROM public.finance_watchlists w
    WHERE w.id = p_watchlist_id;
    IF watch_org IS NULL THEN
        RAISE EXCEPTION 'watchlist not found';
    END IF;
    IF NOT public.can_write_organization(watch_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    DELETE FROM public.finance_watchlist_items
    WHERE watchlist_id = p_watchlist_id AND instrument_id = p_instrument_id;
    GET DIAGNOSTICS removed = ROW_COUNT;
    IF removed <> 1 THEN
        RAISE EXCEPTION 'watchlist item not found';
    END IF;
    PERFORM public.finance_audit(
        watch_org,
        'watchlist.instrument_removed',
        'finance_watchlist',
        p_watchlist_id,
        jsonb_build_object('instrument_id', p_instrument_id)
    );
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
    SELECT s.organization_id, s.instrument_id, s.lifecycle
    INTO org_id, instrument, current_lifecycle
    FROM public.finance_strategies s WHERE s.id = p_strategy_id;
    IF org_id IS NULL THEN
        RAISE EXCEPTION 'strategy not found';
    END IF;
    IF NOT public.can_write_organization(org_id) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    IF current_lifecycle <> 'validated' THEN
        RAISE EXCEPTION 'only a validated strategy can be backtested';
    END IF;
    SELECT array_agg(bars.close ORDER BY bars.bar_index) INTO closes
    FROM public.finance_market_bars bars
    WHERE bars.instrument_id = instrument AND bars.timeframe = '1d';
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

ALTER TABLE public.finance_data_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_data_providers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_watchlists FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_watchlist_items FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_data_providers_select ON public.finance_data_providers FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));
CREATE POLICY finance_watchlists_select ON public.finance_watchlists FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));
CREATE POLICY finance_watchlist_items_select ON public.finance_watchlist_items FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_register_instrument(uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_register_data_provider(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_ingest_market_bars(uuid, text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_create_watchlist(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_add_watchlist_instrument(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_remove_watchlist_instrument(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.finance_register_instrument(uuid, text, text, text, text, text) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_register_data_provider(uuid, text, text) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_ingest_market_bars(uuid, text, uuid, jsonb) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_create_watchlist(uuid, text) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_add_watchlist_instrument(uuid, uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_remove_watchlist_instrument(uuid, uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_run_backtest(uuid) TO app_user;

DO $$
DECLARE
    rel text;
BEGIN
    FOREACH rel IN ARRAY ARRAY[
        'finance_data_providers',
        'finance_watchlists',
        'finance_watchlist_items'
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
                'finance_data_providers',
                'finance_watchlists',
                'finance_watchlist_items'
            ] LOOP
                EXECUTE format('REVOKE ALL ON public.%I FROM %I', rel, r);
            END LOOP;
        END IF;
    END LOOP;
END $$;
