-- Production authorization model P1. Does not alter 001-005 and does not recreate 006-037.
-- One execution identity gets one canonical production authorization.
-- It does not permit a send.

CREATE TABLE public.finance_production_authorizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    contract_id uuid NOT NULL UNIQUE REFERENCES public.finance_execution_contracts(id) ON DELETE CASCADE,
    order_authorization_id uuid NOT NULL UNIQUE REFERENCES public.finance_order_authorizations(id) ON DELETE CASCADE,
    intent_id uuid NOT NULL REFERENCES public.finance_order_intents(id) ON DELETE CASCADE,
    execution_identity text NOT NULL UNIQUE,
    intent_digest text NOT NULL,
    evaluation_digest text NOT NULL,
    policy_digest text NOT NULL,
    authorization_digest text NOT NULL,
    production_authorization_digest text NOT NULL,
    authorized_by uuid NOT NULL,
    authorized_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    lifecycle text NOT NULL,
    reason text,
    CHECK (lifecycle IN ('recorded', 'cancelled')),
    CHECK (
        (lifecycle = 'recorded' AND reason IS NULL)
        OR (lifecycle = 'cancelled' AND reason = 'cancelled')
    ),
    CHECK (expires_at > authorized_at)
);

CREATE INDEX idx_finance_production_authorizations_org
    ON public.finance_production_authorizations (organization_id);

CREATE OR REPLACE FUNCTION public.finance_production_authorization_immutable() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
        OR NEW.contract_id IS DISTINCT FROM OLD.contract_id
        OR NEW.order_authorization_id IS DISTINCT FROM OLD.order_authorization_id
        OR NEW.intent_id IS DISTINCT FROM OLD.intent_id
        OR NEW.execution_identity IS DISTINCT FROM OLD.execution_identity
        OR NEW.intent_digest IS DISTINCT FROM OLD.intent_digest
        OR NEW.evaluation_digest IS DISTINCT FROM OLD.evaluation_digest
        OR NEW.policy_digest IS DISTINCT FROM OLD.policy_digest
        OR NEW.authorization_digest IS DISTINCT FROM OLD.authorization_digest
        OR NEW.production_authorization_digest IS DISTINCT FROM OLD.production_authorization_digest
        OR NEW.authorized_by IS DISTINCT FROM OLD.authorized_by
        OR NEW.authorized_at IS DISTINCT FROM OLD.authorized_at
        OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
        RAISE EXCEPTION 'production authorization is immutable';
    END IF;
    IF NEW.lifecycle IS NOT DISTINCT FROM OLD.lifecycle
        AND NEW.reason IS NOT DISTINCT FROM OLD.reason THEN
        RETURN NEW;
    END IF;
    IF OLD.lifecycle = 'recorded'
        AND OLD.reason IS NULL
        AND NEW.lifecycle = 'cancelled'
        AND NEW.reason = 'cancelled' THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'production authorization is immutable';
END;
$$;

CREATE TRIGGER finance_production_authorization_immutable
    BEFORE UPDATE ON public.finance_production_authorizations
    FOR EACH ROW
    EXECUTE PROCEDURE public.finance_production_authorization_immutable();

