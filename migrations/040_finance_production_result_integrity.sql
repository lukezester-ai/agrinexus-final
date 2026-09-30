-- Production result integrity P3. Does not alter 001-005 and does not recreate 006-039.
-- A held authorization can be recorded as one unobserved dispatch. It does not send.

CREATE OR REPLACE FUNCTION public.finance_classify_production_observation(p_observation text) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
    IF p_observation IN ('accepted', 'rejected', 'filled', 'partial', 'unknown') THEN
        RETURN p_observation;
    END IF;
    RETURN 'unknown';
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_production_outcome_class(p_result text) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
    IF p_result = 'filled' THEN
        RETURN 'success';
    ELSIF p_result = 'rejected' THEN
        RETURN 'rejected';
    END IF;
    RETURN 'unknown';
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_production_result_is_success(p_result text) RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
    RETURN public.finance_production_outcome_class(p_result) = 'success';
END;
$$;

CREATE TABLE public.finance_production_dispatches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    contract_id uuid NOT NULL UNIQUE REFERENCES public.finance_execution_contracts(id) ON DELETE CASCADE,
    safety_control_id uuid NOT NULL UNIQUE REFERENCES public.finance_production_safety_controls(id) ON DELETE CASCADE,
    production_authorization_id uuid NOT NULL UNIQUE REFERENCES public.finance_production_authorizations(id) ON DELETE CASCADE,
    execution_identity text NOT NULL UNIQUE,
    instrument text NOT NULL,
    side text NOT NULL,
    quantity text NOT NULL,
    authorization_digest text NOT NULL,
    contract_digest text NOT NULL,
    payload_digest text NOT NULL,
    admitted boolean NOT NULL,
    sent boolean NOT NULL,
    live_permitted boolean NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (NOT admitted),
    CHECK (NOT sent),
    CHECK (NOT live_permitted)
);

CREATE INDEX idx_finance_production_dispatches_org
    ON public.finance_production_dispatches (organization_id);

CREATE TABLE public.finance_production_external_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    dispatch_id uuid NOT NULL UNIQUE REFERENCES public.finance_production_dispatches(id) ON DELETE CASCADE,
    contract_id uuid NOT NULL UNIQUE REFERENCES public.finance_execution_contracts(id) ON DELETE CASCADE,
    execution_identity text NOT NULL UNIQUE,
    external_result text NOT NULL,
    outcome_class text NOT NULL,
    success boolean NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (external_result = 'unobserved'),
    CHECK (outcome_class = 'unknown'),
    CHECK (NOT success)
);

CREATE INDEX idx_finance_production_external_results_org
    ON public.finance_production_external_results (organization_id);

CREATE TABLE public.finance_production_result_reconciliations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    result_id uuid NOT NULL UNIQUE REFERENCES public.finance_production_external_results(id) ON DELETE CASCADE,
    dispatch_id uuid NOT NULL UNIQUE REFERENCES public.finance_production_dispatches(id) ON DELETE CASCADE,
    execution_identity text NOT NULL UNIQUE,
    comparison text NOT NULL,
    outcome_class text NOT NULL,
    success boolean NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (comparison = 'unresolved'),
    CHECK (outcome_class = 'unknown'),
    CHECK (NOT success)
);

CREATE INDEX idx_finance_production_result_reconciliations_org
    ON public.finance_production_result_reconciliations (organization_id);

