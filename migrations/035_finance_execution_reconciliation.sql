-- Execution reconciliation gate 8. Does not alter 001-005 and does not recreate 006-034.
-- A stored sandbox outcome is compared with the execution contract. It does not send.

CREATE TABLE public.finance_execution_reconciliations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    contract_id uuid NOT NULL UNIQUE REFERENCES public.finance_execution_contracts(id) ON DELETE CASCADE,
    dispatch_id uuid NOT NULL UNIQUE REFERENCES public.finance_sandbox_dispatches(id) ON DELETE CASCADE,
    execution_identity text NOT NULL UNIQUE,
    expected_contract jsonb NOT NULL,
    observed_outcome text NOT NULL,
    comparison text NOT NULL,
    result_known boolean NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (observed_outcome IN ('accepted', 'acknowledged', 'rejected', 'timeout', 'unknown')),
    CHECK (comparison IN ('pending', 'terminal', 'unresolved')),
    CHECK (observed_outcome <> 'accepted' OR (comparison = 'pending' AND NOT result_known)),
    CHECK (observed_outcome <> 'acknowledged' OR (comparison = 'pending' AND NOT result_known)),
    CHECK (observed_outcome <> 'rejected' OR (comparison = 'terminal' AND result_known)),
    CHECK (observed_outcome <> 'timeout' OR (comparison = 'unresolved' AND NOT result_known)),
    CHECK (observed_outcome <> 'unknown' OR (comparison = 'unresolved' AND NOT result_known))
);

CREATE INDEX idx_finance_execution_reconciliations_org
    ON public.finance_execution_reconciliations (organization_id);

CREATE OR REPLACE FUNCTION public.finance_sandbox_reconciliation_immutable() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
        OR NEW.contract_id IS DISTINCT FROM OLD.contract_id
        OR NEW.dispatch_id IS DISTINCT FROM OLD.dispatch_id
        OR NEW.execution_identity IS DISTINCT FROM OLD.execution_identity
        OR NEW.expected_contract IS DISTINCT FROM OLD.expected_contract
        OR NEW.observed_outcome IS DISTINCT FROM OLD.observed_outcome
        OR NEW.comparison IS DISTINCT FROM OLD.comparison
        OR NEW.result_known IS DISTINCT FROM OLD.result_known
        OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
        RAISE EXCEPTION 'sandbox reconciliation is immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER finance_sandbox_reconciliation_immutable
    BEFORE UPDATE ON public.finance_execution_reconciliations
    FOR EACH ROW
    EXECUTE PROCEDURE public.finance_sandbox_reconciliation_immutable();

CREATE OR REPLACE FUNCTION public.finance_reconcile_sandbox_execution(
    p_contract_id uuid,
    p_record jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    record_org uuid;
    dispatch_row uuid;
    stored_identity text;
    stored_expected jsonb;
    stored_outcome text;
    contract_expected jsonb;
    comparison_text text;
    known boolean;
    existing_record uuid;
    existing_outcome text;
    existing_expected jsonb;
    new_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF p_record IS NULL
        OR jsonb_typeof(p_record) <> 'object'
        OR p_record <> '{}'::jsonb
        OR public.finance_candidate_command(p_record) THEN
        RAISE EXCEPTION 'sandbox reconciliation is invalid';
    END IF;
    SELECT dispatches.organization_id, dispatches.id, dispatches.execution_identity,
           dispatches.expected_contract, dispatches.outcome, contracts.contract
    INTO record_org, dispatch_row, stored_identity, stored_expected, stored_outcome, contract_expected
    FROM public.finance_sandbox_dispatches dispatches
    JOIN public.finance_execution_contracts contracts ON contracts.id = dispatches.contract_id
    WHERE dispatches.contract_id = p_contract_id;
    IF record_org IS NULL OR dispatch_row IS NULL OR stored_identity IS NULL THEN
        RAISE EXCEPTION 'sandbox dispatch not found';
    END IF;
    IF NOT public.can_write_organization(record_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    IF stored_outcome IS NULL THEN
        RAISE EXCEPTION 'sandbox dispatch is incomplete';
    END IF;
    IF contract_expected IS DISTINCT FROM stored_expected THEN
        RAISE EXCEPTION 'execution contract does not match';
    END IF;
    IF stored_outcome IN ('accepted', 'acknowledged') THEN
        comparison_text := 'pending';
        known := FALSE;
    ELSIF stored_outcome = 'rejected' THEN
        comparison_text := 'terminal';
        known := TRUE;
    ELSIF stored_outcome IN ('timeout', 'unknown') THEN
        comparison_text := 'unresolved';
        known := FALSE;
    ELSE
        RAISE EXCEPTION 'sandbox reconciliation is invalid';
    END IF;
    SELECT records.id, records.observed_outcome, records.expected_contract
    INTO existing_record, existing_outcome, existing_expected
    FROM public.finance_execution_reconciliations records
    WHERE records.execution_identity = stored_identity;
    IF existing_record IS NOT NULL THEN
        IF existing_outcome IS DISTINCT FROM stored_outcome
            OR existing_expected IS DISTINCT FROM contract_expected THEN
            RAISE EXCEPTION 'sandbox reconciliation does not match';
        END IF;
        RETURN existing_record;
    END IF;
    INSERT INTO public.finance_execution_reconciliations (
        organization_id, contract_id, dispatch_id, execution_identity,
        expected_contract, observed_outcome, comparison, result_known, created_by
    ) VALUES (
        record_org, p_contract_id, dispatch_row, stored_identity,
        contract_expected, stored_outcome, comparison_text, known, auth.uid()
    )
    RETURNING id INTO new_id;
    PERFORM public.finance_audit(
        record_org,
        'sandbox_reconciliation.recorded',
        'finance_sandbox_reconciliation',
        new_id,
        jsonb_build_object(
            'execution_identity', stored_identity,
            'observed_outcome', stored_outcome,
            'comparison', comparison_text,
            'result_known', known
        )
    );
    RETURN new_id;
END;
$$;

ALTER TABLE public.finance_execution_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_execution_reconciliations FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_execution_reconciliations_select ON public.finance_execution_reconciliations
    FOR SELECT TO app_user
    USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_reconcile_sandbox_execution(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_sandbox_reconciliation_immutable() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_reconcile_sandbox_execution(uuid, jsonb) TO app_user;

DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON public.finance_execution_reconciliations FROM PUBLIC';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.finance_execution_reconciliations FROM app_user';
    EXECUTE 'GRANT SELECT ON public.finance_execution_reconciliations TO app_user';
END $$;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON public.finance_execution_reconciliations FROM %I', r);
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_reconcile_sandbox_execution(uuid, jsonb) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_sandbox_reconciliation_immutable() FROM %I',
                r
            );
        END IF;
    END LOOP;
END $$;
