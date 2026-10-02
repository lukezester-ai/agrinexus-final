-- Risk governance v1 gate 3. Does not alter 001-005 and does not recreate 006-026.
-- Human approval may bind an existing allow evaluation. It does not calculate risk
-- or run another policy evaluation. Paper keeps the stored evaluation digest.

ALTER TABLE public.finance_strategy_approvals
    ADD COLUMN evaluation_id uuid NOT NULL REFERENCES public.finance_risk_evaluations(id) ON DELETE RESTRICT,
    ADD COLUMN evaluation_digest text NOT NULL;

CREATE OR REPLACE FUNCTION public.finance_approve_strategy_result(p_book_id uuid) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    org_id uuid;
    strategy uuid;
    specification_digest text;
    strategy_digest text;
    backtest_digest text;
    risk_digest text;
    eval_id uuid;
    eval_digest text;
    eval_accepted boolean;
    eval_policy_digest text;
    live_policy_digest text;
    approval_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    SELECT digests.organization_id, digests.strategy_id, digests.specification_digest,
           digests.strategy_digest, digests.backtest_digest, digests.risk_digest
    INTO org_id, strategy, specification_digest, strategy_digest, backtest_digest, risk_digest
    FROM public.finance_strategy_result_digests(p_book_id) AS digests;
    IF org_id IS NULL OR strategy_digest IS NULL OR backtest_digest IS NULL OR risk_digest IS NULL THEN
        RAISE EXCEPTION 'paper book not found';
    END IF;
    IF NOT public.can_write_organization(org_id) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    IF EXISTS (SELECT 1 FROM public.finance_strategy_approvals existing WHERE existing.book_id = p_book_id) THEN
        RAISE EXCEPTION 'strategy result is already approved';
    END IF;
    SELECT evaluations.id, evaluations.evaluation_digest, evaluations.accepted,
           evaluations.policy_digest, policies.policy_digest
    INTO eval_id, eval_digest, eval_accepted, eval_policy_digest, live_policy_digest
    FROM public.finance_risk_evaluations evaluations
    JOIN public.finance_risk_policies policies ON policies.id = evaluations.policy_id
    WHERE evaluations.book_id = p_book_id
      AND evaluations.organization_id = org_id
    ORDER BY evaluations.created_at DESC, evaluations.ctid DESC
    LIMIT 1;
    IF eval_id IS NULL THEN
        RAISE EXCEPTION 'risk evaluation is required';
    END IF;
    IF eval_accepted IS NOT TRUE OR eval_policy_digest IS DISTINCT FROM live_policy_digest THEN
        RAISE EXCEPTION 'risk evaluation is not allowed';
    END IF;
    INSERT INTO public.finance_strategy_approvals (
        organization_id, strategy_id, book_id, specification_digest, strategy_digest,
        backtest_digest, risk_digest, evaluation_id, evaluation_digest, approved_by
    ) VALUES (
        org_id, strategy, p_book_id, specification_digest, strategy_digest,
        backtest_digest, risk_digest, eval_id, eval_digest, auth.uid()
    )
    RETURNING id INTO approval_id;
    PERFORM public.finance_audit(
        org_id,
        'strategy.approved',
        'finance_strategy_approval',
        approval_id,
        jsonb_build_object(
            'book_id', p_book_id,
            'specification_digest', specification_digest,
            'strategy_digest', strategy_digest,
            'backtest_digest', backtest_digest,
            'risk_digest', risk_digest,
            'evaluation_digest', eval_digest
        )
    );
    RETURN approval_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_strategy_approval_immutable() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.specification_digest IS DISTINCT FROM OLD.specification_digest
        OR NEW.strategy_digest IS DISTINCT FROM OLD.strategy_digest
        OR NEW.backtest_digest IS DISTINCT FROM OLD.backtest_digest
        OR NEW.risk_digest IS DISTINCT FROM OLD.risk_digest
        OR NEW.evaluation_digest IS DISTINCT FROM OLD.evaluation_digest
        OR NEW.evaluation_id IS DISTINCT FROM OLD.evaluation_id
        OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
        OR NEW.book_id IS DISTINCT FROM OLD.book_id
        OR NEW.strategy_id IS DISTINCT FROM OLD.strategy_id
        OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
        RAISE EXCEPTION 'strategy approval is immutable';
    END IF;
    RETURN NEW;
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
    strategy uuid;
    specification_digest text;
    strategy_digest text;
    backtest_digest text;
    risk_digest text;
    approved_specification text;
    approved_strategy text;
    approved_backtest text;
    approved_risk text;
    approved_evaluation text;
    latest_digest text;
    latest_accepted boolean;
    latest_policy_digest text;
    live_policy_digest text;
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
    SELECT digests.strategy_id, digests.specification_digest, digests.strategy_digest,
           digests.backtest_digest, digests.risk_digest
    INTO strategy, specification_digest, strategy_digest, backtest_digest, risk_digest
    FROM public.finance_strategy_result_digests(p_book_id) AS digests;
    SELECT approvals.specification_digest, approvals.strategy_digest,
           approvals.backtest_digest, approvals.risk_digest, approvals.evaluation_digest
    INTO approved_specification, approved_strategy, approved_backtest, approved_risk, approved_evaluation
    FROM public.finance_strategy_approvals approvals
    WHERE approvals.book_id = p_book_id
      AND approvals.organization_id = book_org
      AND approvals.strategy_id = strategy;
    IF approved_specification IS NULL THEN
        RAISE EXCEPTION 'strategy approval is required';
    END IF;
    IF approved_specification IS DISTINCT FROM specification_digest
        OR approved_strategy IS DISTINCT FROM strategy_digest
        OR approved_backtest IS DISTINCT FROM backtest_digest
        OR approved_risk IS DISTINCT FROM risk_digest THEN
        RAISE EXCEPTION 'strategy approval does not match';
    END IF;
    SELECT evaluations.evaluation_digest, evaluations.accepted,
           evaluations.policy_digest, policies.policy_digest
    INTO latest_digest, latest_accepted, latest_policy_digest, live_policy_digest
    FROM public.finance_risk_evaluations evaluations
    JOIN public.finance_risk_policies policies ON policies.id = evaluations.policy_id
    WHERE evaluations.book_id = p_book_id
      AND evaluations.organization_id = book_org
    ORDER BY evaluations.created_at DESC, evaluations.ctid DESC
    LIMIT 1;
    IF approved_evaluation IS DISTINCT FROM latest_digest
        OR latest_accepted IS NOT TRUE
        OR latest_policy_digest IS DISTINCT FROM live_policy_digest THEN
        RAISE EXCEPTION 'strategy approval does not match';
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
