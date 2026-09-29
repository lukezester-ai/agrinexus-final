-- Live execution contract gate 5. Does not alter 001-005 and does not recreate 006-031.
-- One admitted authorization becomes one immutable execution request.
-- It does not send an order.

CREATE TABLE public.finance_execution_contracts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    authorization_id uuid NOT NULL UNIQUE REFERENCES public.finance_order_authorizations(id) ON DELETE CASCADE,
    intent_id uuid NOT NULL REFERENCES public.finance_order_intents(id) ON DELETE CASCADE,
    execution_identity text NOT NULL UNIQUE,
    contract jsonb NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_finance_execution_contracts_org
    ON public.finance_execution_contracts (organization_id);

CREATE OR REPLACE FUNCTION public.finance_create_execution_contract(
    p_authorization_id uuid,
    p_contract jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    contract_org uuid;
    linked_intent uuid;
    stored_intent_digest text;
    stored_evaluation text;
    stored_authorization_digest text;
    instrument_text text;
    side_text text;
    quantity_text text;
    canonical jsonb;
    identity text;
    existing_id uuid;
    existing_identity text;
    new_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF p_contract IS NULL
        OR jsonb_typeof(p_contract) <> 'object'
        OR p_contract <> '{}'::jsonb
        OR public.finance_candidate_command(p_contract) THEN
        RAISE EXCEPTION 'execution contract is invalid';
    END IF;
    PERFORM public.finance_gateway_boundary(p_authorization_id, '{}'::jsonb);
    SELECT grants.organization_id, grants.intent_id, grants.intent_digest,
           grants.evaluation_digest, grants.authorization_digest,
           intents.intent->>'instrument', intents.intent->>'side', intents.intent->>'quantity'
    INTO contract_org, linked_intent, stored_intent_digest, stored_evaluation,
         stored_authorization_digest, instrument_text, side_text, quantity_text
    FROM public.finance_order_authorizations grants
    JOIN public.finance_order_intents intents ON intents.id = grants.intent_id
    WHERE grants.id = p_authorization_id;
    IF contract_org IS NULL
        OR linked_intent IS NULL
        OR stored_intent_digest IS NULL
        OR stored_evaluation IS NULL
        OR stored_authorization_digest IS NULL
        OR instrument_text IS NULL
        OR side_text IS NULL
        OR quantity_text IS NULL THEN
        RAISE EXCEPTION 'order authorization not found';
    END IF;
    canonical := jsonb_build_object(
        'authorization_id', p_authorization_id::text,
        'authorization_digest', stored_authorization_digest,
        'intent_id', linked_intent::text,
        'intent_digest', stored_intent_digest,
        'evaluation_digest', stored_evaluation,
        'instrument', instrument_text,
        'side', side_text,
        'quantity', quantity_text
    );
    identity := md5(public.finance_canonical_json(canonical));
    SELECT contracts.id, contracts.execution_identity
    INTO existing_id, existing_identity
    FROM public.finance_execution_contracts contracts
    WHERE contracts.authorization_id = p_authorization_id;
    IF existing_id IS NOT NULL THEN
        IF existing_identity IS DISTINCT FROM identity THEN
            RAISE EXCEPTION 'execution contract does not match';
        END IF;
        RETURN existing_id;
    END IF;
    SELECT contracts.id
    INTO existing_id
    FROM public.finance_execution_contracts contracts
    WHERE contracts.execution_identity = identity;
    IF existing_id IS NOT NULL THEN
        RAISE EXCEPTION 'execution contract does not match';
    END IF;
    BEGIN
        INSERT INTO public.finance_execution_contracts (
            organization_id, authorization_id, intent_id, execution_identity, contract, created_by
        ) VALUES (
            contract_org, p_authorization_id, linked_intent, identity, canonical, auth.uid()
        )
        RETURNING id INTO new_id;
    EXCEPTION
        WHEN unique_violation THEN
            SELECT contracts.id, contracts.execution_identity
            INTO existing_id, existing_identity
            FROM public.finance_execution_contracts contracts
            WHERE contracts.authorization_id = p_authorization_id;
            IF existing_id IS NOT NULL AND existing_identity = identity THEN
                RETURN existing_id;
            END IF;
            RAISE EXCEPTION 'execution contract does not match';
    END;
    PERFORM public.finance_audit(
        contract_org,
        'execution_contract.created',
        'finance_execution_contract',
        new_id,
        jsonb_build_object(
            'execution_identity', identity,
            'authorization_id', p_authorization_id,
            'intent_digest', stored_intent_digest,
            'evaluation_digest', stored_evaluation,
            'instrument', instrument_text,
            'side', side_text,
            'quantity', quantity_text
        )
    );
    RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_execution_contract_immutable() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
        OR NEW.authorization_id IS DISTINCT FROM OLD.authorization_id
        OR NEW.intent_id IS DISTINCT FROM OLD.intent_id
        OR NEW.execution_identity IS DISTINCT FROM OLD.execution_identity
        OR NEW.contract IS DISTINCT FROM OLD.contract
        OR NEW.created_by IS DISTINCT FROM OLD.created_by
        OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'execution contract is immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER finance_execution_contract_immutable
    BEFORE UPDATE ON public.finance_execution_contracts
    FOR EACH ROW
    EXECUTE PROCEDURE public.finance_execution_contract_immutable();

ALTER TABLE public.finance_execution_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_execution_contracts FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_execution_contracts_select ON public.finance_execution_contracts
    FOR SELECT TO app_user
    USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_create_execution_contract(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_execution_contract_immutable() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_create_execution_contract(uuid, jsonb) TO app_user;

DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON public.finance_execution_contracts FROM PUBLIC';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.finance_execution_contracts FROM app_user';
    EXECUTE 'GRANT SELECT ON public.finance_execution_contracts TO app_user';
END $$;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON public.finance_execution_contracts FROM %I', r);
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_create_execution_contract(uuid, jsonb) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_execution_contract_immutable() FROM %I',
                r
            );
        END IF;
    END LOOP;
END $$;
