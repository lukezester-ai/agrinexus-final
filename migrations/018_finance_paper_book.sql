-- Finance v1.1 gate 3. Does not alter 001-005 and does not recreate 006-013.
-- A version 2 spec run becomes a paper book: trade ledger, drawdown, performance, allocation.
-- Re-running the same spec and bars replaces the book with the same digest. There is no broker.

CREATE TABLE public.finance_spec_books (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    strategy_id uuid NOT NULL UNIQUE REFERENCES public.finance_strategies(id) ON DELETE CASCADE,
    run_id uuid NOT NULL REFERENCES public.finance_spec_runs(id) ON DELETE CASCADE,
    starting_cash numeric NOT NULL,
    ending_cash numeric NOT NULL,
    ending_quantity numeric NOT NULL CHECK (ending_quantity >= 0),
    avg_price numeric NOT NULL,
    mark_price numeric NOT NULL,
    market_value numeric NOT NULL,
    cash_weight numeric NOT NULL,
    position_weight numeric NOT NULL,
    result_digest text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.finance_performance_stats (
    book_id uuid PRIMARY KEY REFERENCES public.finance_spec_books(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    trade_count integer NOT NULL,
    win_count integer NOT NULL,
    loss_count integer NOT NULL,
    win_rate numeric NOT NULL,
    avg_trade numeric NOT NULL,
    gross_profit numeric NOT NULL,
    gross_loss numeric NOT NULL,
    profit_factor numeric,
    closed_pnl numeric NOT NULL,
    paper_pnl numeric NOT NULL,
    ending_equity numeric NOT NULL,
    total_return numeric NOT NULL,
    max_drawdown numeric NOT NULL,
    peak_equity numeric NOT NULL,
    max_drawdown_bars integer NOT NULL
);

CREATE TABLE public.finance_trade_ledger (
    book_id uuid NOT NULL REFERENCES public.finance_spec_books(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    trade_index integer NOT NULL CHECK (trade_index >= 0),
    entry_bar integer NOT NULL,
    exit_bar integer,
    entry_price numeric NOT NULL,
    exit_price numeric,
    quantity numeric NOT NULL CHECK (quantity > 0),
    pnl numeric,
    PRIMARY KEY (book_id, trade_index),
    CHECK (
        (exit_bar IS NULL AND exit_price IS NULL AND pnl IS NULL)
        OR (exit_bar IS NOT NULL AND exit_price IS NOT NULL AND pnl IS NOT NULL)
    )
);

CREATE TABLE public.finance_drawdown_points (
    book_id uuid NOT NULL REFERENCES public.finance_spec_books(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    bar_index integer NOT NULL,
    equity numeric NOT NULL,
    peak numeric NOT NULL,
    drawdown numeric NOT NULL,
    PRIMARY KEY (book_id, bar_index)
);

CREATE TABLE public.finance_paper_allocations (
    portfolio_id uuid PRIMARY KEY REFERENCES public.finance_paper_portfolios(id) ON DELETE CASCADE,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    instrument_id uuid NOT NULL REFERENCES public.finance_instruments(id) ON DELETE CASCADE,
    book_id uuid NOT NULL UNIQUE REFERENCES public.finance_spec_books(id) ON DELETE RESTRICT,
    cash numeric NOT NULL,
    quantity numeric NOT NULL CHECK (quantity >= 0),
    avg_price numeric NOT NULL,
    mark_price numeric NOT NULL,
    market_value numeric NOT NULL,
    equity numeric NOT NULL,
    cash_weight numeric NOT NULL,
    position_weight numeric NOT NULL
);

CREATE INDEX idx_finance_spec_books_org ON public.finance_spec_books (organization_id);
CREATE INDEX idx_finance_trade_ledger_org ON public.finance_trade_ledger (organization_id);
CREATE INDEX idx_finance_drawdown_points_org ON public.finance_drawdown_points (organization_id);
CREATE INDEX idx_finance_paper_allocations_org ON public.finance_paper_allocations (organization_id);

CREATE OR REPLACE FUNCTION public.finance_run_spec_backtest(p_strategy_id uuid) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    org_id uuid;
    instrument uuid;
    current_lifecycle text;
    rule_spec jsonb;
    spec_run uuid;
    bar_count integer;
    signal_count integer;
    min_bar integer;
    max_bar integer;
    rec record;
    seen integer := 0;
    slot integer;
    cash numeric := 100000;
    quantity numeric := 0;
    entry_price numeric;
    entry_bar integer;
    t_index integer[] := ARRAY[]::integer[];
    t_entry integer[] := ARRAY[]::integer[];
    t_exit integer[] := ARRAY[]::integer[];
    t_entry_price numeric[] := ARRAY[]::numeric[];
    t_exit_price numeric[] := ARRAY[]::numeric[];
    t_pnl numeric[] := ARRAY[]::numeric[];
    d_bar integer[] := ARRAY[]::integer[];
    d_equity numeric[] := ARRAY[]::numeric[];
    d_peak numeric[] := ARRAY[]::numeric[];
    d_drawdown numeric[] := ARRAY[]::numeric[];
    previous integer := 0;
    raw_pnl numeric;
    closed_pnl numeric := 0;
    gross_profit numeric := 0;
    gross_loss numeric := 0;
    wins integer := 0;
    losses integer := 0;
    trade_index integer := 0;
    trade_count integer := 0;
    equity numeric;
    last_close numeric;
    peak numeric;
    peak_index integer;
    drawdown numeric;
    max_drawdown numeric := 0;
    max_drawdown_bars integer := 0;
    unrealized numeric := 0;
    book_id uuid;
    win_rate numeric;
    avg_trade numeric;
    profit_factor numeric;
    ending_equity numeric;
    total_return numeric;
    peak_equity numeric;
    market_value numeric;
    cash_weight numeric;
    position_weight numeric;
    avg_price numeric;
    ledger_lines text[] := '{}';
    drawdown_lines text[] := '{}';
    stats_line text;
    payload text;
    digest text;
    equity_q numeric;
    peak_q numeric;
    drawdown_q numeric;
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
        RAISE EXCEPTION 'only a validated version 2 spec can be booked';
    END IF;
    SELECT r.id INTO spec_run FROM public.finance_spec_runs r WHERE r.strategy_id = p_strategy_id;
    IF spec_run IS NULL THEN
        RAISE EXCEPTION 'strategy execution is required before the paper book';
    END IF;
    SELECT count(*) INTO bar_count
    FROM public.finance_market_bars bars
    WHERE bars.instrument_id = instrument AND bars.timeframe = '1d';
    SELECT count(*), min(signals.bar_index), max(signals.bar_index)
    INTO signal_count, min_bar, max_bar
    FROM public.finance_spec_signals signals
    WHERE signals.run_id = spec_run;
    IF bar_count < 1 OR signal_count <> bar_count OR min_bar <> 0 OR max_bar <> bar_count - 1 THEN
        RAISE EXCEPTION 'spec signals must cover every close';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM public.finance_paper_allocations allocated
        JOIN public.finance_spec_books books ON books.id = allocated.book_id
        WHERE books.strategy_id = p_strategy_id
    ) THEN
        RAISE EXCEPTION 'paper book is already applied';
    END IF;
    DELETE FROM public.finance_spec_books WHERE strategy_id = p_strategy_id;

    FOR rec IN
        SELECT signals.bar_index, signals.position, bars.close
        FROM public.finance_spec_signals signals
        JOIN public.finance_market_bars bars
          ON bars.instrument_id = instrument
         AND bars.timeframe = '1d'
         AND bars.bar_index = signals.bar_index
        WHERE signals.run_id = spec_run
        ORDER BY signals.bar_index
    LOOP
        IF previous = 0 AND rec.position = 1 THEN
            quantity := 1;
            cash := cash - rec.close;
            entry_price := rec.close;
            entry_bar := rec.bar_index;
        ELSIF previous = 1 AND rec.position = 0 THEN
            raw_pnl := rec.close - entry_price;
            ledger_lines := ledger_lines || ARRAY[
                'L|' || trade_index::text || '|' || entry_bar::text || '|' || rec.bar_index::text || '|'
                || round(entry_price, 6)::text || '|' || round(rec.close, 6)::text || '|'
                || round(1::numeric, 6)::text || '|' || round(raw_pnl, 6)::text
            ];
            t_index := t_index || trade_index;
            t_entry := t_entry || entry_bar;
            t_exit := t_exit || rec.bar_index;
            t_entry_price := t_entry_price || round(entry_price, 6);
            t_exit_price := t_exit_price || round(rec.close, 6);
            t_pnl := t_pnl || round(raw_pnl, 6);
            trade_index := trade_index + 1;
            trade_count := trade_count + 1;
            cash := cash + rec.close;
            closed_pnl := closed_pnl + raw_pnl;
            IF raw_pnl > 0 THEN
                wins := wins + 1;
                gross_profit := gross_profit + raw_pnl;
            ELSIF raw_pnl < 0 THEN
                losses := losses + 1;
                gross_loss := gross_loss + (-raw_pnl);
            END IF;
            quantity := 0;
            entry_price := NULL;
            entry_bar := NULL;
        ELSIF rec.position NOT IN (0, 1) THEN
            RAISE EXCEPTION 'spec position is invalid';
        END IF;
        previous := rec.position;
        equity := cash + quantity * rec.close;
        last_close := rec.close;
        IF peak IS NULL THEN
            peak := equity;
            peak_index := rec.bar_index;
        ELSIF equity > peak THEN
            peak := equity;
            peak_index := rec.bar_index;
        END IF;
        IF peak > 0 THEN
            drawdown := (peak - equity) / peak;
        ELSE
            drawdown := 0;
        END IF;
        IF drawdown > max_drawdown THEN
            max_drawdown := drawdown;
            max_drawdown_bars := rec.bar_index - peak_index;
        END IF;
        equity_q := round(equity, 6);
        peak_q := round(peak, 6);
        drawdown_q := round(drawdown, 6);
        drawdown_lines := drawdown_lines || ARRAY[
            'D|' || rec.bar_index::text || '|' || equity_q::text || '|' || peak_q::text || '|' || drawdown_q::text
        ];
        d_bar := d_bar || rec.bar_index;
        d_equity := d_equity || equity_q;
        d_peak := d_peak || peak_q;
        d_drawdown := d_drawdown || drawdown_q;
        seen := seen + 1;
    END LOOP;
    IF seen <> bar_count THEN
        RAISE EXCEPTION 'spec signals must cover every close';
    END IF;
    IF quantity = 1 THEN
        unrealized := last_close - entry_price;
        ledger_lines := ledger_lines || ARRAY[
            'L|' || trade_index::text || '|' || entry_bar::text || '||'
            || round(entry_price, 6)::text || '||' || round(1::numeric, 6)::text || '|'
        ];
        t_index := t_index || trade_index;
        t_entry := t_entry || entry_bar;
        t_exit := t_exit || ARRAY[NULL::integer];
        t_entry_price := t_entry_price || round(entry_price, 6);
        t_exit_price := t_exit_price || ARRAY[NULL::numeric];
        t_pnl := t_pnl || ARRAY[NULL::numeric];
    END IF;
    IF equity = 0 THEN
        RAISE EXCEPTION 'paper equity is zero';
    END IF;
    IF trade_count = 0 THEN
        win_rate := round(0::numeric, 6);
        avg_trade := round(0::numeric, 6);
    ELSE
        win_rate := round(wins::numeric / trade_count, 6);
        avg_trade := round(closed_pnl / trade_count, 6);
    END IF;
    IF gross_loss > 0 THEN
        profit_factor := round(gross_profit / gross_loss, 6);
    ELSE
        profit_factor := NULL;
    END IF;
    ending_equity := round(equity, 6);
    total_return := round((equity - 100000) / 100000, 6);
    peak_equity := round(peak, 6);
    market_value := round(quantity * last_close, 6);
    cash_weight := round(cash / equity, 6);
    position_weight := round((quantity * last_close) / equity, 6);
    IF quantity = 1 THEN
        avg_price := round(entry_price, 6);
    ELSE
        avg_price := round(0::numeric, 6);
    END IF;
    stats_line := 'S|' || trade_count::text || '|' || wins::text || '|' || losses::text || '|'
        || win_rate::text || '|' || avg_trade::text || '|'
        || round(gross_profit, 6)::text || '|' || round(gross_loss, 6)::text || '|'
        || CASE WHEN profit_factor IS NULL THEN '' ELSE profit_factor::text END || '|'
        || round(closed_pnl, 6)::text || '|' || round(closed_pnl + unrealized, 6)::text || '|'
        || ending_equity::text || '|' || total_return::text || '|'
        || round(max_drawdown, 6)::text || '|' || peak_equity::text || '|'
        || max_drawdown_bars::text;
    payload := array_to_string(ledger_lines || ARRAY[stats_line] || drawdown_lines, E'\n');
    digest := md5(payload);

    INSERT INTO public.finance_spec_books (
        organization_id, strategy_id, run_id, starting_cash, ending_cash, ending_quantity,
        avg_price, mark_price, market_value, cash_weight, position_weight, result_digest
    ) VALUES (
        org_id, p_strategy_id, spec_run, 100000, round(cash, 6), round(quantity, 6),
        avg_price, round(last_close, 6), market_value, cash_weight, position_weight, digest
    ) RETURNING id INTO book_id;

    INSERT INTO public.finance_performance_stats (
        book_id, organization_id, trade_count, win_count, loss_count, win_rate, avg_trade,
        gross_profit, gross_loss, profit_factor, closed_pnl, paper_pnl, ending_equity,
        total_return, max_drawdown, peak_equity, max_drawdown_bars
    ) VALUES (
        book_id, org_id, trade_count, wins, losses, win_rate, avg_trade,
        round(gross_profit, 6), round(gross_loss, 6), profit_factor,
        round(closed_pnl, 6), round(closed_pnl + unrealized, 6), ending_equity,
        total_return, round(max_drawdown, 6), peak_equity, max_drawdown_bars
    );

    IF cardinality(t_index) > 0 THEN
        FOR slot IN 1..cardinality(t_index) LOOP
            INSERT INTO public.finance_trade_ledger (
                book_id, organization_id, trade_index, entry_bar, exit_bar, entry_price, exit_price, quantity, pnl
            ) VALUES (
                book_id, org_id, t_index[slot], t_entry[slot], t_exit[slot], t_entry_price[slot], t_exit_price[slot],
                round(1::numeric, 6), t_pnl[slot]
            );
        END LOOP;
    END IF;
    FOR slot IN 1..cardinality(d_bar) LOOP
        INSERT INTO public.finance_drawdown_points (book_id, organization_id, bar_index, equity, peak, drawdown)
        VALUES (book_id, org_id, d_bar[slot], d_equity[slot], d_peak[slot], d_drawdown[slot]);
    END LOOP;

    PERFORM public.finance_audit(org_id, 'book.completed', 'finance_spec_book', book_id, jsonb_build_object('digest', digest));
    RETURN book_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_apply_paper_book(
    p_portfolio_id uuid,
    p_book_id uuid
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    portfolio_org uuid;
    book_org uuid;
    instrument uuid;
    ending_cash numeric;
    ending_quantity numeric;
    avg_price numeric;
    mark_price numeric;
    market_value numeric;
    cash_weight numeric;
    position_weight numeric;
    ending_equity numeric;
    paper_pnl numeric;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    SELECT organization_id INTO portfolio_org FROM public.finance_paper_portfolios WHERE id = p_portfolio_id;
    SELECT books.organization_id, strategies.instrument_id, books.ending_cash, books.ending_quantity,
           books.avg_price, books.mark_price, books.market_value, books.cash_weight, books.position_weight,
           stats.ending_equity, stats.paper_pnl
    INTO book_org, instrument, ending_cash, ending_quantity, avg_price, mark_price, market_value,
         cash_weight, position_weight, ending_equity, paper_pnl
    FROM public.finance_spec_books books
    JOIN public.finance_strategies strategies ON strategies.id = books.strategy_id
    JOIN public.finance_performance_stats stats ON stats.book_id = books.id
    WHERE books.id = p_book_id;
    IF portfolio_org IS NULL OR book_org IS NULL OR portfolio_org <> book_org THEN
        RAISE EXCEPTION 'paper portfolio and book must share an organization';
    END IF;
    IF NOT public.can_write_organization(portfolio_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    IF ending_cash < 0 THEN
        RAISE EXCEPTION 'paper cash cannot be negative';
    END IF;
    IF EXISTS (SELECT 1 FROM public.finance_paper_trades WHERE portfolio_id = p_portfolio_id)
        OR EXISTS (SELECT 1 FROM public.finance_paper_allocations WHERE portfolio_id = p_portfolio_id)
        OR EXISTS (SELECT 1 FROM public.finance_paper_positions WHERE portfolio_id = p_portfolio_id)
        OR EXISTS (SELECT 1 FROM public.finance_paper_allocations WHERE book_id = p_book_id) THEN
        RAISE EXCEPTION 'paper book is already applied';
    END IF;
    IF ending_quantity > 0 THEN
        INSERT INTO public.finance_paper_positions (organization_id, portfolio_id, instrument_id, quantity, avg_price)
        VALUES (portfolio_org, p_portfolio_id, instrument, ending_quantity, avg_price);
    END IF;
    INSERT INTO public.finance_paper_allocations (
        portfolio_id, organization_id, instrument_id, book_id, cash, quantity, avg_price,
        mark_price, market_value, equity, cash_weight, position_weight
    ) VALUES (
        p_portfolio_id, portfolio_org, instrument, p_book_id, ending_cash, ending_quantity, avg_price,
        mark_price, market_value, ending_equity, cash_weight, position_weight
    );
    UPDATE public.finance_paper_portfolios SET cash = ending_cash WHERE id = p_portfolio_id;
    PERFORM public.finance_audit(
        portfolio_org, 'paper.allocated', 'finance_paper_portfolio', p_portfolio_id,
        jsonb_build_object('book_id', p_book_id, 'paper_pnl', paper_pnl)
    );
    RETURN paper_pnl;
END;
$$;

ALTER TABLE public.finance_spec_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_performance_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_trade_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_drawdown_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_paper_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_spec_books FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_performance_stats FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_trade_ledger FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_drawdown_points FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_paper_allocations FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_spec_books_select ON public.finance_spec_books FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));
CREATE POLICY finance_performance_stats_select ON public.finance_performance_stats FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));
CREATE POLICY finance_trade_ledger_select ON public.finance_trade_ledger FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));
CREATE POLICY finance_drawdown_points_select ON public.finance_drawdown_points FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));
CREATE POLICY finance_paper_allocations_select ON public.finance_paper_allocations FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_run_spec_backtest(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_apply_paper_book(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_run_spec_backtest(uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_apply_paper_book(uuid, uuid) TO app_user;

DO $$
DECLARE
    rel text;
BEGIN
    FOREACH rel IN ARRAY ARRAY[
        'finance_spec_books',
        'finance_performance_stats',
        'finance_trade_ledger',
        'finance_drawdown_points',
        'finance_paper_allocations'
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
                'finance_spec_books',
                'finance_performance_stats',
                'finance_trade_ledger',
                'finance_drawdown_points',
                'finance_paper_allocations'
            ] LOOP
                EXECUTE format('REVOKE ALL ON public.%I FROM %I', rel, r);
            END LOOP;
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_run_spec_backtest(uuid) FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_apply_paper_book(uuid, uuid) FROM %I', r);
        END IF;
    END LOOP;
END $$;
