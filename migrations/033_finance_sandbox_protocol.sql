-- Sandbox execution protocol gate 6. Does not alter 001-005 and does not recreate 006-032.
-- The protocol records the state of one execution contract. It does not send.

CREATE TABLE public.finance_sandbox_protocols (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    contract_id uuid NOT NULL UNIQUE REFERENCES public.finance_execution_contracts(id) ON DELETE CASCADE,
    execution_identity text NOT NULL UNIQUE,
    expected_contract jsonb NOT NULL,
    status text NOT NULL,
    result_status text NOT NULL,
    result_known boolean NOT NULL,
    reconciliation_required boolean NOT NULL,
    opened_by uuid NOT NULL,
    opened_at timestamptz NOT NULL DEFAULT now(),
    CHECK (status IN ('accepted', 'acknowledged', 'rejected', 'timeout')),
    CHECK (result_status IN ('pending', 'unknown', 'rejected')),
    CHECK (status <> 'accepted' OR (result_status = 'pending' AND NOT result_known AND NOT reconciliation_required)),
    CHECK (status <> 'acknowledged' OR (result_status = 'pending' AND NOT result_known AND NOT reconciliation_required)),
    CHECK (status <> 'rejected' OR (result_status = 'rejected' AND result_known AND NOT reconciliation_required)),
    CHECK (status <> 'timeout' OR (result_status = 'unknown' AND NOT result_known AND reconciliation_required))
);

CREATE INDEX idx_finance_sandbox_protocols_org
    ON public.finance_sandbox_protocols (organization_id);

CREATE TABLE public.finance_sandbox_reconciliations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    protocol_id uuid NOT NULL UNIQUE REFERENCES public.finance_sandbox_protocols(id) ON DELETE CASCADE,
    execution_identity text NOT NULL,
    expected_contract jsonb NOT NULL,
    observed_contract jsonb,
    comparison text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (observed_contract IS NULL),
    CHECK (comparison = 'unobserved')
);

CREATE INDEX idx_finance_sandbox_reconciliations_org
    ON public.finance_sandbox_reconciliations (organization_id);

CREATE OR REPLACE FUNCTION public.finance_sandbox_protocol_immutable() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.execution_identity IS DISTINCT FROM OLD.execution_identity
        OR NEW.contract_id IS DISTINCT FROM OLD.contract_id
        OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
        OR NEW.expected_contract IS DISTINCT FROM OLD.expected_contract
        OR NEW.opened_by IS DISTINCT FROM OLD.opened_by
        OR NEW.opened_at IS DISTINCT FROM OLD.opened_at THEN
        RAISE EXCEPTION 'sandbox protocol is immutable';
    END IF;
    IF OLD.status = 'rejected' AND (
        NEW.status IS DISTINCT FROM OLD.status
        OR NEW.result_status IS DISTINCT FROM OLD.result_status
        OR NEW.result_known IS DISTINCT FROM OLD.result_known
        OR NEW.reconciliation_required IS DISTINCT FROM OLD.reconciliation_required
    ) THEN
        RAISE EXCEPTION 'sandbox protocol is rejected';
    END IF;
    IF OLD.status = 'timeout' AND (
        NEW.status IS DISTINCT FROM 'timeout'
        OR NEW.result_status IS DISTINCT FROM 'unknown'
        OR NEW.result_known IS DISTINCT FROM FALSE
        OR NEW.reconciliation_required IS DISTINCT FROM TRUE
    ) THEN
        RAISE EXCEPTION 'sandbox protocol is unknown';
    END IF;
    IF OLD.status = 'accepted' AND NEW.status = 'acknowledged'
        AND NEW.result_status = 'pending'
        AND NEW.result_known = FALSE
        AND NEW.reconciliation_required = FALSE THEN
        RETURN NEW;
    END IF;
    IF OLD.status IN ('accepted', 'acknowledged') AND NEW.status = 'rejected'
        AND NEW.result_status = 'rejected'
        AND NEW.result_known = TRUE
        AND NEW.reconciliation_required = FALSE THEN
        RETURN NEW;
    END IF;
    IF OLD.status IN ('accepted', 'acknowledged') AND NEW.status = 'timeout'
        AND NEW.result_status = 'unknown'
        AND NEW.result_known = FALSE
        AND NEW.reconciliation_required = TRUE THEN
        RETURN NEW;
    END IF;
    IF OLD.status = NEW.status
        AND OLD.result_status IS NOT DISTINCT FROM NEW.result_status
        AND OLD.result_known IS NOT DISTINCT FROM NEW.result_known
        AND OLD.reconciliation_required IS NOT DISTINCT FROM NEW.reconciliation_required THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'sandbox protocol is invalid';