CREATE OR REPLACE FUNCTION public.finance_production_dispatch_immutable() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
        OR NEW.contract_id IS DISTINCT FROM OLD.contract_id
        OR NEW.safety_control_id IS DISTINCT FROM OLD.safety_control_id
        OR NEW.production_authorization_id IS DISTINCT FROM OLD.production_authorization_id
        OR NEW.execution_identity IS DISTINCT FROM OLD.execution_identity
        OR NEW.instrument IS DISTINCT FROM OLD.instrument
        OR NEW.side IS DISTINCT FROM OLD.side
        OR NEW.quantity IS DISTINCT FROM OLD.quantity
        OR NEW.authorization_digest IS DISTINCT FROM OLD.authorization_digest
        OR NEW.contract_digest IS DISTINCT FROM OLD.contract_digest
        OR NEW.payload_digest IS DISTINCT FROM OLD.payload_digest
        OR NEW.admitted IS DISTINCT FROM OLD.admitted
        OR NEW.sent IS DISTINCT FROM OLD.sent
        OR NEW.live_permitted IS DISTINCT FROM OLD.live_permitted
        OR NEW.created_by IS DISTINCT FROM OLD.created_by
        OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'production dispatch is immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER finance_production_dispatch_immutable
    BEFORE UPDATE ON public.finance_production_dispatches
    FOR EACH ROW
    EXECUTE PROCEDURE public.finance_production_dispatch_immutable();

CREATE OR REPLACE FUNCTION public.finance_production_external_result_immutable() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
        OR NEW.dispatch_id IS DISTINCT FROM OLD.dispatch_id
        OR NEW.contract_id IS DISTINCT FROM OLD.contract_id
        OR NEW.execution_identity IS DISTINCT FROM OLD.execution_identity
        OR NEW.external_result IS DISTINCT FROM OLD.external_result
        OR NEW.outcome_class IS DISTINCT FROM OLD.outcome_class
        OR NEW.success IS DISTINCT FROM OLD.success
        OR NEW.created_by IS DISTINCT FROM OLD.created_by
        OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'production external result is immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER finance_production_external_result_immutable
    BEFORE UPDATE ON public.finance_production_external_results
    FOR EACH ROW
    EXECUTE PROCEDURE public.finance_production_external_result_immutable();

CREATE OR REPLACE FUNCTION public.finance_production_result_reconciliation_immutable() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
        OR NEW.result_id IS DISTINCT FROM OLD.result_id
        OR NEW.dispatch_id IS DISTINCT FROM OLD.dispatch_id
        OR NEW.execution_identity IS DISTINCT FROM OLD.execution_identity
        OR NEW.comparison IS DISTINCT FROM OLD.comparison
        OR NEW.outcome_class IS DISTINCT FROM OLD.outcome_class
        OR NEW.success IS DISTINCT FROM OLD.success
        OR NEW.created_by IS DISTINCT FROM OLD.created_by
        OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'production result reconciliation is immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER finance_production_result_reconciliation_immutable
    BEFORE UPDATE ON public.finance_production_result_reconciliations
    FOR EACH ROW
    EXECUTE PROCEDURE public.finance_production_result_reconciliation_immutable();

