-- Production safety controls P2. Does not alter 001-005 and does not recreate 006-038.
-- A matched production authorization stays held. It does not send.

CREATE TABLE public.finance_production_kill_switches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
    engaged boolean NOT NULL,
    engaged_by uuid NOT NULL,
    engaged_at timestamptz NOT NULL,
    CHECK (engaged)
);

CREATE OR REPLACE FUNCTION public.finance_production_kill_switch_immutable() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
        OR NEW.engaged IS DISTINCT FROM OLD.engaged
        OR NEW.engaged_by IS DISTINCT FROM OLD.engaged_by
        OR NEW.engaged_at IS DISTINCT FROM OLD.engaged_at THEN
        RAISE EXCEPTION 'production kill switch is immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER finance_production_kill_switch_immutable
    BEFORE UPDATE ON public.finance_production_kill_switches
    FOR EACH ROW
    EXECUTE PROCEDURE public.finance_production_kill_switch_immutable();

CREATE TABLE public.finance_production_safety_controls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    contract_id uuid NOT NULL UNIQUE REFERENCES public.finance_execution_contracts(id) ON DELETE CASCADE,
    production_authorization_id uuid NOT NULL UNIQUE REFERENCES public.finance_production_authorizations(id) ON DELETE CASCADE,
    execution_identity text NOT NULL UNIQUE,
    order_quantity numeric NOT NULL,
    exposure_value numeric NOT NULL,
    order_limit numeric NOT NULL,
    exposure_limit numeric NOT NULL,
    allowed_targets jsonb NOT NULL,
    material_withheld boolean NOT NULL,
    timeout_is_success boolean NOT NULL,
    max_retries integer NOT NULL,
    switch_clear boolean NOT NULL,
    decision text NOT NULL,
    admitted boolean NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (order_limit = 1),
    CHECK (exposure_limit = 10000),
    CHECK (order_quantity <= order_limit),
    CHECK (exposure_value <= exposure_limit),
    CHECK (allowed_targets = '[]'::jsonb),
    CHECK (material_withheld),
    CHECK (NOT timeout_is_success),
    CHECK (max_retries = 0),
    CHECK (switch_clear),
    CHECK (decision = 'held'),
    CHECK (NOT admitted)
);

CREATE INDEX idx_finance_production_safety_controls_org
    ON public.finance_production_safety_controls (organization_id);

CREATE OR REPLACE FUNCTION public.finance_production_safety_immutable() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
        OR NEW.contract_id IS DISTINCT FROM OLD.contract_id
        OR NEW.production_authorization_id IS DISTINCT FROM OLD.production_authorization_id
        OR NEW.execution_identity IS DISTINCT FROM OLD.execution_identity
        OR NEW.order_quantity IS DISTINCT FROM OLD.order_quantity
        OR NEW.exposure_value IS DISTINCT FROM OLD.exposure_value
        OR NEW.order_limit IS DISTINCT FROM OLD.order_limit
        OR NEW.exposure_limit IS DISTINCT FROM OLD.exposure_limit
        OR NEW.allowed_targets IS DISTINCT FROM OLD.allowed_targets
        OR NEW.material_withheld IS DISTINCT FROM OLD.material_withheld
        OR NEW.timeout_is_success IS DISTINCT FROM OLD.timeout_is_success
        OR NEW.max_retries IS DISTINCT FROM OLD.max_retries
        OR NEW.switch_clear IS DISTINCT FROM OLD.switch_clear
        OR NEW.decision IS DISTINCT FROM OLD.decision
        OR NEW.admitted IS DISTINCT FROM OLD.admitted
        OR NEW.created_by IS DISTINCT FROM OLD.created_by
        OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'production safety is immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER finance_production_safety_immutable
    BEFORE UPDATE ON public.finance_production_safety_controls
    FOR EACH ROW
    EXECUTE PROCEDURE public.finance_production_safety_immutable();