END;
$$;

CREATE TRIGGER finance_sandbox_protocol_immutable
    BEFORE UPDATE ON public.finance_sandbox_protocols
    FOR EACH ROW
    EXECUTE PROCEDURE public.finance_sandbox_protocol_immutable();

CREATE OR REPLACE FUNCTION public.finance_sandbox_protocol(
    p_contract_id uuid,
    p_event text,
    p_protocol jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    protocol_org uuid;
    stored_identity text;
    stored_expected jsonb;
    existing_protocol uuid;
    existing_contract uuid;
    current_status text;
    current_result text;
    current_known boolean;
    current_reconciliation boolean;
    snapshot_expected jsonb;
    existing_reconciliation uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF p_protocol IS NULL
        OR jsonb_typeof(p_protocol) <> 'object'
        OR p_protocol <> '{}'::jsonb
        OR public.finance_candidate_command(p_protocol)
        OR p_event IS NULL
        OR p_event NOT IN ('open', 'acknowledge', 'reject', 'timeout', 'reconcile') THEN
        RAISE EXCEPTION 'sandbox protocol is invalid';
    END IF;
    SELECT contracts.organization_id, contracts.execution_identity, contracts.contract
    INTO protocol_org, stored_identity, stored_expected
    FROM public.finance_execution_contracts contracts
    WHERE contracts.id = p_contract_id;
    IF protocol_org IS NULL OR stored_identity IS NULL OR stored_expected IS NULL THEN
        RAISE EXCEPTION 'execution contract not found';
    END IF;
    IF NOT public.can_write_organization(protocol_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    SELECT protocols.id, protocols.contract_id, protocols.status, protocols.result_status,
           protocols.result_known, protocols.reconciliation_required, protocols.expected_contract
    INTO existing_protocol, existing_contract, current_status, current_result,
         current_known, current_reconciliation, snapshot_expected
    FROM public.finance_sandbox_protocols protocols
    WHERE protocols.execution_identity = stored_identity;

    IF p_event = 'open' THEN
        IF existing_protocol IS NULL THEN
            INSERT INTO public.finance_sandbox_protocols (
                organization_id, contract_id, execution_identity, expected_contract,
                status, result_status, result_known, reconciliation_required, opened_by
            ) VALUES (
                protocol_org, p_contract_id, stored_identity, stored_expected,
                'accepted', 'pending', FALSE, FALSE, auth.uid()
            )
            RETURNING id INTO existing_protocol;
            PERFORM public.finance_audit(
                protocol_org,
                'sandbox_protocol.accepted',
                'finance_sandbox_protocol',
                existing_protocol,
                jsonb_build_object('execution_identity', stored_identity, 'contract_id', p_contract_id)
            );
        ELSIF existing_contract IS DISTINCT FROM p_contract_id
            OR snapshot_expected IS DISTINCT FROM stored_expected THEN
            RAISE EXCEPTION 'sandbox protocol does not match';
        END IF;
        RETURN existing_protocol;
    END IF;

    IF existing_protocol IS NULL THEN
        RAISE EXCEPTION 'sandbox protocol not found';
    END IF;
    IF existing_contract IS DISTINCT FROM p_contract_id
        OR snapshot_expected IS DISTINCT FROM stored_expected THEN
        RAISE EXCEPTION 'sandbox protocol does not match';
    END IF;

    IF p_event = 'acknowledge' THEN
        IF current_status = 'acknowledged' THEN
            RETURN existing_protocol;
        END IF;
        IF current_status = 'rejected' THEN
            RAISE EXCEPTION 'sandbox protocol is rejected';
        END IF;
        IF current_status = 'timeout' THEN
            RAISE EXCEPTION 'sandbox protocol is unknown';
        END IF;
        UPDATE public.finance_sandbox_protocols protocols
        SET status = 'acknowledged'
        WHERE protocols.id = existing_protocol;
        PERFORM public.finance_audit(
            protocol_org,
            'sandbox_protocol.acknowledged',
            'finance_sandbox_protocol',
            existing_protocol,
            jsonb_build_object('execution_identity', stored_identity, 'result_known', FALSE)
        );
        RETURN existing_protocol;
    END IF;

    IF p_event = 'reject' THEN
        IF current_status = 'rejected' THEN
            RETURN existing_protocol;
        END IF;
        IF current_status = 'timeout' THEN
            RAISE EXCEPTION 'sandbox protocol is unknown';
        END IF;
        UPDATE public.finance_sandbox_protocols protocols
        SET status = 'rejected', result_status = 'rejected', result_known = TRUE
        WHERE protocols.id = existing_protocol;
        PERFORM public.finance_audit(
            protocol_org,
            'sandbox_protocol.rejected',
            'finance_sandbox_protocol',
            existing_protocol,
            jsonb_build_object('execution_identity', stored_identity, 'result_known', TRUE)
        );
        RETURN existing_protocol;
    END IF;

    IF p_event = 'timeout' THEN
        IF current_status = 'timeout' THEN
            RETURN existing_protocol;
        END IF;
        IF current_status = 'rejected' THEN
            RAISE EXCEPTION 'sandbox protocol is rejected';
        END IF;
        UPDATE public.finance_sandbox_protocols protocols
        SET status = 'timeout', result_status = 'unknown', reconciliation_required = TRUE
        WHERE protocols.id = existing_protocol;
        PERFORM public.finance_audit(
            protocol_org,
            'sandbox_protocol.timed_out',
            'finance_sandbox_protocol',
            existing_protocol,
            jsonb_build_object(
                'execution_identity', stored_identity,
                'result_status', 'unknown',
                'reconciliation_required', TRUE
            )
        );
        RETURN existing_protocol;
    END IF;

    IF current_status <> 'timeout' OR current_reconciliation IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'sandbox reconciliation is not required';
    END IF;
    SELECT reconciliations.id
    INTO existing_reconciliation
    FROM public.finance_sandbox_reconciliations reconciliations
    WHERE reconciliations.protocol_id = existing_protocol;
    IF existing_reconciliation IS NULL THEN
        INSERT INTO public.finance_sandbox_reconciliations (
            organization_id, protocol_id, execution_identity, expected_contract,
            observed_contract, comparison, created_by
        ) VALUES (
            protocol_org, existing_protocol, stored_identity, snapshot_expected,
            NULL, 'unobserved', auth.uid()
        )
        RETURNING id INTO existing_reconciliation;
        PERFORM public.finance_audit(
            protocol_org,
            'sandbox_protocol.reconciled',
            'finance_sandbox_reconciliation',
            existing_reconciliation,
            jsonb_build_object(
                'execution_identity', stored_identity,
                'comparison', 'unobserved',
                'result_known', FALSE
            )
        );
    END IF;
    RETURN existing_protocol;
END;
$$;

ALTER TABLE public.finance_sandbox_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_sandbox_protocols FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_sandbox_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_sandbox_reconciliations FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_sandbox_protocols_select ON public.finance_sandbox_protocols
    FOR SELECT TO app_user
    USING (public.is_organization_member(organization_id));

CREATE POLICY finance_sandbox_reconciliations_select ON public.finance_sandbox_reconciliations
    FOR SELECT TO app_user
    USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_sandbox_protocol(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_sandbox_protocol_immutable() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_sandbox_protocol(uuid, text, jsonb) TO app_user;

DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON public.finance_sandbox_protocols FROM PUBLIC';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.finance_sandbox_protocols FROM app_user';
    EXECUTE 'GRANT SELECT ON public.finance_sandbox_protocols TO app_user';
    EXECUTE 'REVOKE ALL ON public.finance_sandbox_reconciliations FROM PUBLIC';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.finance_sandbox_reconciliations FROM app_user';
    EXECUTE 'GRANT SELECT ON public.finance_sandbox_reconciliations TO app_user';
END $$;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON public.finance_sandbox_protocols FROM %I', r);
            EXECUTE format('REVOKE ALL ON public.finance_sandbox_reconciliations FROM %I', r);
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_sandbox_protocol(uuid, text, jsonb) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_sandbox_protocol_immutable() FROM %I',
                r
            );
        END IF;
    END LOOP;
END $$;
