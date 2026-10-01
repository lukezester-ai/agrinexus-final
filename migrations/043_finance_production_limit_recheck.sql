-- Dispatch-time production limit re-check P7. Does not alter 001-042.
-- A new dispatch rereads the organization limit under one advisory lock.
-- It does not send, and it does not rewrite the safety snapshot.

CREATE TABLE public.finance_production_limit_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
    document jsonb NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.finance_production_limit_document(p_document jsonb) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
    keys text[];
    order_limit numeric;
    exposure_limit numeric;
BEGIN
    IF p_document IS NULL
        OR jsonb_typeof(p_document) <> 'object'
        OR public.finance_candidate_command(p_document) THEN
        RAISE EXCEPTION 'production limit is invalid';
    END IF;
    SELECT COALESCE(array_agg(object_key ORDER BY object_key COLLATE "C"), ARRAY[]::text[])
    INTO keys
    FROM jsonb_object_keys(p_document) AS object_key;
    IF keys <> ARRAY['exposure_limit', 'order_limit']::text[] THEN
        RAISE EXCEPTION 'production limit is invalid';
    END IF;
    IF jsonb_typeof(p_document -> 'order_limit') <> 'number'
        OR jsonb_typeof(p_document -> 'exposure_limit') <> 'number' THEN
        RAISE EXCEPTION 'production limit is invalid';
    END IF;
    order_limit := (p_document ->> 'order_limit')::numeric;
    exposure_limit := (p_document ->> 'exposure_limit')::numeric;
    IF order_limit < 0
        OR order_limit <> trunc(order_limit)
        OR exposure_limit < 0 THEN
        RAISE EXCEPTION 'production limit is invalid';
    END IF;
    RETURN jsonb_build_object(
        'exposure_limit', p_document -> 'exposure_limit',
        'order_limit', p_document -> 'order_limit'
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_lock_production_limit(p_organization_id uuid) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF NOT public.can_write_organization(p_organization_id) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtext('finance_production_limit'),
        pg_catalog.hashtext(p_organization_id::text)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_set_production_limit(
    p_organization_id uuid,
    p_document jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    canonical jsonb;
    new_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF NOT public.can_write_organization(p_organization_id) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    canonical := public.finance_production_limit_document(p_document);
    PERFORM public.finance_lock_production_limit(p_organization_id);
    INSERT INTO public.finance_production_limit_documents (
        organization_id, document, created_by
    ) VALUES (
        p_organization_id, canonical, auth.uid()
    )
    ON CONFLICT (organization_id) DO UPDATE
    SET document = EXCLUDED.document,
        updated_at = now()
    RETURNING id INTO new_id;
    PERFORM public.finance_audit(
        p_organization_id,
        'production_limit.set',
        'finance_production_limit_document',
        new_id,
        jsonb_build_object('document', canonical)
    );
    RETURN new_id;
END;
$$;

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
    order_quantity numeric;
    exposure_value numeric;
    contract_document jsonb;
    safety_decision text;
    safety_admitted boolean;
    switch_id uuid;
    contract_digest text;
    payload jsonb;
    payload_digest text;
    existing_id uuid;
    limit_document jsonb;
    canonical jsonb;
    current_order_limit numeric;
    current_exposure_limit numeric;
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
           controls.order_quantity, controls.exposure_value,
           contracts.contract->>'instrument', contracts.contract->>'side', contracts.contract->>'quantity',
           grants.authorization_digest, contracts.contract
    INTO dispatch_org, safety_id, production_id, stored_identity, safety_decision, safety_admitted,
         order_quantity, exposure_value,
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
        OR stored_authorization IS NULL
        OR order_quantity IS NULL
        OR exposure_value IS NULL THEN
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
    PERFORM public.finance_lock_production_limit(dispatch_org);
    SELECT dispatches.id
    INTO existing_id
    FROM public.finance_production_dispatches dispatches
    WHERE dispatches.execution_identity = stored_identity;
    IF existing_id IS NOT NULL THEN
        RETURN existing_id;
    END IF;
    SELECT limits.document
    INTO limit_document
    FROM public.finance_production_limit_documents limits
    WHERE limits.organization_id = dispatch_org;
    IF NOT FOUND THEN
        current_order_limit := 1;
        current_exposure_limit := 10000;
    ELSE
        BEGIN
            canonical := public.finance_production_limit_document(limit_document);
        EXCEPTION
            WHEN raise_exception THEN
                RAISE EXCEPTION 'production limit re-check denied';
        END;
        current_order_limit := (canonical ->> 'order_limit')::numeric;
        current_exposure_limit := (canonical ->> 'exposure_limit')::numeric;
    END IF;
    IF order_quantity > current_order_limit OR exposure_value > current_exposure_limit THEN
        RAISE EXCEPTION 'production limit re-check denied';
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

ALTER TABLE public.finance_production_limit_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_production_limit_documents FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_production_limit_documents_select ON public.finance_production_limit_documents
    FOR SELECT TO app_user
    USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_production_limit_document(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_lock_production_limit(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_set_production_limit(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_lock_production_limit(uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_set_production_limit(uuid, jsonb) TO app_user;

DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON public.finance_production_limit_documents FROM PUBLIC';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.finance_production_limit_documents FROM app_user';
    EXECUTE 'GRANT SELECT ON public.finance_production_limit_documents TO app_user';
END $$;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON public.finance_production_limit_documents FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_production_limit_document(jsonb) FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_lock_production_limit(uuid) FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_set_production_limit(uuid, jsonb) FROM %I', r);
        END IF;
    END LOOP;
END $$;
