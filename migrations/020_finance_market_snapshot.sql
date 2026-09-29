-- Finance v1.2 gate 2. Does not alter 001-005 and does not recreate 006-013.
-- A snapshot records the screener's own indicator state at a bar cutoff.
-- The same bars, cutoff, and rule produce the same digest. There is no AI and no broker.

CREATE TABLE public.finance_market_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    screener_id uuid NOT NULL REFERENCES public.finance_screeners(id) ON DELETE CASCADE,
    as_of timestamptz,
    result_digest text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_snapshot_states (
    snapshot_id uuid NOT NULL REFERENCES public.finance_market_snapshots(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    instrument_id uuid NOT NULL REFERENCES public.finance_instruments(id) ON DELETE CASCADE,
    exchange text NOT NULL,
    symbol text NOT NULL,
    bar_index integer NOT NULL,
    bar_time timestamptz NOT NULL,
    price numeric NOT NULL,
    volume numeric NOT NULL,
    included boolean NOT NULL,
    PRIMARY KEY (snapshot_id, instrument_id)
);

CREATE TABLE public.finance_snapshot_features (
    snapshot_id uuid NOT NULL REFERENCES public.finance_market_snapshots(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    instrument_id uuid NOT NULL,
    kind text NOT NULL CHECK (kind IN ('sma', 'ema', 'rsi', 'momentum', 'volatility')),
    period integer NOT NULL CHECK (period > 0),
    value numeric,
    PRIMARY KEY (snapshot_id, instrument_id, kind, period),
    FOREIGN KEY (snapshot_id, instrument_id)
        REFERENCES public.finance_snapshot_states (snapshot_id, instrument_id) ON DELETE CASCADE
);

CREATE INDEX idx_finance_market_snapshots_org ON public.finance_market_snapshots (organization_id);
CREATE INDEX idx_finance_snapshot_states_org ON public.finance_snapshot_states (organization_id);
CREATE INDEX idx_finance_snapshot_features_org ON public.finance_snapshot_features (organization_id);

CREATE OR REPLACE FUNCTION public.finance_money_text(p_value numeric) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = ''
AS $$
DECLARE
    amount numeric;
    whole numeric;
    fraction numeric;
BEGIN
    IF p_value IS NULL THEN
        RETURN '';
    END IF;
    amount := round(p_value, 6);
    whole := trunc(abs(amount));
    fraction := trunc((abs(amount) - whole) * 1000000);
    RETURN CASE WHEN amount < 0 THEN '-' ELSE '' END
        || whole::text || '.' || lpad(fraction::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_capture_snapshot(
    p_screener_id uuid,
    p_as_of timestamptz
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    org_id uuid;
    rule_spec jsonb;
    new_snapshot uuid;
    inst record;
    closes numeric[];
    volumes numeric[];
    n integer;
    min_bar integer;
    max_bar integer;
    last_time timestamptz;
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
    feature_snapshot jsonb;
    included boolean;
    f_kind text[];
    f_period integer[];
    f_value numeric[];
    slot integer;
    rec record;
    feature_text text;
    lines text[] := ARRAY[]::text[];
    payload text;
    digest text;
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

    INSERT INTO public.finance_market_snapshots (organization_id, screener_id, as_of, result_digest)
    VALUES (org_id, p_screener_id, p_as_of, repeat('0', 32))
    RETURNING id INTO new_snapshot;

    FOR inst IN
        SELECT i.id, i.exchange, i.symbol
        FROM public.finance_instruments i
        WHERE i.organization_id = org_id
          AND EXISTS (
              SELECT 1 FROM public.finance_market_bars bars
              WHERE bars.instrument_id = i.id
                AND bars.timeframe = '1d'
                AND (p_as_of IS NULL OR bars.bar_time <= p_as_of)
          )
        ORDER BY i.exchange, i.symbol
    LOOP
        IF position('|' IN inst.exchange) > 0 OR position('|' IN inst.symbol) > 0 THEN
            RAISE EXCEPTION 'snapshot symbol is invalid';
        END IF;
        SELECT array_agg(bars.close ORDER BY bars.bar_index),
               array_agg(bars.volume ORDER BY bars.bar_index),
               count(*),
               min(bars.bar_index),
               max(bars.bar_index),
               max(bars.bar_time)
        INTO closes, volumes, n, min_bar, max_bar, last_time
        FROM public.finance_market_bars bars
        WHERE bars.instrument_id = inst.id
          AND bars.timeframe = '1d'
          AND (p_as_of IS NULL OR bars.bar_time <= p_as_of);
        IF n < 1 THEN
            CONTINUE;
        END IF;
        IF min_bar <> 0 OR max_bar <> n - 1 THEN
            RAISE EXCEPTION 'snapshot needs a contiguous 1d series';
        END IF;
        sma_map := '{}'::jsonb;
        ema_map := '{}'::jsonb;
        rsi_map := '{}'::jsonb;
        momentum_map := '{}'::jsonb;
        volatility_map := '{}'::jsonb;
        f_kind := ARRAY[]::text[];
        f_period := ARRAY[]::integer[];
        f_value := ARRAY[]::numeric[];
        FOREACH indicator_period IN ARRAY sma_periods LOOP
            series := public.finance_indicator_sma(closes, indicator_period);
            last_value := series[n];
            sma_map := sma_map || jsonb_build_object(indicator_period::text, to_jsonb(last_value));
            f_kind := f_kind || ARRAY['sma'];
            f_period := f_period || ARRAY[indicator_period];
            f_value := f_value || ARRAY[last_value];
        END LOOP;
        FOREACH indicator_period IN ARRAY ema_periods LOOP
            series := public.finance_indicator_ema(closes, indicator_period);
            last_value := series[n];
            ema_map := ema_map || jsonb_build_object(indicator_period::text, to_jsonb(last_value));
            f_kind := f_kind || ARRAY['ema'];
            f_period := f_period || ARRAY[indicator_period];
            f_value := f_value || ARRAY[last_value];
        END LOOP;
        FOREACH indicator_period IN ARRAY rsi_periods LOOP
            series := public.finance_indicator_rsi(closes, indicator_period);
            last_value := series[n];
            rsi_map := rsi_map || jsonb_build_object(indicator_period::text, to_jsonb(last_value));
            f_kind := f_kind || ARRAY['rsi'];
            f_period := f_period || ARRAY[indicator_period];
            f_value := f_value || ARRAY[last_value];
        END LOOP;
        FOREACH indicator_period IN ARRAY momentum_periods LOOP
            IF n <= indicator_period THEN
                last_value := NULL;
            ELSE
                last_value := round(closes[n] - closes[n - indicator_period], 6);
            END IF;
            momentum_map := momentum_map || jsonb_build_object(indicator_period::text, to_jsonb(last_value));
            f_kind := f_kind || ARRAY['momentum'];
            f_period := f_period || ARRAY[indicator_period];
            f_value := f_value || ARRAY[last_value];
        END LOOP;
        FOREACH indicator_period IN ARRAY volatility_periods LOOP
            IF n < indicator_period OR closes[n] = 0 THEN
                last_value := NULL;
            ELSE
                SELECT max(amount), min(amount) INTO hi, lo
                FROM unnest(closes[n - indicator_period + 1:n]) AS amount;
                last_value := round((hi - lo) / closes[n], 6);
            END IF;
            volatility_map := volatility_map || jsonb_build_object(indicator_period::text, to_jsonb(last_value));
            f_kind := f_kind || ARRAY['volatility'];
            f_period := f_period || ARRAY[indicator_period];
            f_value := f_value || ARRAY[last_value];
        END LOOP;
        feature_snapshot := jsonb_build_object(
            'close', to_jsonb(closes[n]),
            'volume', to_jsonb(volumes[n]),
            'sma', sma_map,
            'ema', ema_map,
            'rsi', rsi_map,
            'momentum', momentum_map,
            'volatility', volatility_map
        );
        included := public.finance_screen_eval(rule_spec->'where', feature_snapshot);
        INSERT INTO public.finance_snapshot_states (
            snapshot_id, organization_id, instrument_id, exchange, symbol,
            bar_index, bar_time, price, volume, included
        ) VALUES (
            new_snapshot, org_id, inst.id, inst.exchange, inst.symbol,
            max_bar, last_time, round(closes[n], 6), round(volumes[n], 6), included
        );
        IF cardinality(f_kind) > 0 THEN
            FOR slot IN 1..cardinality(f_kind) LOOP
                INSERT INTO public.finance_snapshot_features (
                    snapshot_id, organization_id, instrument_id, kind, period, value
                ) VALUES (
                    new_snapshot, org_id, inst.id, f_kind[slot], f_period[slot], f_value[slot]
                );
            END LOOP;
        END IF;
    END LOOP;

    FOR rec IN
        SELECT states.instrument_id, states.exchange, states.symbol, states.bar_index,
               states.price, states.volume, states.included
        FROM public.finance_snapshot_states states
        WHERE states.snapshot_id = new_snapshot
        ORDER BY states.exchange, states.symbol
    LOOP
        SELECT coalesce(string_agg(
            features.kind || ':' || features.period::text || '=' || public.finance_money_text(features.value),
            ',' ORDER BY CASE features.kind
                WHEN 'sma' THEN 1
                WHEN 'ema' THEN 2
                WHEN 'rsi' THEN 3
                WHEN 'momentum' THEN 4
                WHEN 'volatility' THEN 5
                ELSE 6
            END, features.period
        ), '')
        INTO feature_text
        FROM public.finance_snapshot_features features
        WHERE features.snapshot_id = new_snapshot
          AND features.instrument_id = rec.instrument_id;
        lines := lines || ARRAY[
            'S|' || rec.exchange || '|' || rec.symbol || '|' || rec.bar_index::text || '|'
            || public.finance_money_text(rec.price) || '|' || public.finance_money_text(rec.volume) || '|'
            || CASE WHEN rec.included THEN '1' ELSE '0' END || '|' || feature_text
        ];
    END LOOP;
    payload := array_to_string(lines, E'\n');
    digest := md5(payload);
    UPDATE public.finance_market_snapshots
    SET result_digest = digest
    WHERE id = new_snapshot;
    PERFORM public.finance_audit(
        org_id, 'snapshot.captured', 'finance_market_snapshot', new_snapshot, jsonb_build_object('digest', digest)
    );
    RETURN new_snapshot;
END;
$$;

ALTER TABLE public.finance_market_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_snapshot_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_snapshot_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_market_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_snapshot_states FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_snapshot_features FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_market_snapshots_select ON public.finance_market_snapshots FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));
CREATE POLICY finance_snapshot_states_select ON public.finance_snapshot_states FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));
CREATE POLICY finance_snapshot_features_select ON public.finance_snapshot_features FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_money_text(numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_capture_snapshot(uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_capture_snapshot(uuid, timestamptz) TO app_user;

DO $$
DECLARE
    rel text;
BEGIN
    FOREACH rel IN ARRAY ARRAY[
        'finance_market_snapshots',
        'finance_snapshot_states',
        'finance_snapshot_features'
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
                'finance_market_snapshots',
                'finance_snapshot_states',
                'finance_snapshot_features'
            ] LOOP
                EXECUTE format('REVOKE ALL ON public.%I FROM %I', rel, r);
            END LOOP;
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_capture_snapshot(uuid, timestamptz) FROM %I', r);
        END IF;
    END LOOP;
END $$;