CREATE OR REPLACE FUNCTION public.finance_record_production_authorization(
    p_contract_id uuid,
    p_authorization jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    record_org uuid;
    linked_authorization uuid;
    linked_intent uuid;
    linked_book uuid;
    stored_identity text;
    stored_intent_digest text;
    stored_evaluation text;
    stored_authorization_digest text;
    contract_document jsonb;
    current_evaluation text;
    accepted boolean;
    evaluation_policy text;
    current_policy text;
    canonical jsonb;
    digest text;
    recorded_at timestamptz;
    existing_id uuid;
    existing_intent text;
    existing_evaluation text;
    existing_policy text;
    existing_authorization text;
    existing_identity text;
    existing_digest text;
    existing_lifecycle text;
    new_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF p_authorization IS NULL
        OR jsonb_typeof(p_authorization) <> 'object'
        OR p_authorization <> '{}'::jsonb
        OR public.finance_candidate_command(p_authorization) THEN
        RAISE EXCEPTION 'production authorization is invalid';
    END IF;
    SELECT contracts.organization_id, contracts.authorization_id, contracts.intent_id,
           intents.book_id, contracts.execution_identity, contracts.contract,
           grants.intent_digest, grants.evaluation_digest, grants.authorization_digest
    INTO record_org, linked_authorization, linked_intent, linked_book, stored_identity,
         contract_document, stored_intent_digest, stored_evaluation, stored_authorization_digest
    FROM public.finance_execution_contracts contracts
    JOIN public.finance_order_authorizations grants ON grants.id = contracts.authorization_id
    JOIN public.finance_order_intents intents ON intents.id = contracts.intent_id
    WHERE contracts.id = p_contract_id;
    IF record_org IS NULL
        OR linked_authorization IS NULL
        OR linked_intent IS NULL
        OR linked_book IS NULL
        OR stored_identity IS NULL
        OR stored_intent_digest IS NULL
        OR stored_evaluation IS NULL
        OR stored_authorization_digest IS NULL THEN
        RAISE EXCEPTION 'execution contract not found';
    END IF;
    IF NOT public.can_write_organization(record_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    IF contract_document->>'intent_digest' IS DISTINCT FROM stored_intent_digest
        OR contract_document->>'evaluation_digest' IS DISTINCT FROM stored_evaluation
        OR contract_document->>'authorization_digest' IS DISTINCT FROM stored_authorization_digest THEN
        RAISE EXCEPTION 'production authorization does not match';
    END IF;
    PERFORM public.finance_recheck_order_intent(linked_intent);
    SELECT evaluations.evaluation_digest, evaluations.accepted,
           evaluations.policy_digest, policies.policy_digest
    INTO current_evaluation, accepted, evaluation_policy, current_policy
    FROM public.finance_risk_evaluations evaluations
    JOIN public.finance_risk_policies policies ON policies.id = evaluations.policy_id
    WHERE evaluations.book_id = linked_book
      AND evaluations.organization_id = record_org
    ORDER BY evaluations.created_at DESC, evaluations.ctid DESC
    LIMIT 1;
    IF current_evaluation IS DISTINCT FROM stored_evaluation
        OR accepted IS NOT TRUE
        OR evaluation_policy IS DISTINCT FROM current_policy
        OR current_policy IS NULL THEN
        RAISE EXCEPTION 'production authorization does not match';
    END IF;
    canonical := jsonb_build_object(
        'authorization_digest', stored_authorization_digest,
        'evaluation_digest', stored_evaluation,
        'execution_identity', stored_identity,
        'expires_in', 'PT15M',
        'intent_digest', stored_intent_digest,
        'policy_digest', current_policy
    );
    digest := md5(public.finance_canonical_json(canonical));
    SELECT grants.id, grants.intent_digest, grants.evaluation_digest, grants.policy_digest,
           grants.authorization_digest, grants.execution_identity,
           grants.production_authorization_digest, grants.lifecycle
    INTO existing_id, existing_intent, existing_evaluation, existing_policy,
         existing_authorization, existing_identity, existing_digest, existing_lifecycle
    FROM public.finance_production_authorizations grants
    WHERE grants.execution_identity = stored_identity;
    IF existing_id IS NOT NULL THEN
        IF existing_lifecycle = 'cancelled' THEN
            RAISE EXCEPTION 'production authorization cancelled';
        END IF;
        IF existing_lifecycle IS DISTINCT FROM 'recorded'
            OR existing_intent IS DISTINCT FROM stored_intent_digest
            OR existing_evaluation IS DISTINCT FROM stored_evaluation
            OR existing_policy IS DISTINCT FROM current_policy
            OR existing_authorization IS DISTINCT FROM stored_authorization_digest
            OR existing_identity IS DISTINCT FROM stored_identity
            OR existing_digest IS DISTINCT FROM digest THEN
            RAISE EXCEPTION 'production authorization does not match';
        END IF;
        RETURN existing_id;
    END IF;
    recorded_at := now();
    BEGIN
        INSERT INTO public.finance_production_authorizations (
            organization_id, contract_id, order_authorization_id, intent_id, execution_identity,
            intent_digest, evaluation_digest, policy_digest, authorization_digest,
            production_authorization_digest, authorized_by, authorized_at, expires_at,
            lifecycle, reason
        ) VALUES (
            record_org, p_contract_id, linked_authorization, linked_intent, stored_identity,
            stored_intent_digest, stored_evaluation, current_policy, stored_authorization_digest,
            digest, auth.uid(), recorded_at, recorded_at + interval '15 minutes',
            'recorded', NULL
        )
        RETURNING id INTO new_id;
    EXCEPTION
        WHEN unique_violation THEN
            SELECT grants.id, grants.lifecycle, grants.production_authorization_digest
            INTO existing_id, existing_lifecycle, existing_digest
            FROM public.finance_production_authorizations grants
            WHERE grants.execution_identity = stored_identity;
            IF existing_lifecycle = 'cancelled' THEN
                RAISE EXCEPTION 'production authorization cancelled';
            END IF;
            IF existing_id IS NOT NULL
                AND existing_lifecycle = 'recorded'
                AND existing_digest = digest THEN
                RETURN existing_id;
            END IF;
            RAISE EXCEPTION 'production authorization does not match';
    END;
    PERFORM public.finance_audit(
        record_org,
        'production_authorization.recorded',
        'finance_production_authorization',
        new_id,
        jsonb_build_object(
            'execution_identity', stored_identity,
            'intent_digest', stored_intent_digest,
            'evaluation_digest', stored_evaluation,
            'policy_digest', current_policy,
            'authorization_digest', stored_authorization_digest,
            'production_authorization_digest', digest,
            'lifecycle', 'recorded'
        )
    );
    RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_match_production_authorization(
    p_contract_id uuid
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    record_org uuid;
    production_id uuid;
    linked_authorization uuid;
    linked_intent uuid;
    linked_book uuid;
    stored_identity text;
    stored_intent_digest text;
    stored_evaluation text;
    stored_policy text;
    stored_authorization_digest text;
    stored_digest text;
    stored_lifecycle text;
    stored_reason text;
    stored_expires timestamptz;
    contract_identity text;
    contract_document jsonb;
    grant_intent text;
    grant_evaluation text;
    grant_authorization text;
    current_evaluation text;
    accepted boolean;
    evaluation_policy text;
    current_policy text;
    canonical jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    SELECT grants.organization_id, grants.id, grants.order_authorization_id, grants.intent_id,
           intents.book_id, grants.execution_identity, grants.intent_digest, grants.evaluation_digest,
           grants.policy_digest, grants.authorization_digest, grants.production_authorization_digest,
           grants.lifecycle, grants.reason, grants.expires_at, contracts.execution_identity, contracts.contract
    INTO record_org, production_id, linked_authorization, linked_intent, linked_book, stored_identity,
         stored_intent_digest, stored_evaluation, stored_policy, stored_authorization_digest, stored_digest,
         stored_lifecycle, stored_reason, stored_expires, contract_identity, contract_document
    FROM public.finance_production_authorizations grants
    JOIN public.finance_execution_contracts contracts ON contracts.id = grants.contract_id
    JOIN public.finance_order_intents intents ON intents.id = grants.intent_id
    WHERE grants.contract_id = p_contract_id;
    IF record_org IS NULL OR production_id IS NULL OR stored_identity IS NULL THEN
        RAISE EXCEPTION 'production authorization not found';
    END IF;
    IF NOT public.can_write_organization(record_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    IF stored_lifecycle = 'cancelled' OR stored_reason = 'cancelled' THEN
        RAISE EXCEPTION 'production authorization cancelled';
    END IF;
    IF stored_lifecycle IS DISTINCT FROM 'recorded' OR stored_reason IS NOT NULL THEN
        RAISE EXCEPTION 'production authorization does not match';
    END IF;
    IF stored_expires <= clock_timestamp() THEN
        RAISE EXCEPTION 'production authorization expired';
    END IF;
    SELECT order_grants.intent_digest, order_grants.evaluation_digest, order_grants.authorization_digest
    INTO grant_intent, grant_evaluation, grant_authorization
    FROM public.finance_order_authorizations order_grants
    WHERE order_grants.id = linked_authorization;
    SELECT evaluations.evaluation_digest, evaluations.accepted,
           evaluations.policy_digest, policies.policy_digest
    INTO current_evaluation, accepted, evaluation_policy, current_policy
    FROM public.finance_risk_evaluations evaluations
    JOIN public.finance_risk_policies policies ON policies.id = evaluations.policy_id
    WHERE evaluations.book_id = linked_book
      AND evaluations.organization_id = record_org
    ORDER BY evaluations.created_at DESC, evaluations.ctid DESC
    LIMIT 1;
    canonical := jsonb_build_object(
        'authorization_digest', stored_authorization_digest,
        'evaluation_digest', stored_evaluation,
        'execution_identity', stored_identity,
        'expires_in', 'PT15M',
        'intent_digest', stored_intent_digest,
        'policy_digest', stored_policy
    );
    IF contract_identity IS DISTINCT FROM stored_identity
        OR contract_document->>'intent_digest' IS DISTINCT FROM stored_intent_digest
        OR contract_document->>'evaluation_digest' IS DISTINCT FROM stored_evaluation
        OR contract_document->>'authorization_digest' IS DISTINCT FROM stored_authorization_digest
        OR grant_intent IS DISTINCT FROM stored_intent_digest
        OR grant_evaluation IS DISTINCT FROM stored_evaluation
        OR grant_authorization IS DISTINCT FROM stored_authorization_digest
        OR current_evaluation IS DISTINCT FROM stored_evaluation
        OR accepted IS NOT TRUE
        OR evaluation_policy IS DISTINCT FROM current_policy
        OR current_policy IS DISTINCT FROM stored_policy
        OR stored_digest IS DISTINCT FROM md5(public.finance_canonical_json(canonical)) THEN
        RAISE EXCEPTION 'production authorization does not match';
    END IF;
    PERFORM public.finance_recheck_order_intent(linked_intent);
    PERFORM public.finance_audit(
        record_org,
        'production_authorization.matched',
        'finance_production_authorization',
        production_id,
        jsonb_build_object(
            'execution_identity', stored_identity,
            'production_authorization_digest', stored_digest,
            'lifecycle', stored_lifecycle
        )
    );
    RETURN production_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_cancel_production_authorization(
    p_contract_id uuid,
    p_authorization jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    record_org uuid;
    production_id uuid;
    stored_lifecycle text;
    stored_reason text;
    stored_identity text;
    stored_digest text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF p_authorization IS NULL
        OR jsonb_typeof(p_authorization) <> 'object'
        OR p_authorization <> '{}'::jsonb
        OR public.finance_candidate_command(p_authorization) THEN
        RAISE EXCEPTION 'production authorization is invalid';
    END IF;
    SELECT grants.organization_id, grants.id, grants.lifecycle, grants.reason,
           grants.execution_identity, grants.production_authorization_digest
    INTO record_org, production_id, stored_lifecycle, stored_reason, stored_identity, stored_digest
    FROM public.finance_production_authorizations grants
    WHERE grants.contract_id = p_contract_id;
    IF record_org IS NULL OR production_id IS NULL THEN
        RAISE EXCEPTION 'production authorization not found';
    END IF;
    IF NOT public.can_write_organization(record_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    IF stored_lifecycle = 'cancelled' AND stored_reason = 'cancelled' THEN
        RETURN production_id;
    END IF;
    IF stored_lifecycle IS DISTINCT FROM 'recorded' OR stored_reason IS NOT NULL THEN
        RAISE EXCEPTION 'production authorization does not match';
    END IF;
    UPDATE public.finance_production_authorizations
    SET lifecycle = 'cancelled',
        reason = 'cancelled'
    WHERE id = production_id
      AND lifecycle = 'recorded'
      AND reason IS NULL;
    PERFORM public.finance_audit(
        record_org,
        'production_authorization.cancelled',
        'finance_production_authorization',
        production_id,
        jsonb_build_object(
            'execution_identity', stored_identity,
            'production_authorization_digest', stored_digest,
            'lifecycle', 'cancelled',
            'reason', 'cancelled'
        )
    );
    RETURN production_id;
END;
$$;

ALTER TABLE public.finance_production_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_production_authorizations FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_production_authorizations_select ON public.finance_production_authorizations
    FOR SELECT TO app_user
    USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_record_production_authorization(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_match_production_authorization(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_cancel_production_authorization(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_production_authorization_immutable() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_record_production_authorization(uuid, jsonb) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_match_production_authorization(uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_cancel_production_authorization(uuid, jsonb) TO app_user;

DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON public.finance_production_authorizations FROM PUBLIC';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.finance_production_authorizations FROM app_user';
    EXECUTE 'GRANT SELECT ON public.finance_production_authorizations TO app_user';
END $$;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON public.finance_production_authorizations FROM %I', r);
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_record_production_authorization(uuid, jsonb) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_match_production_authorization(uuid) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_cancel_production_authorization(uuid, jsonb) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_production_authorization_immutable() FROM %I',
                r
            );
        END IF;
    END LOOP;
END $$;
