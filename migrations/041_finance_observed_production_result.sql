-- Observed production result P5. Does not alter 001-005 and does not recreate 006-040.
-- An observation is recorded against one dispatch. It does not send.

CREATE TABLE public.finance_observed_production_results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    dispatch_id uuid NOT NULL UNIQUE REFERENCES public.finance_production_dispatches(id) ON DELETE CASCADE,
    contract_id uuid NOT NULL UNIQUE REFERENCES public.finance_execution_contracts(id) ON DELETE CASCADE,
    execution_identity text NOT NULL UNIQUE,
    instrument text NOT NULL,
    side text NOT NULL,
    quantity text NOT NULL,
    authorization_digest text NOT NULL,
    contract_digest text NOT NULL,
    payload_digest text NOT NULL,
    external_result text NOT NULL,
    outcome_class text NOT NULL,
    success boolean NOT NULL,
    admitted boolean NOT NULL,
    sent boolean NOT NULL,
    live_permitted boolean NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (external_result IN ('accepted', 'rejected', 'filled', 'partial', 'unknown')),
    CHECK (
        (external_result = 'filled' AND outcome_class = 'success' AND success)
        OR (external_result = 'rejected' AND outcome_class = 'rejected' AND NOT success)
        OR (external_result IN ('accepted', 'partial', 'unknown') AND outcome_class = 'unknown' AND NOT success)
    ),
    CHECK (NOT admitted),
    CHECK (NOT sent),
    CHECK (NOT live_permitted)
);

CREATE INDEX idx_finance_observed_production_results_org
    ON public.finance_observed_production_results (organization_id);

CREATE TABLE public.finance_observed_result_reconciliations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    observed_result_id uuid NOT NULL UNIQUE REFERENCES public.finance_observed_production_results(id) ON DELETE CASCADE,
    dispatch_id uuid NOT NULL UNIQUE REFERENCES public.finance_production_dispatches(id) ON DELETE CASCADE,
    execution_identity text NOT NULL UNIQUE,
    comparison text NOT NULL,
    outcome_class text NOT NULL,
    success boolean NOT NULL,
    sent boolean NOT NULL,
    live_permitted boolean NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (
        (comparison = 'matched' AND outcome_class = 'success' AND success)
        OR (comparison = 'terminal' AND outcome_class = 'rejected' AND NOT success)
        OR (comparison = 'unresolved' AND outcome_class = 'unknown' AND NOT success)
    ),
    CHECK (NOT sent),
    CHECK (NOT live_permitted)
);

CREATE INDEX idx_finance_observed_result_reconciliations_org
    ON public.finance_observed_result_reconciliations (organization_id);

CREATE OR REPLACE FUNCTION public.finance_observed_production_result_immutable() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
        OR NEW.dispatch_id IS DISTINCT FROM OLD.dispatch_id
        OR NEW.contract_id IS DISTINCT FROM OLD.contract_id
        OR NEW.execution_identity IS DISTINCT FROM OLD.execution_identity
        OR NEW.instrument IS DISTINCT FROM OLD.instrument
        OR NEW.side IS DISTINCT FROM OLD.side
        OR NEW.quantity IS DISTINCT FROM OLD.quantity
        OR NEW.authorization_digest IS DISTINCT FROM OLD.authorization_digest
        OR NEW.contract_digest IS DISTINCT FROM OLD.contract_digest
        OR NEW.payload_digest IS DISTINCT FROM OLD.payload_digest
        OR NEW.external_result IS DISTINCT FROM OLD.external_result
        OR NEW.outcome_class IS DISTINCT FROM OLD.outcome_class
        OR NEW.success IS DISTINCT FROM OLD.success
        OR NEW.admitted IS DISTINCT FROM OLD.admitted
        OR NEW.sent IS DISTINCT FROM OLD.sent
        OR NEW.live_permitted IS DISTINCT FROM OLD.live_permitted
        OR NEW.created_by IS DISTINCT FROM OLD.created_by
        OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'production observed result is immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER finance_observed_production_result_immutable
    BEFORE UPDATE ON public.finance_observed_production_results
    FOR EACH ROW
    EXECUTE PROCEDURE public.finance_observed_production_result_immutable();

