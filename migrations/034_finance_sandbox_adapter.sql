-- Sandbox adapter gate 7. Does not alter 001-005 and does not recreate 006-033.
-- One protocol may be sent only to the configured sandbox. It cannot name another endpoint.

CREATE TABLE public.finance_sandbox_dispatches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    contract_id uuid NOT NULL UNIQUE REFERENCES public.finance_execution_contracts(id) ON DELETE CASCADE,
    protocol_id uuid NOT NULL UNIQUE REFERENCES public.finance_sandbox_protocols(id) ON DELETE CASCADE,
    execution_identity text NOT NULL UNIQUE,
    expected_contract jsonb NOT NULL,
    sandbox_url text NOT NULL,
    outcome text,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (sandbox_url = 'http://127.0.0.1:54345/sandbox'),
    CHECK (outcome IS NULL OR outcome IN ('accepted', 'acknowledged', 'rejected', 'timeout', 'unknown'))
);

CREATE INDEX idx_finance_sandbox_dispatches_org
    ON public.finance_sandbox_dispatches (organization_id);

CREATE OR REPLACE FUNCTION public.finance_sandbox_dispatch_immutable() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.sandbox_url IS DISTINCT FROM 'http://127.0.0.1:54345/sandbox'
        OR NEW.sandbox_url IS DISTINCT FROM OLD.sandbox_url THEN
        RAISE EXCEPTION 'production endpoint is impossible';
    END IF;
    IF NEW.execution_identity IS DISTINCT FROM OLD.execution_identity
        OR NEW.contract_id IS DISTINCT FROM OLD.contract_id
        OR NEW.protocol_id IS DISTINCT FROM OLD.protocol_id
        OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
        OR NEW.expected_contract IS DISTINCT FROM OLD.expected_contract
        OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
        RAISE EXCEPTION 'sandbox adapter is immutable';
    END IF;
    IF OLD.outcome IS NOT NULL AND NEW.outcome IS DISTINCT FROM OLD.outcome THEN
        RAISE EXCEPTION 'sandbox adapter does not match';
    END IF;
    IF NEW.outcome IS NOT NULL
        AND NEW.outcome NOT IN ('accepted', 'acknowledged', 'rejected', 'timeout', 'unknown') THEN
        RAISE EXCEPTION 'sandbox adapter is invalid';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER finance_sandbox_dispatch_immutable
    BEFORE UPDATE ON public.finance_sandbox_dispatches
    FOR EACH ROW
    EXECUTE PROCEDURE public.finance_sandbox_dispatch_immutable();

