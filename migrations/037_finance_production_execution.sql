-- Production execution gate 10. Does not alter 001-005 and does not recreate 006-036.
-- A blocked live boundary refuses the handoff. It does not send.

CREATE TABLE public.finance_production_refusals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    contract_id uuid NOT NULL UNIQUE REFERENCES public.finance_execution_contracts(id) ON DELETE CASCADE,
    boundary_id uuid NOT NULL UNIQUE REFERENCES public.finance_live_boundaries(id) ON DELETE CASCADE,
    execution_identity text NOT NULL UNIQUE,
    expected_contract jsonb NOT NULL,
    observed_outcome text NOT NULL,
    decision text NOT NULL,
    sent boolean NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (observed_outcome IN ('accepted', 'acknowledged', 'rejected', 'timeout', 'unknown')),
    CHECK (decision = 'refused'),
    CHECK (NOT sent)
);

CREATE INDEX idx_finance_production_refusals_org
    ON public.finance_production_refusals (organization_id);

CREATE OR REPLACE FUNCTION public.finance_production_refusal_immutable() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
        OR NEW.contract_id IS DISTINCT FROM OLD.contract_id
        OR NEW.boundary_id IS DISTINCT FROM OLD.boundary_id
        OR NEW.execution_identity IS DISTINCT FROM OLD.execution_identity
        OR NEW.expected_contract IS DISTINCT FROM OLD.expected_contract
        OR NEW.observed_outcome IS DISTINCT FROM OLD.observed_outcome
        OR NEW.decision IS DISTINCT FROM OLD.decision
        OR NEW.sent IS DISTINCT FROM OLD.sent
        OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
        RAISE EXCEPTION 'production execution is immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER finance_production_refusal_immutable
    BEFORE UPDATE ON public.finance_production_refusals
    FOR EACH ROW
    EXECUTE PROCEDURE public.finance_production_refusal_immutable();

CREATE OR REPLACE FUNCTION public.finance_production_execution(
    p_contract_id uuid,
    p_execution jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    refusal_org uuid;
    boundary_row uuid;
    stored_identity text;
    stored_expected jsonb;
    stored_outcome text;
    stored_decision text;
    stored_permitted boolean;
    contract_expected jsonb;
    existing_refusal uuid;
    existing_outcome text;
    existing_expected jsonb;
    new_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF p_execution IS NULL
        OR jsonb_typeof(p_execution) <> 'object'
        OR p_execution <> '{}'::jsonb
        OR public.finance_candidate_command(p_execution) THEN
        RAISE EXCEPTION 'production execution is invalid';
    END IF;
    SELECT boundaries.organization_id, boundaries.id, boundaries.execution_identity,
           boundaries.expected_contract, boundaries.observed_outcome, boundaries.decision,
           boundaries.live_permitted, contracts.contract
    INTO refusal_org, boundary_row, stored_identity, stored_expected, stored_outcome,
         stored_decision, stored_permitted, contract_expected
    FROM public.finance_live_boundaries boundaries
    JOIN public.finance_execution_contracts contracts ON contracts.id = boundaries.contract_id
    WHERE boundaries.contract_id = p_contract_id;
    IF refusal_org IS NULL OR boundary_row IS NULL OR stored_identity IS NULL THEN
        RAISE EXCEPTION 'live boundary not found';
    END IF;
    IF NOT public.can_write_organization(refusal_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    IF contract_expected IS DISTINCT FROM stored_expected THEN
        RAISE EXCEPTION 'execution contract does not match';
    END IF;
    IF stored_permitted OR stored_decision IS DISTINCT FROM 'blocked' THEN
        RAISE EXCEPTION 'live execution is not permitted';
    END IF;
    IF stored_outcome NOT IN ('accepted', 'acknowledged', 'rejected', 'timeout', 'unknown') THEN
        RAISE EXCEPTION 'production execution is invalid';
    END IF;
    SELECT refusals.id, refusals.observed_outcome, refusals.expected_contract
    INTO existing_refusal, existing_outcome, existing_expected
    FROM public.finance_production_refusals refusals
    WHERE refusals.execution_identity = stored_identity;
    IF existing_refusal IS NOT NULL THEN
        IF existing_outcome IS DISTINCT FROM stored_outcome
            OR existing_expected IS DISTINCT FROM contract_expected THEN
            RAISE EXCEPTION 'production execution does not match';
        END IF;
        RETURN existing_refusal;
    END IF;
    INSERT INTO public.finance_production_refusals (
        organization_id, contract_id, boundary_id, execution_identity,
        expected_contract, observed_outcome, decision, sent, created_by
    ) VALUES (
        refusal_org, p_contract_id, boundary_row, stored_identity,
        contract_expected, stored_outcome, 'refused', FALSE, auth.uid()
    )
    RETURNING id INTO new_id;
    PERFORM public.finance_audit(
        refusal_org,
        'production_execution.refused',
        'finance_production_refusal',
        new_id,
        jsonb_build_object(
            'execution_identity', stored_identity,
            'observed_outcome', stored_outcome,
            'decision', 'refused',
            'sent', FALSE
        )
    );
    RETURN new_id;
END;
$$;

ALTER TABLE public.finance_production_refusals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_production_refusals FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_production_refusals_select ON public.finance_production_refusals
    FOR SELECT TO app_user
    USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_production_execution(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_production_refusal_immutable() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_production_execution(uuid, jsonb) TO app_user;

DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON public.finance_production_refusals FROM PUBLIC';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.finance_production_refusals FROM app_user';
    EXECUTE 'GRANT SELECT ON public.finance_production_refusals TO app_user';
END $$;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON public.finance_production_refusals FROM %I', r);
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_production_execution(uuid, jsonb) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_production_refusal_immutable() FROM %I',
                r
            );
        END IF;
    END LOOP;
END $$;