CREATE OR REPLACE FUNCTION public.finance_observed_result_reconciliation_immutable() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
        OR NEW.observed_result_id IS DISTINCT FROM OLD.observed_result_id
        OR NEW.dispatch_id IS DISTINCT FROM OLD.dispatch_id
        OR NEW.execution_identity IS DISTINCT FROM OLD.execution_identity
        OR NEW.comparison IS DISTINCT FROM OLD.comparison
        OR NEW.outcome_class IS DISTINCT FROM OLD.outcome_class
        OR NEW.success IS DISTINCT FROM OLD.success
        OR NEW.sent IS DISTINCT FROM OLD.sent
        OR NEW.live_permitted IS DISTINCT FROM OLD.live_permitted
        OR NEW.created_by IS DISTINCT FROM OLD.created_by
        OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'production observed reconciliation is immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER finance_observed_result_reconciliation_immutable
    BEFORE UPDATE ON public.finance_observed_result_reconciliations
    FOR EACH ROW
    EXECUTE PROCEDURE public.finance_observed_result_reconciliation_immutable();

CREATE OR REPLACE FUNCTION public.finance_record_observed_production_result(
    p_contract_id uuid,
    p_observation text,
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
    stored_instrument text;
    stored_side text;
    stored_quantity text;
    stored_authorization text;
    stored_contract_digest text;
    stored_payload_digest text;
    dispatch_admitted boolean;
    dispatch_sent boolean;
    dispatch_permitted boolean;
    contract_document jsonb;
    current_authorization text;
    current_contract_digest text;
    recomputed_payload_digest text;
    classified text;
    outcome_text text;
    succeeded boolean;
    existing_id uuid;
    existing_result text;
    new_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF p_result IS NULL
        OR jsonb_typeof(p_result) <> 'object'
        OR p_result <> '{}'::jsonb
        OR public.finance_candidate_command(p_result)
        OR p_observation IS NULL
        OR p_observation NOT IN (
            'accepted', 'rejected', 'filled', 'partial', 'unknown', 'timeout', 'missing', 'invalid'
        ) THEN
        RAISE EXCEPTION 'production observed result is invalid';
    END IF;
    PERFORM public.finance_match_production_authorization(p_contract_id);
    classified := public.finance_classify_production_observation(p_observation);
    outcome_text := public.finance_production_outcome_class(classified);
    succeeded := public.finance_production_result_is_success(classified);
    SELECT dispatches.organization_id, dispatches.id, dispatches.execution_identity,
           dispatches.instrument, dispatches.side, dispatches.quantity,
           dispatches.authorization_digest, dispatches.contract_digest, dispatches.payload_digest,
           dispatches.admitted, dispatches.sent, dispatches.live_permitted,
           contracts.contract, grants.authorization_digest
    INTO result_org, dispatch_id, stored_identity, stored_instrument, stored_side, stored_quantity,
         stored_authorization, stored_contract_digest, stored_payload_digest,
         dispatch_admitted, dispatch_sent, dispatch_permitted,
         contract_document, current_authorization
    FROM public.finance_production_dispatches dispatches
    JOIN public.finance_execution_contracts contracts ON contracts.id = dispatches.contract_id
    JOIN public.finance_production_authorizations grants
      ON grants.id = dispatches.production_authorization_id
    WHERE dispatches.contract_id = p_contract_id;
    IF result_org IS NULL OR dispatch_id IS NULL OR stored_identity IS NULL THEN
        RAISE EXCEPTION 'production dispatch not found';
    END IF;
    IF NOT public.can_write_organization(result_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    current_contract_digest := md5(public.finance_canonical_json(contract_document));
    recomputed_payload_digest := md5(public.finance_canonical_json(jsonb_build_object(
        'authorization_digest', stored_authorization,
        'contract_digest', stored_contract_digest,
        'execution_identity', stored_identity,
        'instrument', stored_instrument,
        'quantity', stored_quantity,
        'side', stored_side
    )));
    IF dispatch_admitted OR dispatch_sent OR dispatch_permitted
        OR contract_document->>'instrument' IS DISTINCT FROM stored_instrument
        OR contract_document->>'side' IS DISTINCT FROM stored_side
        OR contract_document->>'quantity' IS DISTINCT FROM stored_quantity
        OR current_authorization IS DISTINCT FROM stored_authorization
        OR current_contract_digest IS DISTINCT FROM stored_contract_digest
        OR recomputed_payload_digest IS DISTINCT FROM stored_payload_digest
        OR succeeded IS DISTINCT FROM (classified = 'filled')
        OR outcome_text IS DISTINCT FROM public.finance_production_outcome_class(classified) THEN
        RAISE EXCEPTION 'production result does not match';
    END IF;
    SELECT observed.id, observed.external_result
    INTO existing_id, existing_result
    FROM public.finance_observed_production_results observed
    WHERE observed.execution_identity = stored_identity;
    IF existing_id IS NOT NULL THEN
        IF existing_result IS DISTINCT FROM classified THEN
            RAISE EXCEPTION 'production result does not match';
        END IF;
        RETURN existing_id;
    END IF;
    BEGIN
        INSERT INTO public.finance_observed_production_results (
            organization_id, dispatch_id, contract_id, execution_identity, instrument, side, quantity,
            authorization_digest, contract_digest, payload_digest, external_result, outcome_class,
            success, admitted, sent, live_permitted, created_by
        ) VALUES (
            result_org, dispatch_id, p_contract_id, stored_identity, stored_instrument, stored_side,
            stored_quantity, stored_authorization, stored_contract_digest, stored_payload_digest,
            classified, outcome_text, succeeded, FALSE, FALSE, FALSE, auth.uid()
        )
        RETURNING id INTO new_id;
    EXCEPTION
        WHEN unique_violation THEN
            SELECT observed.id, observed.external_result
            INTO existing_id, existing_result
            FROM public.finance_observed_production_results observed
            WHERE observed.execution_identity = stored_identity;
            IF existing_id IS NOT NULL AND existing_result = classified THEN
                RETURN existing_id;
            END IF;
            RAISE EXCEPTION 'production result does not match';
    END;
    PERFORM public.finance_audit(
        result_org,
        'production_observed_result.recorded',
        'finance_observed_production_result',
        new_id,
        jsonb_build_object(
            'execution_identity', stored_identity,
            'external_result', classified,
            'outcome_class', outcome_text,
            'success', succeeded,
            'sent', FALSE,
            'live_permitted', FALSE
        )
    );
    RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_reconcile_observed_production_result(
    p_contract_id uuid,
    p_record jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    record_org uuid;
    observed_id uuid;
    dispatch_id uuid;
    stored_identity text;
    stored_instrument text;
    stored_side text;
    stored_quantity text;
    stored_authorization text;
    stored_contract_digest text;
    stored_payload_digest text;
    stored_result text;
    stored_outcome text;
    stored_success boolean;
    dispatch_payload_digest text;
    contract_document jsonb;
    current_authorization text;
    current_contract_digest text;
    recomputed_payload_digest text;
    comparison_text text;
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
        RAISE EXCEPTION 'production observed result is invalid';
    END IF;
    PERFORM public.finance_match_production_authorization(p_contract_id);
    SELECT observed.organization_id, observed.id, observed.dispatch_id, observed.execution_identity,
           observed.instrument, observed.side, observed.quantity, observed.authorization_digest,
           observed.contract_digest, observed.payload_digest, observed.external_result,
           observed.outcome_class, observed.success, dispatches.payload_digest,
           contracts.contract, grants.authorization_digest
    INTO record_org, observed_id, dispatch_id, stored_identity, stored_instrument, stored_side,
         stored_quantity, stored_authorization, stored_contract_digest, stored_payload_digest,
         stored_result, stored_outcome, stored_success, dispatch_payload_digest,
         contract_document, current_authorization
    FROM public.finance_observed_production_results observed
    JOIN public.finance_production_dispatches dispatches ON dispatches.id = observed.dispatch_id
    JOIN public.finance_execution_contracts contracts ON contracts.id = dispatches.contract_id
    JOIN public.finance_production_authorizations grants
      ON grants.id = dispatches.production_authorization_id
    WHERE observed.contract_id = p_contract_id;
    IF record_org IS NULL OR observed_id IS NULL OR dispatch_id IS NULL THEN
        RAISE EXCEPTION 'production observed result not found';
    END IF;
    IF NOT public.can_write_organization(record_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    current_contract_digest := md5(public.finance_canonical_json(contract_document));
    recomputed_payload_digest := md5(public.finance_canonical_json(jsonb_build_object(
        'authorization_digest', stored_authorization,
        'contract_digest', stored_contract_digest,
        'execution_identity', stored_identity,
        'instrument', stored_instrument,
        'quantity', stored_quantity,
        'side', stored_side
    )));
    IF contract_document->>'instrument' IS DISTINCT FROM stored_instrument
        OR contract_document->>'side' IS DISTINCT FROM stored_side
        OR contract_document->>'quantity' IS DISTINCT FROM stored_quantity
        OR current_authorization IS DISTINCT FROM stored_authorization
        OR current_contract_digest IS DISTINCT FROM stored_contract_digest
        OR dispatch_payload_digest IS DISTINCT FROM stored_payload_digest
        OR recomputed_payload_digest IS DISTINCT FROM stored_payload_digest
        OR stored_success IS DISTINCT FROM public.finance_production_result_is_success(stored_result)
        OR stored_outcome IS DISTINCT FROM public.finance_production_outcome_class(stored_result)
        OR (stored_result = 'unknown' AND stored_success) THEN
        RAISE EXCEPTION 'production result does not match';
    END IF;
    IF stored_result = 'filled' THEN
        comparison_text := 'matched';
    ELSIF stored_result = 'rejected' THEN
        comparison_text := 'terminal';
    ELSE
        comparison_text := 'unresolved';
    END IF;
    SELECT reconciliations.id
    INTO existing_id
    FROM public.finance_observed_result_reconciliations reconciliations
    WHERE reconciliations.execution_identity = stored_identity;
    IF existing_id IS NOT NULL THEN
        RETURN existing_id;
    END IF;
    BEGIN
        INSERT INTO public.finance_observed_result_reconciliations (
            organization_id, observed_result_id, dispatch_id, execution_identity,
            comparison, outcome_class, success, sent, live_permitted, created_by
        ) VALUES (
            record_org, observed_id, dispatch_id, stored_identity,
            comparison_text, stored_outcome, stored_success, FALSE, FALSE, auth.uid()
        )
        RETURNING id INTO new_id;
    EXCEPTION
        WHEN unique_violation THEN
            SELECT reconciliations.id
            INTO existing_id
            FROM public.finance_observed_result_reconciliations reconciliations
            WHERE reconciliations.execution_identity = stored_identity;
            IF existing_id IS NOT NULL THEN
                RETURN existing_id;
            END IF;
            RAISE EXCEPTION 'production result does not match';
    END;
    PERFORM public.finance_audit(
        record_org,
        'production_observed_result.reconciled',
        'finance_observed_result_reconciliation',
        new_id,
        jsonb_build_object(
            'execution_identity', stored_identity,
            'external_result', stored_result,
            'comparison', comparison_text,
            'success', stored_success,
            'sent', FALSE,
            'live_permitted', FALSE
        )
    );
    RETURN new_id;
END;
$$;

ALTER TABLE public.finance_observed_production_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_observed_production_results FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_observed_result_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_observed_result_reconciliations FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_observed_production_results_select ON public.finance_observed_production_results
    FOR SELECT TO app_user
    USING (public.is_organization_member(organization_id));

CREATE POLICY finance_observed_result_reconciliations_select ON public.finance_observed_result_reconciliations
    FOR SELECT TO app_user
    USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_record_observed_production_result(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_reconcile_observed_production_result(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_observed_production_result_immutable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_observed_result_reconciliation_immutable() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_record_observed_production_result(uuid, text, jsonb) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_reconcile_observed_production_result(uuid, jsonb) TO app_user;

DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON public.finance_observed_production_results FROM PUBLIC';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.finance_observed_production_results FROM app_user';
    EXECUTE 'GRANT SELECT ON public.finance_observed_production_results TO app_user';
    EXECUTE 'REVOKE ALL ON public.finance_observed_result_reconciliations FROM PUBLIC';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.finance_observed_result_reconciliations FROM app_user';
    EXECUTE 'GRANT SELECT ON public.finance_observed_result_reconciliations TO app_user';
END $$;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON public.finance_observed_production_results FROM %I', r);
            EXECUTE format('REVOKE ALL ON public.finance_observed_result_reconciliations FROM %I', r);
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_record_observed_production_result(uuid, text, jsonb) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_reconcile_observed_production_result(uuid, jsonb) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_observed_production_result_immutable() FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_observed_result_reconciliation_immutable() FROM %I',
                r
            );
        END IF;
    END LOOP;
END $$;
