-- Broker / live boundary gate 3. Does not alter 001-005 and does not recreate 006-029.
-- A human authorization binds one rechecked order intent. It does not send an order.

CREATE TABLE public.finance_order_authorizations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    intent_id uuid NOT NULL REFERENCES public.finance_order_intents(id) ON DELETE CASCADE,
    intent_digest text NOT NULL,
    evaluation_digest text NOT NULL,
    authorization_digest text NOT NULL,
    authorized_by uuid NOT NULL,
    authorized_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_finance_order_authorizations_org
    ON public.finance_order_authorizations (organization_id);

CREATE OR REPLACE FUNCTION public.finance_authorize_order_intent(
    p_intent_id uuid,
    p_authorization jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    auth_org uuid;
    stored_intent_digest text;
    stored_evaluation text;
    canonical jsonb;
    digest text;
    new_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF p_authorization IS NULL
        OR jsonb_typeof(p_authorization) <> 'object'
        OR p_authorization <> '{}'::jsonb
        OR public.finance_candidate_command(p_authorization) THEN
        RAISE EXCEPTION 'order authorization is invalid';
    END IF;
    PERFORM public.finance_recheck_order_intent(p_intent_id);
    SELECT intents.organization_id, intents.intent_digest, intents.intent->>'evaluation_digest'
    INTO auth_org, stored_intent_digest, stored_evaluation
    FROM public.finance_order_intents intents
    WHERE intents.id = p_intent_id;
    IF auth_org IS NULL OR stored_intent_digest IS NULL OR stored_evaluation IS NULL THEN
        RAISE EXCEPTION 'order intent not found';
    END IF;
    canonical := jsonb_build_object(
        'intent_id', p_intent_id::text,
        'intent_digest', stored_intent_digest,
        'evaluation_digest', stored_evaluation
    );
    digest := md5(public.finance_canonical_json(canonical));
    INSERT INTO public.finance_order_authorizations (
        organization_id, intent_id, intent_digest, evaluation_digest,
        authorization_digest, authorized_by
    ) VALUES (
        auth_org, p_intent_id, stored_intent_digest, stored_evaluation,
        digest, auth.uid()
    )
    RETURNING id INTO new_id;
    PERFORM public.finance_audit(
        auth_org,
        'order_intent.authorized',
        'finance_order_authorization',
        new_id,
        jsonb_build_object(
            'intent_id', p_intent_id,
            'intent_digest', stored_intent_digest,
            'evaluation_digest', stored_evaluation,
            'authorization_digest', digest
        )
    );
    RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_match_order_authorization(p_authorization_id uuid) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    auth_org uuid;
    linked_intent uuid;
    stored_intent_digest text;
    stored_evaluation text;
    current_intent_digest text;
    current_evaluation text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    SELECT grants.organization_id, grants.intent_id, grants.intent_digest, grants.evaluation_digest
    INTO auth_org, linked_intent, stored_intent_digest, stored_evaluation
    FROM public.finance_order_authorizations grants
    WHERE grants.id = p_authorization_id;
    IF auth_org IS NULL OR linked_intent IS NULL THEN
        RAISE EXCEPTION 'order authorization not found';
    END IF;
    IF NOT public.can_write_organization(auth_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    SELECT intents.intent_digest, intents.intent->>'evaluation_digest'
    INTO current_intent_digest, current_evaluation
    FROM public.finance_order_intents intents
    WHERE intents.id = linked_intent;
    IF stored_intent_digest IS DISTINCT FROM current_intent_digest
        OR stored_evaluation IS DISTINCT FROM current_evaluation THEN
        RAISE EXCEPTION 'order authorization does not match';
    END IF;
    PERFORM public.finance_recheck_order_intent(linked_intent);
    RETURN p_authorization_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_order_authorization_immutable() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.intent_digest IS DISTINCT FROM OLD.intent_digest
        OR NEW.evaluation_digest IS DISTINCT FROM OLD.evaluation_digest
        OR NEW.authorization_digest IS DISTINCT FROM OLD.authorization_digest
        OR NEW.intent_id IS DISTINCT FROM OLD.intent_id
        OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
        OR NEW.authorized_by IS DISTINCT FROM OLD.authorized_by THEN
        RAISE EXCEPTION 'order authorization is immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER finance_order_authorization_immutable
    BEFORE UPDATE ON public.finance_order_authorizations
    FOR EACH ROW
    EXECUTE PROCEDURE public.finance_order_authorization_immutable();

ALTER TABLE public.finance_order_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_order_authorizations FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_order_authorizations_select ON public.finance_order_authorizations
    FOR SELECT TO app_user
    USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_authorize_order_intent(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_match_order_authorization(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_order_authorization_immutable() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_authorize_order_intent(uuid, jsonb) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_match_order_authorization(uuid) TO app_user;

DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON public.finance_order_authorizations FROM PUBLIC';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.finance_order_authorizations FROM app_user';
    EXECUTE 'GRANT SELECT ON public.finance_order_authorizations TO app_user';
END $$;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON public.finance_order_authorizations FROM %I', r);
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_authorize_order_intent(uuid, jsonb) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_match_order_authorization(uuid) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_order_authorization_immutable() FROM %I',
                r
            );
        END IF;
    END LOOP;
END $$;
