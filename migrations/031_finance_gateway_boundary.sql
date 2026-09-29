-- Broker / live boundary gate 4. Does not alter 001-005 and does not recreate 006-030.
-- The gateway boundary admits one matching human authorization. It does not send an order.

CREATE OR REPLACE FUNCTION public.finance_gateway_boundary(
    p_authorization_id uuid,
    p_gateway jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    boundary_org uuid;
    linked_intent uuid;
    stored_intent_digest text;
    stored_evaluation text;
    stored_authorization_digest text;
    canonical jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF p_gateway IS NULL
        OR jsonb_typeof(p_gateway) <> 'object'
        OR p_gateway <> '{}'::jsonb
        OR public.finance_candidate_command(p_gateway) THEN
        RAISE EXCEPTION 'gateway boundary is invalid';
    END IF;
    PERFORM public.finance_match_order_authorization(p_authorization_id);
    SELECT grants.organization_id, grants.intent_id, grants.intent_digest,
           grants.evaluation_digest, grants.authorization_digest
    INTO boundary_org, linked_intent, stored_intent_digest,
         stored_evaluation, stored_authorization_digest
    FROM public.finance_order_authorizations grants
    WHERE grants.id = p_authorization_id;
    IF boundary_org IS NULL
        OR linked_intent IS NULL
        OR stored_intent_digest IS NULL
        OR stored_evaluation IS NULL
        OR stored_authorization_digest IS NULL THEN
        RAISE EXCEPTION 'order authorization not found';
    END IF;
    canonical := jsonb_build_object(
        'intent_id', linked_intent::text,
        'intent_digest', stored_intent_digest,
        'evaluation_digest', stored_evaluation
    );
    IF stored_authorization_digest IS DISTINCT FROM md5(public.finance_canonical_json(canonical)) THEN
        RAISE EXCEPTION 'order authorization does not match';
    END IF;
    PERFORM public.finance_audit(
        boundary_org,
        'gateway_boundary.admitted',
        'finance_order_authorization',
        p_authorization_id,
        jsonb_build_object(
            'authorization_id', p_authorization_id,
            'authorization_digest', stored_authorization_digest,
            'intent_id', linked_intent,
            'intent_digest', stored_intent_digest,
            'evaluation_digest', stored_evaluation
        )
    );
    RETURN p_authorization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finance_gateway_boundary(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_gateway_boundary(uuid, jsonb) TO app_user;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_gateway_boundary(uuid, jsonb) FROM %I',
                r
            );
        END IF;
    END LOOP;
END $$;