CREATE OR REPLACE FUNCTION public.finance_begin_sandbox_dispatch(
    p_contract_id uuid,
    p_adapter jsonb
) RETURNS TABLE (
    dispatch_id uuid,
    endpoint text,
    execution_identity text,
    expected_contract jsonb,
    send_required boolean,
    outcome text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    protocol_org uuid;
    protocol_row uuid;
    protocol_status text;
    stored_identity text;
    stored_expected jsonb;
    existing_dispatch uuid;
    existing_contract uuid;
    existing_outcome text;
    sandbox_endpoint text := 'http://127.0.0.1:54345/sandbox';
    new_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF p_adapter IS NULL
        OR jsonb_typeof(p_adapter) <> 'object'
        OR p_adapter <> '{}'::jsonb
        OR public.finance_candidate_command(p_adapter) THEN
        RAISE EXCEPTION 'sandbox adapter is invalid';
    END IF;
    SELECT protocols.organization_id, protocols.id, protocols.status,
           protocols.execution_identity, protocols.expected_contract
    INTO protocol_org, protocol_row, protocol_status, stored_identity, stored_expected
    FROM public.finance_sandbox_protocols protocols
    WHERE protocols.contract_id = p_contract_id;
    IF protocol_org IS NULL OR protocol_row IS NULL OR stored_identity IS NULL THEN
        RAISE EXCEPTION 'sandbox protocol not found';
    END IF;
    IF NOT public.can_write_organization(protocol_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    SELECT dispatches.id, dispatches.contract_id, dispatches.outcome
    INTO existing_dispatch, existing_contract, existing_outcome
    FROM public.finance_sandbox_dispatches dispatches
    WHERE dispatches.execution_identity = stored_identity;
    IF existing_dispatch IS NOT NULL THEN
        IF existing_contract IS DISTINCT FROM p_contract_id THEN
            RAISE EXCEPTION 'sandbox adapter does not match';
        END IF;
        dispatch_id := existing_dispatch;
        endpoint := sandbox_endpoint;
        execution_identity := stored_identity;
        expected_contract := stored_expected;
        send_required := FALSE;
        outcome := existing_outcome;
        RETURN NEXT;
        RETURN;
    END IF;
    IF protocol_status = 'rejected' THEN
        RAISE EXCEPTION 'sandbox protocol is rejected';
    END IF;
    IF protocol_status = 'timeout' THEN
        RAISE EXCEPTION 'sandbox protocol is unknown';
    END IF;
    IF protocol_status <> 'accepted' THEN
        RAISE EXCEPTION 'sandbox adapter is not accepted';
    END IF;
    INSERT INTO public.finance_sandbox_dispatches (
        organization_id, contract_id, protocol_id, execution_identity,
        expected_contract, sandbox_url, created_by
    ) VALUES (
        protocol_org, p_contract_id, protocol_row, stored_identity,
        stored_expected, sandbox_endpoint, auth.uid()
    )
    RETURNING id INTO new_id;
    dispatch_id := new_id;
    endpoint := sandbox_endpoint;
    execution_identity := stored_identity;
    expected_contract := stored_expected;
    send_required := TRUE;
    outcome := NULL;
    RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_finish_sandbox_dispatch(
    p_contract_id uuid,
    p_outcome text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    protocol_org uuid;
    existing_dispatch uuid;
    stored_identity text;
    stored_outcome text;
    result_known boolean;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF p_outcome IS NULL
        OR p_outcome NOT IN ('accepted', 'acknowledged', 'rejected', 'timeout', 'unknown') THEN
        RAISE EXCEPTION 'sandbox adapter is invalid';
    END IF;
    SELECT dispatches.organization_id, dispatches.id, dispatches.execution_identity, dispatches.outcome
    INTO protocol_org, existing_dispatch, stored_identity, stored_outcome
    FROM public.finance_sandbox_dispatches dispatches
    WHERE dispatches.contract_id = p_contract_id;
    IF existing_dispatch IS NULL OR protocol_org IS NULL THEN
        RAISE EXCEPTION 'sandbox protocol not found';
    END IF;
    IF NOT public.can_write_organization(protocol_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    IF stored_outcome IS NOT NULL THEN
        IF stored_outcome IS DISTINCT FROM p_outcome THEN
            RAISE EXCEPTION 'sandbox adapter does not match';
        END IF;
        RETURN existing_dispatch;
    END IF;
    UPDATE public.finance_sandbox_dispatches dispatches
    SET outcome = p_outcome
    WHERE dispatches.id = existing_dispatch;
    result_known := p_outcome = 'rejected';
    IF p_outcome = 'acknowledged' THEN
        PERFORM public.finance_sandbox_protocol(p_contract_id, 'acknowledge', '{}'::jsonb);
    ELSIF p_outcome = 'rejected' THEN
        PERFORM public.finance_sandbox_protocol(p_contract_id, 'reject', '{}'::jsonb);
    ELSIF p_outcome IN ('timeout', 'unknown') THEN
        PERFORM public.finance_sandbox_protocol(p_contract_id, 'timeout', '{}'::jsonb);
    END IF;
    PERFORM public.finance_audit(
        protocol_org,
        'sandbox_adapter.' || p_outcome,
        'finance_sandbox_dispatch',
        existing_dispatch,
        jsonb_build_object(
            'execution_identity', stored_identity,
            'endpoint', 'http://127.0.0.1:54345/sandbox',
            'outcome', p_outcome,
            'result_known', result_known
        )
    );
    RETURN existing_dispatch;
END;
$$;

ALTER TABLE public.finance_sandbox_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_sandbox_dispatches FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_sandbox_dispatches_select ON public.finance_sandbox_dispatches
    FOR SELECT TO app_user
    USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_begin_sandbox_dispatch(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_finish_sandbox_dispatch(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_sandbox_dispatch_immutable() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_begin_sandbox_dispatch(uuid, jsonb) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_finish_sandbox_dispatch(uuid, text) TO app_user;

DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON public.finance_sandbox_dispatches FROM PUBLIC';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.finance_sandbox_dispatches FROM app_user';
    EXECUTE 'GRANT SELECT ON public.finance_sandbox_dispatches TO app_user';
END $$;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON public.finance_sandbox_dispatches FROM %I', r);
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_begin_sandbox_dispatch(uuid, jsonb) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_finish_sandbox_dispatch(uuid, text) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_sandbox_dispatch_immutable() FROM %I',
                r
            );
        END IF;
    END LOOP;
END $$;
