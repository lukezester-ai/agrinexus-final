-- Broker / live boundary gate 1. Does not alter 001-005 and does not recreate 006-027.
-- An order intent is a canonical document copied from one approval and its book.
-- It does not re-check the evaluation, authorize a send, or leave the system.

CREATE TABLE public.finance_order_intents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    approval_id uuid NOT NULL REFERENCES public.finance_strategy_approvals(id) ON DELETE CASCADE,
    book_id uuid NOT NULL REFERENCES public.finance_spec_books(id) ON DELETE CASCADE,
    intent jsonb NOT NULL,
    intent_digest text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_finance_order_intents_org
    ON public.finance_order_intents (organization_id);

CREATE OR REPLACE FUNCTION public.finance_create_order_intent(
    p_approval_id uuid,
    p_intent jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    org_id uuid;
    book_id uuid;
    specification_digest text;
    strategy_digest text;
    backtest_digest text;
    risk_digest text;
    evaluation_digest text;
    symbol text;
    ending_quantity numeric;
    side_text text;
    canonical jsonb;
    digest text;
    new_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF p_intent IS NULL
        OR jsonb_typeof(p_intent) <> 'object'
        OR p_intent <> '{}'::jsonb
        OR public.finance_candidate_command(p_intent) THEN
        RAISE EXCEPTION 'order intent is invalid';
    END IF;
    SELECT approvals.organization_id, approvals.book_id, approvals.specification_digest,
           approvals.strategy_digest, approvals.backtest_digest, approvals.risk_digest,
           approvals.evaluation_digest
    INTO org_id, book_id, specification_digest, strategy_digest, backtest_digest,
         risk_digest, evaluation_digest
    FROM public.finance_strategy_approvals approvals
    WHERE approvals.id = p_approval_id;
    IF org_id IS NULL OR book_id IS NULL OR evaluation_digest IS NULL THEN
        RAISE EXCEPTION 'order approval not found';
    END IF;
    IF NOT public.can_write_organization(org_id) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    SELECT instruments.symbol, books.ending_quantity
    INTO symbol, ending_quantity
    FROM public.finance_spec_books books
    JOIN public.finance_strategies strategies ON strategies.id = books.strategy_id
    JOIN public.finance_instruments instruments ON instruments.id = strategies.instrument_id
    WHERE books.id = book_id;
    IF symbol IS NULL OR ending_quantity IS NULL THEN
        RAISE EXCEPTION 'order approval not found';
    END IF;
    side_text := CASE WHEN ending_quantity > 0 THEN 'long' ELSE '' END;
    canonical := jsonb_build_object(
        'approval_id', p_approval_id::text,
        'instrument', symbol,
        'side', side_text,
        'quantity', public.finance_money_text(ending_quantity),
        'specification_digest', specification_digest,
        'strategy_digest', strategy_digest,
        'backtest_digest', backtest_digest,
        'risk_digest', risk_digest,
        'evaluation_digest', evaluation_digest
    );
    digest := md5(public.finance_canonical_json(canonical));
    INSERT INTO public.finance_order_intents (
        organization_id, approval_id, book_id, intent, intent_digest, created_by
    ) VALUES (
        org_id, p_approval_id, book_id, canonical, digest, auth.uid()
    )
    RETURNING id INTO new_id;
    PERFORM public.finance_audit(
        org_id,
        'order_intent.created',
        'finance_order_intent',
        new_id,
        jsonb_build_object('intent_digest', digest, 'approval_id', p_approval_id)
    );
    RETURN new_id;
END;
$$;

ALTER TABLE public.finance_order_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_order_intents FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_order_intents_select ON public.finance_order_intents
    FOR SELECT TO app_user
    USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_create_order_intent(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_create_order_intent(uuid, jsonb) TO app_user;

DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON public.finance_order_intents FROM PUBLIC';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.finance_order_intents FROM app_user';
    EXECUTE 'GRANT SELECT ON public.finance_order_intents TO app_user';
END $$;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON public.finance_order_intents FROM %I', r);
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_create_order_intent(uuid, jsonb) FROM %I',
                r
            );
        END IF;
    END LOOP;
END $$;
