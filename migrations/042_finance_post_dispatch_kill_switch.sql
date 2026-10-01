-- Post-dispatch kill switch P6. Does not alter 001-041.
-- An existing dispatch cannot gain an external result or reconciliation after the switch.

CREATE OR REPLACE FUNCTION public.finance_assert_production_kill_switch_clear(
    p_organization_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.finance_production_kill_switches switches
        WHERE switches.organization_id = p_organization_id
          AND switches.engaged
    ) THEN
        RAISE EXCEPTION 'production kill switch is engaged';
    END IF;
END;
$$;

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
    PERFORM public.finance_assert_production_kill_switch_clear(result_org);
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
    PERFORM public.finance_assert_production_kill_switch_clear(record_org);
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
    PERFORM public.finance_assert_production_kill_switch_clear(result_org);
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
    PERFORM public.finance_assert_production_kill_switch_clear(record_org);
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

REVOKE ALL ON FUNCTION public.finance_assert_production_kill_switch_clear(uuid) FROM PUBLIC;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'app_user'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_assert_production_kill_switch_clear(uuid) FROM %I',
                r
            );
        END IF;
    END LOOP;
END $$;
