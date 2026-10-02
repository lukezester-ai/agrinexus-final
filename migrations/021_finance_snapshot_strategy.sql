-- Finance v1.2 gate 3. Does not alter 001-005 and does not recreate 006-013.
-- A stored snapshot is an input bound for the existing strategy engine, spec backtest, and paper book.
-- Bars after the snapshot cutoff are withheld only for that call, then restored.
-- Digests use finance_money_text. There is no second engine, no AI, and no broker.

CREATE TABLE public.finance_snapshot_strategy_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    snapshot_id uuid NOT NULL REFERENCES public.finance_market_snapshots(id) ON DELETE CASCADE,
    strategy_id uuid NOT NULL REFERENCES public.finance_strategies(id) ON DELETE CASCADE,
    book_id uuid NOT NULL REFERENCES public.finance_spec_books(id) ON DELETE CASCADE,
    cutoff_bar integer NOT NULL CHECK (cutoff_bar >= 0),
    snapshot_digest text NOT NULL,
    strategy_digest text NOT NULL,
    book_digest text NOT NULL,
    paper_digest text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_finance_snapshot_strategy_runs_org
    ON public.finance_snapshot_strategy_runs (organization_id);

CREATE OR REPLACE FUNCTION public.finance_run_snapshot_strategy(
    p_snapshot_id uuid,
    p_strategy_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    snapshot_org uuid;
    stored_snapshot_digest text;
    org_id uuid;
    instrument uuid;
    current_lifecycle text;
    rule_spec jsonb;
    cutoff integer;
    is_included boolean;
    new_book uuid;
    spec_run uuid;
    strategy_digest text;
    book_digest text;
    paper_digest text;
    new_link uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    SELECT snapshots.organization_id, snapshots.result_digest
    INTO snapshot_org, stored_snapshot_digest
    FROM public.finance_market_snapshots snapshots
    WHERE snapshots.id = p_snapshot_id;
    IF snapshot_org IS NULL THEN
        RAISE EXCEPTION 'snapshot not found';
    END IF;
    SELECT s.organization_id, s.instrument_id, s.lifecycle, s.spec
    INTO org_id, instrument, current_lifecycle, rule_spec
    FROM public.finance_strategies s
    WHERE s.id = p_strategy_id;
    IF org_id IS NULL THEN
        RAISE EXCEPTION 'strategy not found';
    END IF;
    IF snapshot_org <> org_id THEN
        RAISE EXCEPTION 'snapshot and strategy must share an organization';
    END IF;
    IF NOT public.can_write_organization(org_id) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    IF current_lifecycle <> 'validated' OR NOT public.finance_strategy_spec_v2(rule_spec) THEN
        RAISE EXCEPTION 'only a validated version 2 spec can be executed';
    END IF;
    SELECT states.bar_index, states.included
    INTO cutoff, is_included
    FROM public.finance_snapshot_states states
    WHERE states.snapshot_id = p_snapshot_id
      AND states.instrument_id = instrument;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'snapshot does not include this instrument';
    END IF;
    IF NOT is_included THEN
        RAISE EXCEPTION 'snapshot candidate is required';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM public.finance_paper_allocations allocated
        JOIN public.finance_spec_books books ON books.id = allocated.book_id
        WHERE books.strategy_id = p_strategy_id
    ) THEN
        RAISE EXCEPTION 'paper book is already applied';
    END IF;

    EXECUTE 'DROP TABLE IF EXISTS pg_temp.finance_held_bars';
    EXECUTE
        'CREATE TEMP TABLE finance_held_bars AS
         SELECT * FROM public.finance_market_bars
         WHERE instrument_id = $1 AND timeframe = ''1d'' AND bar_index > $2'
        USING instrument, cutoff;
    EXECUTE
        'DELETE FROM public.finance_market_bars
         WHERE instrument_id = $1 AND timeframe = ''1d'' AND bar_index > $2'
        USING instrument, cutoff;

    PERFORM public.finance_execute_strategy(p_strategy_id);
    new_book := public.finance_run_spec_backtest(p_strategy_id);

    EXECUTE 'INSERT INTO public.finance_market_bars SELECT * FROM pg_temp.finance_held_bars';
    EXECUTE 'DROP TABLE pg_temp.finance_held_bars';

    SELECT r.id INTO spec_run
    FROM public.finance_spec_runs r
    WHERE r.strategy_id = p_strategy_id;
    SELECT md5(COALESCE(string_agg(
        signals.bar_index::text || '|' || signals.entry_on::text || '|'
            || signals.exit_on::text || '|' || signals.position::text,
        E'\n' ORDER BY signals.bar_index
    ), ''))
    INTO strategy_digest
    FROM public.finance_spec_signals signals
    WHERE signals.run_id = spec_run;

    SELECT books.result_digest,
           md5(
               'P|' || public.finance_money_text(books.ending_cash)
               || '|' || public.finance_money_text(books.ending_quantity)
               || '|' || public.finance_money_text(books.avg_price)
               || '|' || public.finance_money_text(books.mark_price)
               || '|' || public.finance_money_text(books.market_value)
               || '|' || public.finance_money_text(books.cash_weight)
               || '|' || public.finance_money_text(books.position_weight)
               || '|' || public.finance_money_text(stats.ending_equity)
               || '|' || public.finance_money_text(stats.paper_pnl)
               || '|' || public.finance_money_text(stats.max_drawdown)
           )
    INTO book_digest, paper_digest
    FROM public.finance_spec_books books
    JOIN public.finance_performance_stats stats ON stats.book_id = books.id
    WHERE books.id = new_book;

    INSERT INTO public.finance_snapshot_strategy_runs (
        organization_id, snapshot_id, strategy_id, book_id, cutoff_bar,
        snapshot_digest, strategy_digest, book_digest, paper_digest
    ) VALUES (
        org_id, p_snapshot_id, p_strategy_id, new_book, cutoff,
        stored_snapshot_digest, strategy_digest, book_digest, paper_digest
    )
    RETURNING id INTO new_link;

    PERFORM public.finance_audit(
        org_id,
        'snapshot.strategy_run',
        'finance_snapshot_strategy_run',
        new_link,
        jsonb_build_object(
            'snapshot_digest', stored_snapshot_digest,
            'strategy_digest', strategy_digest,
            'book_digest', book_digest,
            'paper_digest', paper_digest
        )
    );
    RETURN new_link;
END;
$$;

ALTER TABLE public.finance_snapshot_strategy_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_snapshot_strategy_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_snapshot_strategy_runs_select ON public.finance_snapshot_strategy_runs
    FOR SELECT TO app_user
    USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_run_snapshot_strategy(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_run_snapshot_strategy(uuid, uuid) TO app_user;

DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON public.finance_snapshot_strategy_runs FROM PUBLIC';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.finance_snapshot_strategy_runs FROM app_user';
    EXECUTE 'GRANT SELECT ON public.finance_snapshot_strategy_runs TO app_user';
END $$;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON public.finance_snapshot_strategy_runs FROM %I', r);
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_run_snapshot_strategy(uuid, uuid) FROM %I',
                r
            );
        END IF;
    END LOOP;
END $$;