CREATE OR REPLACE FUNCTION public.finance_engage_production_kill_switch(
    p_contract_id uuid,
    p_control jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    switch_org uuid;
    existing_id uuid;
    new_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF p_control IS NULL
        OR jsonb_typeof(p_control) <> 'object'
        OR p_control <> '{}'::jsonb
        OR public.finance_candidate_command(p_control) THEN
        RAISE EXCEPTION 'production safety is invalid';
    END IF;
    SELECT contracts.organization_id
    INTO switch_org
    FROM public.finance_execution_contracts contracts
    WHERE contracts.id = p_contract_id;
    IF switch_org IS NULL THEN
        RAISE EXCEPTION 'execution contract not found';
    END IF;
    IF NOT public.can_write_organization(switch_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    SELECT switches.id
    INTO existing_id
    FROM public.finance_production_kill_switches switches
    WHERE switches.organization_id = switch_org;
    IF existing_id IS NOT NULL THEN
        RETURN existing_id;
    END IF;
    BEGIN
        INSERT INTO public.finance_production_kill_switches (
            organization_id, engaged, engaged_by, engaged_at
        ) VALUES (
            switch_org, TRUE, auth.uid(), now()
        )
        RETURNING id INTO new_id;
    EXCEPTION
        WHEN unique_violation THEN
            SELECT switches.id
            INTO existing_id
            FROM public.finance_production_kill_switches switches
            WHERE switches.organization_id = switch_org;
            IF existing_id IS NOT NULL THEN
                RETURN existing_id;
            END IF;
            RAISE EXCEPTION 'production safety does not match';
    END;
    PERFORM public.finance_audit(
        switch_org,
        'production_kill_switch.engaged',
        'finance_production_kill_switch',
        new_id,
        jsonb_build_object('engaged', TRUE)
    );
    RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_pass_production_safety(
    p_contract_id uuid,
    p_control jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    safety_org uuid;
    production_id uuid;
    stored_identity text;
    order_quantity numeric;
    exposure_value numeric;
    switch_id uuid;
    existing_id uuid;
    new_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF p_control IS NULL
        OR jsonb_typeof(p_control) <> 'object'
        OR p_control <> '{}'::jsonb
        OR public.finance_candidate_command(p_control) THEN
        RAISE EXCEPTION 'production safety is invalid';
    END IF;
    PERFORM public.finance_match_production_authorization(p_contract_id);
    SELECT grants.organization_id, grants.id, grants.execution_identity,
           (contracts.contract->>'quantity')::numeric, books.market_value
    INTO safety_org, production_id, stored_identity, order_quantity, exposure_value
    FROM public.finance_production_authorizations grants
    JOIN public.finance_execution_contracts contracts ON contracts.id = grants.contract_id
    JOIN public.finance_order_intents intents ON intents.id = grants.intent_id
    JOIN public.finance_spec_books books ON books.id = intents.book_id
    WHERE grants.contract_id = p_contract_id;
    IF safety_org IS NULL
        OR production_id IS NULL
        OR stored_identity IS NULL
        OR order_quantity IS NULL
        OR exposure_value IS NULL THEN
        RAISE EXCEPTION 'production authorization not found';
    END IF;
    IF NOT public.can_write_organization(safety_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    SELECT switches.id
    INTO switch_id
    FROM public.finance_production_kill_switches switches
    WHERE switches.organization_id = safety_org
      AND switches.engaged;
    IF switch_id IS NOT NULL THEN
        RAISE EXCEPTION 'production kill switch is engaged';
    END IF;
    IF order_quantity > 1 OR exposure_value > 10000 THEN
        RAISE EXCEPTION 'production safety limit exceeded';
    END IF;
    SELECT controls.id
    INTO existing_id
    FROM public.finance_production_safety_controls controls
    WHERE controls.execution_identity = stored_identity;
    IF existing_id IS NOT NULL THEN
        RETURN existing_id;
    END IF;
    BEGIN
        INSERT INTO public.finance_production_safety_controls (
            organization_id, contract_id, production_authorization_id, execution_identity,
            order_quantity, exposure_value, order_limit, exposure_limit, allowed_targets,
            material_withheld, timeout_is_success, max_retries, switch_clear, decision,
            admitted, created_by
        ) VALUES (
            safety_org, p_contract_id, production_id, stored_identity,
            order_quantity, exposure_value, 1, 10000, '[]'::jsonb,
            TRUE, FALSE, 0, TRUE, 'held',
            FALSE, auth.uid()
        )
        RETURNING id INTO new_id;
    EXCEPTION
        WHEN unique_violation THEN
            SELECT controls.id
            INTO existing_id
            FROM public.finance_production_safety_controls controls
            WHERE controls.execution_identity = stored_identity;
            IF existing_id IS NOT NULL THEN
                RETURN existing_id;
            END IF;
            RAISE EXCEPTION 'production safety does not match';
    END;
    PERFORM public.finance_audit(
        safety_org,
        'production_safety.held',
        'finance_production_safety_control',
        new_id,
        jsonb_build_object(
            'execution_identity', stored_identity,
            'decision', 'held',
            'admitted', FALSE,
            'order_limit', 1,
            'exposure_limit', 10000,
            'max_retries', 0
        )
    );
    RETURN new_id;
END;
$$;

ALTER TABLE public.finance_production_kill_switches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_production_kill_switches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.finance_production_safety_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_production_safety_controls FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_production_kill_switches_select ON public.finance_production_kill_switches
    FOR SELECT TO app_user
    USING (public.is_organization_member(organization_id));

CREATE POLICY finance_production_safety_controls_select ON public.finance_production_safety_controls
    FOR SELECT TO app_user
    USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_engage_production_kill_switch(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_pass_production_safety(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_production_kill_switch_immutable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_production_safety_immutable() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_engage_production_kill_switch(uuid, jsonb) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_pass_production_safety(uuid, jsonb) TO app_user;

DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON public.finance_production_kill_switches FROM PUBLIC';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.finance_production_kill_switches FROM app_user';
    EXECUTE 'GRANT SELECT ON public.finance_production_kill_switches TO app_user';
    EXECUTE 'REVOKE ALL ON public.finance_production_safety_controls FROM PUBLIC';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.finance_production_safety_controls FROM app_user';
    EXECUTE 'GRANT SELECT ON public.finance_production_safety_controls TO app_user';
END $$;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON public.finance_production_kill_switches FROM %I', r);
            EXECUTE format('REVOKE ALL ON public.finance_production_safety_controls FROM %I', r);
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_engage_production_kill_switch(uuid, jsonb) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_pass_production_safety(uuid, jsonb) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_production_kill_switch_immutable() FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_production_safety_immutable() FROM %I',
                r
            );
        END IF;
    END LOOP;
END $$;
