-- Risk governance v1 gate 2. Does not alter 001-005 and does not recreate 006-025.
-- Reads a stored policy and the metrics an existing book already recorded.
-- Does not calculate drawdown, change an approval, or write a paper book.

CREATE TABLE public.finance_risk_evaluations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    policy_id uuid NOT NULL REFERENCES public.finance_risk_policies(id) ON DELETE CASCADE,
    book_id uuid NOT NULL REFERENCES public.finance_spec_books(id) ON DELETE CASCADE,
    policy_digest text NOT NULL,
    evaluation_digest text NOT NULL,
    accepted boolean NOT NULL,
    denials jsonb NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_finance_risk_evaluations_org
    ON public.finance_risk_evaluations (organization_id);

CREATE OR REPLACE FUNCTION public.finance_evaluate_risk_policy(
    p_policy_id uuid,
    p_book_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    book_org uuid;
    policy_org uuid;
    policy_doc jsonb;
    stored_digest text;
    strategy_name text;
    symbol text;
    measured_drawdown numeric;
    measured_exposure numeric;
    measured_position numeric;
    ending_quantity numeric;
    saw_long boolean;
    open_positions integer;
    denials text[] := ARRAY[]::text[];
    ordered text[] := ARRAY[]::text[];
    accepted boolean;
    action text;
    decision text;
    evaluation_digest text;
    new_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    SELECT policies.organization_id, policies.policy, policies.policy_digest
    INTO policy_org, policy_doc, stored_digest
    FROM public.finance_risk_policies policies
    WHERE policies.id = p_policy_id;
    IF policy_org IS NULL THEN
        RAISE EXCEPTION 'risk policy not found';
    END IF;
    SELECT books.organization_id, books.market_value, books.position_weight, books.ending_quantity,
           stats.max_drawdown, strategies.name, instruments.symbol
    INTO book_org, measured_exposure, measured_position, ending_quantity,
         measured_drawdown, strategy_name, symbol
    FROM public.finance_spec_books books
    JOIN public.finance_performance_stats stats ON stats.book_id = books.id
    JOIN public.finance_strategies strategies ON strategies.id = books.strategy_id
    JOIN public.finance_instruments instruments ON instruments.id = strategies.instrument_id
    WHERE books.id = p_book_id;
    IF book_org IS NULL THEN
        RAISE EXCEPTION 'risk book not found';
    END IF;
    IF policy_org <> book_org THEN
        RAISE EXCEPTION 'risk evaluation is invalid';
    END IF;
    IF NOT public.can_write_organization(book_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    SELECT EXISTS (
        SELECT 1
        FROM public.finance_trade_ledger ledger
        WHERE ledger.book_id = p_book_id
    )
    INTO saw_long;
    IF ending_quantity > 0 THEN
        open_positions := 1;
    ELSE
        open_positions := 0;
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(policy_doc -> 'allowed_strategies') AS allowed(item)
        WHERE allowed.item = strategy_name
    ) THEN
        denials := array_append(denials, 'strategy');
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(policy_doc -> 'allowed_instruments') AS allowed(item)
        WHERE allowed.item = symbol
    ) THEN
        denials := array_append(denials, 'instrument');
    END IF;
    IF measured_drawdown > (policy_doc ->> 'max_drawdown')::numeric THEN
        denials := array_append(denials, 'max_drawdown');
    END IF;
    IF measured_exposure > (policy_doc ->> 'max_exposure')::numeric THEN
        denials := array_append(denials, 'max_exposure');
    END IF;
    IF measured_position > (policy_doc ->> 'max_risk_per_position')::numeric THEN
        denials := array_append(denials, 'max_risk_per_position');
    END IF;
    IF open_positions > (policy_doc ->> 'max_concurrent_positions')::integer THEN
        denials := array_append(denials, 'max_concurrent_positions');
    END IF;
    IF saw_long AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(policy_doc -> 'forbidden_actions') AS forbidden(item)
        WHERE forbidden.item = 'long'
    ) THEN
        denials := array_append(denials, 'forbidden_action');
    END IF;
    ordered := ARRAY[]::text[];
    IF cardinality(denials) > 0 THEN
        SELECT array_agg(listed.item ORDER BY listed.item COLLATE "C")
        INTO ordered
        FROM unnest(denials) AS listed(item);
    END IF;
    accepted := cardinality(ordered) = 0;
    action := CASE WHEN saw_long THEN 'long' ELSE '' END;
    decision := CASE WHEN accepted THEN 'allow' ELSE 'deny' END;
    evaluation_digest := md5(
        'E|' || stored_digest || '|' || strategy_name || '|' || symbol || '|'
        || public.finance_money_text(measured_drawdown) || '|'
        || public.finance_money_text(measured_exposure) || '|'
        || public.finance_money_text(measured_position) || '|'
        || open_positions::text || '|'
        || action || '|'
        || decision || '|'
        || array_to_string(ordered, ',')
    );
    INSERT INTO public.finance_risk_evaluations (
        organization_id, policy_id, book_id, policy_digest, evaluation_digest,
        accepted, denials, created_by
    ) VALUES (
        book_org, p_policy_id, p_book_id, stored_digest, evaluation_digest,
        accepted, to_jsonb(ordered), auth.uid()
    )
    RETURNING id INTO new_id;
    PERFORM public.finance_audit(
        book_org,
        'risk_evaluation.created',
        'finance_risk_evaluation',
        new_id,
        jsonb_build_object('evaluation_digest', evaluation_digest, 'policy_digest', stored_digest)
    );
    RETURN new_id;
END;
$$;

ALTER TABLE public.finance_risk_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_risk_evaluations FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_risk_evaluations_select ON public.finance_risk_evaluations
    FOR SELECT TO app_user
    USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_evaluate_risk_policy(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_evaluate_risk_policy(uuid, uuid) TO app_user;

DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON public.finance_risk_evaluations FROM PUBLIC';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.finance_risk_evaluations FROM app_user';
    EXECUTE 'GRANT SELECT ON public.finance_risk_evaluations TO app_user';
END $$;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON public.finance_risk_evaluations FROM %I', r);
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_evaluate_risk_policy(uuid, uuid) FROM %I',
                r
            );
        END IF;
    END LOOP;
END $$;
