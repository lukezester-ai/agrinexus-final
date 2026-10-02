-- Live boundary gate 9. Does not alter 001-005 and does not recreate 006-035.
-- A reconciled sandbox outcome stays inside. It does not send.

CREATE TABLE public.finance_live_boundaries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    contract_id uuid NOT NULL UNIQUE REFERENCES public.finance_execution_contracts(id) ON DELETE CASCADE,
    reconciliation_id uuid NOT NULL UNIQUE REFERENCES public.finance_execution_reconciliations(id) ON DELETE CASCADE,
    execution_identity text NOT NULL UNIQUE,
    expected_contract jsonb NOT NULL,
    observed_outcome text NOT NULL,
    decision text NOT NULL,
    live_permitted boolean NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (observed_outcome IN ('accepted', 'acknowledged', 'rejected', 'timeout', 'unknown')),
    CHECK (decision = 'blocked'),
    CHECK (NOT live_permitted)
);

CREATE INDEX idx_finance_live_boundaries_org
    ON public.finance_live_boundaries (organization_id);

CREATE OR REPLACE FUNCTION public.finance_live_boundary_immutable() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
        OR NEW.contract_id IS DISTINCT FROM OLD.contract_id
        OR NEW.reconciliation_id IS DISTINCT FROM OLD.reconciliation_id
        OR NEW.execution_identity IS DISTINCT FROM OLD.execution_identity
        OR NEW.expected_contract IS DISTINCT FROM OLD.expected_contract
        OR NEW.observed_outcome IS DISTINCT FROM OLD.observed_outcome
        OR NEW.decision IS DISTINCT FROM OLD.decision
        OR NEW.live_permitted IS DISTINCT FROM OLD.live_permitted
        OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
        RAISE EXCEPTION 'live boundary is immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER finance_live_boundary_immutable
    BEFORE UPDATE ON public.finance_live_boundaries
    FOR EACH ROW
    EXECUTE PROCEDURE public.finance_live_boundary_immutable();

CREATE OR REPLACE FUNCTION public.finance_live_boundary(
    p_contract_id uuid,
    p_boundary jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    boundary_org uuid;
    reconciliation_row uuid;
    stored_identity text;
    stored_expected jsonb;
    stored_outcome text;
    contract_expected jsonb;
    existing_boundary uuid;
    existing_outcome text;
    existing_expected jsonb;
    new_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF p_boundary IS NULL
        OR jsonb_typeof(p_boundary) <> 'object'
        OR p_boundary <> '{}'::jsonb
        OR public.finance_candidate_command(p_boundary) THEN
        RAISE EXCEPTION 'live boundary is invalid';
    END IF;
    SELECT reconciliations.organization_id, reconciliations.id, reconciliations.execution_identity,
           reconciliations.expected_contract, reconciliations.observed_outcome, contracts.contract
    INTO boundary_org, reconciliation_row, stored_identity, stored_expected, stored_outcome, contract_expected
    FROM public.finance_execution_reconciliations reconciliations
    JOIN public.finance_execution_contracts contracts ON contracts.id = reconciliations.contract_id
    WHERE reconciliations.contract_id = p_contract_id;
    IF boundary_org IS NULL OR reconciliation_row IS NULL OR stored_identity IS NULL THEN
        RAISE EXCEPTION 'sandbox reconciliation not found';
    END IF;
    IF NOT public.can_write_organization(boundary_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    IF contract_expected IS DISTINCT FROM stored_expected THEN
        RAISE EXCEPTION 'execution contract does not match';
    END IF;
    IF stored_outcome NOT IN ('accepted', 'acknowledged', 'rejected', 'timeout', 'unknown') THEN
        RAISE EXCEPTION 'live boundary is invalid';
    END IF;
    SELECT boundaries.id, boundaries.observed_outcome, boundaries.expected_contract
    INTO existing_boundary, existing_outcome, existing_expected
    FROM public.finance_live_boundaries boundaries
    WHERE boundaries.execution_identity = stored_identity;
    IF existing_boundary IS NOT NULL THEN
        IF existing_outcome IS DISTINCT FROM stored_outcome
            OR existing_expected IS DISTINCT FROM contract_expected THEN
            RAISE EXCEPTION 'live boundary does not match';
        END IF;
        RETURN existing_boundary;
    END IF;
    INSERT INTO public.finance_live_boundaries (
        organization_id, contract_id, reconciliation_id, execution_identity,
        expected_contract, observed_outcome, decision, live_permitted, created_by
    ) VALUES (
        boundary_org, p_contract_id, reconciliation_row, stored_identity,
        contract_expected, stored_outcome, 'blocked', FALSE, auth.uid()
    )
    RETURNING id INTO new_id;
    PERFORM public.finance_audit(
        boundary_org,
        'live_boundary.blocked',
        'finance_live_boundary',
        new_id,
        jsonb_build_object(
            'execution_identity', stored_identity,
            'observed_outcome', stored_outcome,
            'decision', 'blocked',
            'live_permitted', FALSE
        )
    );
    RETURN new_id;
END;
$$;

ALTER TABLE public.finance_live_boundaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_live_boundaries FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_live_boundaries_select ON public.finance_live_boundaries
    FOR SELECT TO app_user
    USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_live_boundary(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_live_boundary_immutable() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_live_boundary(uuid, jsonb) TO app_user;

DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON public.finance_live_boundaries FROM PUBLIC';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.finance_live_boundaries FROM app_user';
    EXECUTE 'GRANT SELECT ON public.finance_live_boundaries TO app_user';
END $$;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON public.finance_live_boundaries FROM %I', r);
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_live_boundary(uuid, jsonb) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_live_boundary_immutable() FROM %I',
                r
            );
        END IF;
    END LOOP;
END $$;