CREATE OR REPLACE FUNCTION public.finance_record_production_dispatch(
    p_contract_id uuid,
    p_dispatch jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    dispatch_org uuid;
    safety_id uuid;
    production_id uuid;
    stored_identity text;
    stored_instrument text;
    stored_side text;
    stored_quantity text;
    stored_authorization text;
    contract_document jsonb;
    safety_decision text;
    safety_admitted boolean;
    switch_id uuid;
    contract_digest text;
    payload jsonb;
    payload_digest text;
    existing_id uuid;
    new_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF p_dispatch IS NULL
        OR jsonb_typeof(p_dispatch) <> 'object'
        OR p_dispatch <> '{}'::jsonb
        OR public.finance_candidate_command(p_dispatch) THEN
        RAISE EXCEPTION 'production dispatch is invalid';
    END IF;
    PERFORM public.finance_match_production_authorization(p_contract_id);
    SELECT controls.organization_id, controls.id, controls.production_authorization_id,
           controls.execution_identity, controls.decision, controls.admitted,
           contracts.contract->>'instrument', contracts.contract->>'side', contracts.contract->>'quantity',
           grants.authorization_digest, contracts.contract
    INTO dispatch_org, safety_id, production_id, stored_identity, safety_decision, safety_admitted,
         stored_instrument, stored_side, stored_quantity, stored_authorization, contract_document
    FROM public.finance_production_safety_controls controls
    JOIN public.finance_execution_contracts contracts ON contracts.id = controls.contract_id
    JOIN public.finance_production_authorizations grants ON grants.id = controls.production_authorization_id
    WHERE controls.contract_id = p_contract_id;
    IF dispatch_org IS NULL
        OR safety_id IS NULL
        OR production_id IS NULL
        OR stored_identity IS NULL
        OR stored_instrument IS NULL
        OR stored_side IS NULL
        OR stored_quantity IS NULL
        OR stored_authorization IS NULL THEN
        RAISE EXCEPTION 'production safety not found';
    END IF;
    IF NOT public.can_write_organization(dispatch_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    IF safety_decision IS DISTINCT FROM 'held' OR safety_admitted THEN
        RAISE EXCEPTION 'production dispatch is invalid';
    END IF;
    SELECT switches.id
    INTO switch_id
    FROM public.finance_production_kill_switches switches
    WHERE switches.organization_id = dispatch_org
      AND switches.engaged;
    IF switch_id IS NOT NULL THEN
        RAISE EXCEPTION 'production kill switch is engaged';
    END IF;
    contract_digest := md5(public.finance_canonical_json(contract_document));
    payload := jsonb_build_object(
        'authorization_digest', stored_authorization,
        'contract_digest', contract_digest,
        'execution_identity', stored_identity,
        'instrument', stored_instrument,
        'quantity', stored_quantity,
        'side', stored_side
    );
    payload_digest := md5(public.finance_canonical_json(payload));
    SELECT dispatches.id
    INTO existing_id
    FROM public.finance_production_dispatches dispatches
    WHERE dispatches.execution_identity = stored_identity;
    IF existing_id IS NOT NULL THEN
        RETURN existing_id;
    END IF;
    BEGIN
        INSERT INTO public.finance_production_dispatches (
            organization_id, contract_id, safety_control_id, production_authorization_id,
            execution_identity, instrument, side, quantity, authorization_digest,
            contract_digest, payload_digest, admitted, sent, live_permitted, created_by
        ) VALUES (
            dispatch_org, p_contract_id, safety_id, production_id,
            stored_identity, stored_instrument, stored_side, stored_quantity, stored_authorization,
            contract_digest, payload_digest, FALSE, FALSE, FALSE, auth.uid()
        )
        RETURNING id INTO new_id;
    EXCEPTION
        WHEN unique_violation THEN
            SELECT dispatches.id
            INTO existing_id
            FROM public.finance_production_dispatches dispatches
            WHERE dispatches.execution_identity = stored_identity;
            IF existing_id IS NOT NULL THEN
                RETURN existing_id;
            END IF;
            RAISE EXCEPTION 'production dispatch does not match';
    END;
    PERFORM public.finance_audit(
        dispatch_org,
        'production_dispatch.recorded',
        'finance_production_dispatch',
        new_id,
        jsonb_build_object(
            'execution_identity', stored_identity,
            'payload_digest', payload_digest,
            'admitted', FALSE,
            'sent', FALSE,
            'live_permitted', FALSE
        )
    );
    RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_record_production_external_result(
    p_contract_id uuid,
    p_result jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    result_org uuid;
    dispatch_id uuid;
    stored_identity text;
    existing_id uuid;
    new_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF p_result IS NULL
        OR jsonb_typeof(p_result) <> 'object'
        OR p_result <> '{}'::jsonb
        OR public.finance_candidate_command(p_result) THEN
        RAISE EXCEPTION 'production external result is invalid';
    END IF;
    PERFORM public.finance_match_production_authorization(p_contract_id);
    SELECT dispatches.organization_id, dispatches.id, dispatches.execution_identity
    INTO result_org, dispatch_id, stored_identity
    FROM public.finance_production_dispatches dispatches
    WHERE dispatches.contract_id = p_contract_id;
    IF result_org IS NULL OR dispatch_id IS NULL OR stored_identity IS NULL THEN
        RAISE EXCEPTION 'production dispatch not found';
    END IF;
    IF NOT public.can_write_organization(result_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    SELECT results.id
    INTO existing_id
    FROM public.finance_production_external_results results
    WHERE results.execution_identity = stored_identity;
    IF existing_id IS NOT NULL THEN
        RETURN existing_id;
    END IF;
    BEGIN
        INSERT INTO public.finance_production_external_results (
            organization_id, dispatch_id, contract_id, execution_identity,
            external_result, outcome_class, success, created_by
        ) VALUES (
            result_org, dispatch_id, p_contract_id, stored_identity,
            'unobserved', 'unknown', FALSE, auth.uid()
        )
        RETURNING id INTO new_id;
    EXCEPTION
        WHEN unique_violation THEN
            SELECT results.id
            INTO existing_id
            FROM public.finance_production_external_results results
            WHERE results.execution_identity = stored_identity;
            IF existing_id IS NOT NULL THEN
                RETURN existing_id;
            END IF;
            RAISE EXCEPTION 'production external result does not match';
    END;
    PERFORM public.finance_audit(
        result_org,
        'production_external_result.recorded',
        'finance_production_external_result',
        new_id,
        jsonb_build_object(
            'execution_identity', stored_identity,
            'external_result', 'unobserved',
            'outcome_class', 'unknown',
            'success', FALSE
        )
    );
    RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_reconcile_production_result(
    p_contract_id uuid,
    p_record jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    record_org uuid;
    result_id uuid;
    dispatch_id uuid;
    stored_identity text;
    stored_instrument text;
    stored_side text;
    stored_quantity text;
    stored_authorization text;
    stored_contract_digest text;
    stored_payload_digest text;
    stored_result text;
    contract_document jsonb;
    current_authorization text;
    current_contract_digest text;
    current_payload jsonb;
    existing_id uuid;
    new_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF p_record IS NULL
        OR jsonb_typeof(p_record) <> 'object'
        OR p_record <> '{}'::jsonb
        OR public.finance_candidate_command(p_record) THEN
        RAISE EXCEPTION 'production result reconciliation is invalid';
    END IF;
    PERFORM public.finance_match_production_authorization(p_contract_id);
    SELECT results.organization_id, results.id, dispatches.id, dispatches.execution_identity,
           dispatches.instrument, dispatches.side, dispatches.quantity, dispatches.authorization_digest,
           dispatches.contract_digest, dispatches.payload_digest, results.external_result,
           contracts.contract, grants.authorization_digest
    INTO record_org, result_id, dispatch_id, stored_identity, stored_instrument, stored_side,
         stored_quantity, stored_authorization, stored_contract_digest, stored_payload_digest,
         stored_result, contract_document, current_authorization
    FROM public.finance_production_external_results results
    JOIN public.finance_production_dispatches dispatches ON dispatches.id = results.dispatch_id
    JOIN public.finance_execution_contracts contracts ON contracts.id = dispatches.contract_id
    JOIN public.finance_production_authorizations grants
      ON grants.id = dispatches.production_authorization_id
    WHERE results.contract_id = p_contract_id;
    IF record_org IS NULL OR result_id IS NULL OR dispatch_id IS NULL OR stored_identity IS NULL THEN
        RAISE EXCEPTION 'production external result not found';
    END IF;
    IF NOT public.can_write_organization(record_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    current_contract_digest := md5(public.finance_canonical_json(contract_document));
    current_payload := jsonb_build_object(
        'authorization_digest', current_authorization,
        'contract_digest', current_contract_digest,
        'execution_identity', stored_identity,
        'instrument', contract_document->>'instrument',
        'quantity', contract_document->>'quantity',
        'side', contract_document->>'side'
    );
    IF stored_result IS DISTINCT FROM 'unobserved'
        OR public.finance_production_result_is_success(stored_result)
        OR public.finance_production_outcome_class(stored_result) IS DISTINCT FROM 'unknown'
        OR contract_document->>'instrument' IS DISTINCT FROM stored_instrument
        OR contract_document->>'side' IS DISTINCT FROM stored_side
        OR contract_document->>'quantity' IS DISTINCT FROM stored_quantity
        OR current_authorization IS DISTINCT FROM stored_authorization
        OR current_contract_digest IS DISTINCT FROM stored_contract_digest
        OR md5(public.finance_canonical_json(current_payload)) IS DISTINCT FROM stored_payload_digest THEN
        RAISE EXCEPTION 'production result does not match';
    END IF;
    SELECT reconciliations.id
    INTO existing_id
    FROM public.finance_production_result_reconciliations reconciliations
    WHERE reconciliations.execution_identity = stored_identity;
    IF existing_id IS NOT NULL THEN
        RETURN existing_id;
    END IF;
    BEGIN
        INSERT INTO public.finance_production_result_reconciliations (
            organization_id, result_id, dispatch_id, execution_identity,
            comparison, outcome_class, success, created_by
        ) VALUES (
            record_org, result_id, dispatch_id, stored_identity,
            'unresolved', 'unknown', FALSE, auth.uid()
        )
        RETURNING id INTO new_id;
    EXCEPTION
        WHEN unique_violation THEN
            SELECT reconciliations.id
            INTO existing_id
            FROM public.finance_production_result_reconciliations reconciliations
            WHERE reconciliations.execution_identity = stored_identity;
            IF existing_id IS NOT NULL THEN
                RETURN existing_id;
            END IF;
            RAISE EXCEPTION 'production result does not match';
    END;
    PERFORM public.finance_audit(
        record_org,
        'production_result.reconciled',
        'finance_production_result_reconciliation',
        new_id,
        jsonb_build_object(
            'execution_identity', stored_identity,
            'comparison', 'unresolved',
            'outcome_class', 'unknown',
            'success', FALSE
        )
    );
    RETURN new_id;
END;
$$;

ALTER TABLE public.finance_production_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_production_dispatches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_production_external_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_production_external_results FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_production_result_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_production_result_reconciliations FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_production_dispatches_select ON public.finance_production_dispatches
    FOR SELECT TO app_user
    USING (public.is_organization_member(organization_id));

CREATE POLICY finance_production_external_results_select ON public.finance_production_external_results
    FOR SELECT TO app_user
    USING (public.is_organization_member(organization_id));

CREATE POLICY finance_production_result_reconciliations_select ON public.finance_production_result_reconciliations
    FOR SELECT TO app_user
    USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_classify_production_observation(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_production_outcome_class(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_production_result_is_success(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_record_production_dispatch(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_record_production_external_result(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_reconcile_production_result(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_production_dispatch_immutable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_production_external_result_immutable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_production_result_reconciliation_immutable() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_classify_production_observation(text) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_production_outcome_class(text) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_production_result_is_success(text) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_record_production_dispatch(uuid, jsonb) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_record_production_external_result(uuid, jsonb) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_reconcile_production_result(uuid, jsonb) TO app_user;

DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON public.finance_production_dispatches FROM PUBLIC';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.finance_production_dispatches FROM app_user';
    EXECUTE 'GRANT SELECT ON public.finance_production_dispatches TO app_user';
    EXECUTE 'REVOKE ALL ON public.finance_production_external_results FROM PUBLIC';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.finance_production_external_results FROM app_user';
    EXECUTE 'GRANT SELECT ON public.finance_production_external_results TO app_user';
    EXECUTE 'REVOKE ALL ON public.finance_production_result_reconciliations FROM PUBLIC';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.finance_production_result_reconciliations FROM app_user';
    EXECUTE 'GRANT SELECT ON public.finance_production_result_reconciliations TO app_user';
END $$;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON public.finance_production_dispatches FROM %I', r);
            EXECUTE format('REVOKE ALL ON public.finance_production_external_results FROM %I', r);
            EXECUTE format('REVOKE ALL ON public.finance_production_result_reconciliations FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_classify_production_observation(text) FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_production_outcome_class(text) FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_production_result_is_success(text) FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_record_production_dispatch(uuid, jsonb) FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_record_production_external_result(uuid, jsonb) FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_reconcile_production_result(uuid, jsonb) FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_production_dispatch_immutable() FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_production_external_result_immutable() FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_production_result_reconciliation_immutable() FROM %I', r);
        END IF;
    END LOOP;
END $$;
