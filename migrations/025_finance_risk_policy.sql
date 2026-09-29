-- Risk governance v1 gate 1. Does not alter 001-005 and does not recreate 006-024.
-- A risk policy is a canonical document with a digest. It does not evaluate a strategy,
-- run a backtest, change an approval, or write a paper book.

CREATE TABLE public.finance_risk_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    policy jsonb NOT NULL,
    policy_digest text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_finance_risk_policies_org
    ON public.finance_risk_policies (organization_id);

CREATE OR REPLACE FUNCTION public.finance_risk_policy_strings(p_value jsonb) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
    item jsonb;
    text_item text;
    seen text[] := ARRAY[]::text[];
    ordered text[] := ARRAY[]::text[];
BEGIN
    IF p_value IS NULL OR jsonb_typeof(p_value) <> 'array' THEN
        RAISE EXCEPTION 'risk policy is invalid';
    END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(p_value) LOOP
        IF jsonb_typeof(item) <> 'string' THEN
            RAISE EXCEPTION 'risk policy is invalid';
        END IF;
        text_item := item #>> '{}';
        IF text_item IS NULL
            OR text_item = ''
            OR text_item <> btrim(text_item)
            OR text_item IN ('broker', 'live')
            OR text_item = ANY (seen) THEN
            RAISE EXCEPTION 'risk policy is invalid';
        END IF;
        seen := seen || ARRAY[text_item];
    END LOOP;
    SELECT COALESCE(array_agg(sorted.item ORDER BY sorted.item COLLATE "C"), ARRAY[]::text[])
    INTO ordered
    FROM unnest(seen) AS sorted(item);
    RETURN to_jsonb(ordered);
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_risk_policy_number(p_value jsonb, p_integer boolean) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
    amount numeric;
BEGIN
    IF p_value IS NULL OR jsonb_typeof(p_value) <> 'number' THEN
        RAISE EXCEPTION 'risk policy is invalid';
    END IF;
    amount := (p_value #>> '{}')::numeric;
    IF amount < 0 OR (p_integer AND amount <> trunc(amount)) THEN
        RAISE EXCEPTION 'risk policy is invalid';
    END IF;
    RETURN p_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_risk_policy_document(p_policy jsonb) RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
    keys text[];
BEGIN
    IF p_policy IS NULL
        OR jsonb_typeof(p_policy) <> 'object'
        OR public.finance_candidate_command(p_policy) THEN
        RAISE EXCEPTION 'risk policy is invalid';
    END IF;
    SELECT COALESCE(array_agg(object_key ORDER BY object_key COLLATE "C"), ARRAY[]::text[])
    INTO keys
    FROM jsonb_object_keys(p_policy) AS object_key;
    IF keys <> ARRAY[
        'allowed_instruments',
        'allowed_strategies',
        'forbidden_actions',
        'max_concurrent_positions',
        'max_drawdown',
        'max_exposure',
        'max_risk_per_position'
    ]::text[] THEN
        RAISE EXCEPTION 'risk policy is invalid';
    END IF;
    RETURN jsonb_build_object(
        'allowed_instruments', public.finance_risk_policy_strings(p_policy -> 'allowed_instruments'),
        'allowed_strategies', public.finance_risk_policy_strings(p_policy -> 'allowed_strategies'),
        'forbidden_actions', public.finance_risk_policy_strings(p_policy -> 'forbidden_actions'),
        'max_concurrent_positions', public.finance_risk_policy_number(p_policy -> 'max_concurrent_positions', true),
        'max_drawdown', public.finance_risk_policy_number(p_policy -> 'max_drawdown', false),
        'max_exposure', public.finance_risk_policy_number(p_policy -> 'max_exposure', false),
        'max_risk_per_position', public.finance_risk_policy_number(p_policy -> 'max_risk_per_position', false)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_create_risk_policy(
    p_organization_id uuid,
    p_policy jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    canonical jsonb;
    digest text;
    new_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    IF NOT public.can_write_organization(p_organization_id) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    canonical := public.finance_risk_policy_document(p_policy);
    digest := md5(public.finance_canonical_json(canonical));
    INSERT INTO public.finance_risk_policies (organization_id, policy, policy_digest, created_by)
    VALUES (p_organization_id, canonical, digest, auth.uid())
    RETURNING id INTO new_id;
    PERFORM public.finance_audit(
        p_organization_id,
        'risk_policy.created',
        'finance_risk_policy',
        new_id,
        jsonb_build_object('policy_digest', digest)
    );
    RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finance_replace_risk_policy(
    p_policy_id uuid,
    p_policy jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    org_id uuid;
    canonical jsonb;
    digest text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    SELECT policies.organization_id
    INTO org_id
    FROM public.finance_risk_policies policies
    WHERE policies.id = p_policy_id;
    IF org_id IS NULL THEN
        RAISE EXCEPTION 'risk policy not found';
    END IF;
    IF NOT public.can_write_organization(org_id) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    canonical := public.finance_risk_policy_document(p_policy);
    digest := md5(public.finance_canonical_json(canonical));
    UPDATE public.finance_risk_policies
    SET policy = canonical,
        policy_digest = digest,
        updated_at = now()
    WHERE id = p_policy_id;
    PERFORM public.finance_audit(
        org_id,
        'risk_policy.replaced',
        'finance_risk_policy',
        p_policy_id,
        jsonb_build_object('policy_digest', digest)
    );
    RETURN p_policy_id;
END;
$$;

ALTER TABLE public.finance_risk_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_risk_policies FORCE ROW LEVEL SECURITY;

CREATE POLICY finance_risk_policies_select ON public.finance_risk_policies
    FOR SELECT TO app_user
    USING (public.is_organization_member(organization_id));

REVOKE ALL ON FUNCTION public.finance_risk_policy_strings(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_risk_policy_number(jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_risk_policy_document(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_create_risk_policy(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finance_replace_risk_policy(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_create_risk_policy(uuid, jsonb) TO app_user;
GRANT EXECUTE ON FUNCTION public.finance_replace_risk_policy(uuid, jsonb) TO app_user;

DO $$
BEGIN
    EXECUTE 'REVOKE ALL ON public.finance_risk_policies FROM PUBLIC';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.finance_risk_policies FROM app_user';
    EXECUTE 'GRANT SELECT ON public.finance_risk_policies TO app_user';
END $$;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON public.finance_risk_policies FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_risk_policy_strings(jsonb) FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_risk_policy_number(jsonb, boolean) FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_risk_policy_document(jsonb) FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_create_risk_policy(uuid, jsonb) FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.finance_replace_risk_policy(uuid, jsonb) FROM %I', r);
        END IF;
    END LOOP;
END $$;
