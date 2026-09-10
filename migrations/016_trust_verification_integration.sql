-- Trust/Verification Integration v1.
-- Controlled evidence requests and reviews, atomic audit, and deterministic
-- exclusion of suspended/revoked organizations from matching and visibility.

ALTER TABLE public.organization_verifications
    ADD COLUMN IF NOT EXISTS reviewed_by uuid,
    ADD COLUMN IF NOT EXISTS review_reason text;

ALTER TABLE public.organization_verifications
    DROP CONSTRAINT IF EXISTS organization_verifications_status_check;

ALTER TABLE public.organization_verifications
    ADD CONSTRAINT organization_verifications_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'suspended', 'revoked'));

CREATE OR REPLACE FUNCTION public.organization_matching_eligible(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT CASE
        WHEN target_organization_id IS NULL THEN true
        ELSE COALESCE((
            SELECT v.status NOT IN ('suspended', 'revoked')
            FROM public.organization_verifications v
            WHERE v.organization_id = target_organization_id
            ORDER BY COALESCE(v.reviewed_at, v.created_at) DESC, v.created_at DESC, v.id DESC
            LIMIT 1
        ), true)
    END;
$$;

CREATE OR REPLACE FUNCTION public.request_organization_verification_v1(
    p_organization_id uuid,
    p_evidence jsonb
) RETURNS public.organization_verifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    actor_id uuid := auth.uid();
    current_status text;
    created_record public.organization_verifications;
BEGIN
    IF actor_id IS NULL THEN
        RAISE EXCEPTION 'authentication required';
    END IF;
    IF NOT public.can_write_organization(p_organization_id) THEN
        RAISE EXCEPTION 'organization write permission required';
    END IF;
    IF p_evidence IS NULL OR jsonb_typeof(p_evidence) <> 'object' OR p_evidence = '{}'::jsonb THEN
        RAISE EXCEPTION 'verification evidence must be a non-empty object';
    END IF;

    SELECT v.status INTO current_status
    FROM public.organization_verifications v
    WHERE v.organization_id = p_organization_id
    ORDER BY COALESCE(v.reviewed_at, v.created_at) DESC, v.created_at DESC, v.id DESC
    LIMIT 1
    FOR UPDATE;

    IF current_status IS NOT NULL AND current_status <> 'rejected' THEN
        RAISE EXCEPTION 'verification request is not allowed from state %', current_status;
    END IF;

    INSERT INTO public.organization_verifications (organization_id, requested_by, status, evidence)
    VALUES (p_organization_id, actor_id, 'pending', p_evidence)
    RETURNING * INTO created_record;

    INSERT INTO public.organization_audit_log (
        organization_id, actor_user_id, action, subject_type, subject_id, details
    ) VALUES (
        p_organization_id, actor_id, 'verification.requested',
        'organization_verification', created_record.id,
        jsonb_build_object('new_status', 'pending')
    );

    RETURN created_record;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_organization_verification_v1(
    p_verification_id uuid,
    p_target_status text,
    p_reviewer_user_id uuid,
    p_reason text
) RETURNS public.organization_verifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    existing_record public.organization_verifications;
    updated_record public.organization_verifications;
BEGIN
    IF p_reviewer_user_id IS NULL THEN
        RAISE EXCEPTION 'reviewer attribution is required';
    END IF;
    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
        RAISE EXCEPTION 'review reason is required';
    END IF;

    SELECT * INTO existing_record
    FROM public.organization_verifications
    WHERE id = p_verification_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'verification record not found';
    END IF;

    IF NOT (
        (existing_record.status = 'pending' AND p_target_status IN ('approved', 'rejected'))
        OR (existing_record.status = 'approved' AND p_target_status IN ('suspended', 'revoked'))
        OR (existing_record.status = 'suspended' AND p_target_status IN ('approved', 'revoked'))
    ) THEN
        RAISE EXCEPTION 'verification transition % -> % is not allowed', existing_record.status, p_target_status;
    END IF;

    UPDATE public.organization_verifications
    SET status = p_target_status,
        reviewed_by = p_reviewer_user_id,
        review_reason = btrim(p_reason),
        reviewed_at = pg_catalog.now()
    WHERE id = p_verification_id
    RETURNING * INTO updated_record;

    INSERT INTO public.organization_audit_log (
        organization_id, actor_user_id, action, subject_type, subject_id, details
    ) VALUES (
        existing_record.organization_id, p_reviewer_user_id,
        'verification.status_changed', 'organization_verification', p_verification_id,
        jsonb_build_object('old_status', existing_record.status, 'new_status', p_target_status, 'reason', btrim(p_reason))
    );

    RETURN updated_record;
END;
$$;

ALTER FUNCTION public.organization_matching_eligible(uuid) OWNER TO postgres;
ALTER FUNCTION public.request_organization_verification_v1(uuid, jsonb) OWNER TO postgres;
ALTER FUNCTION public.review_organization_verification_v1(uuid, text, uuid, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.organization_matching_eligible(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_organization_verification_v1(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_organization_verification_v1(uuid, text, uuid, text) FROM PUBLIC;

REVOKE INSERT, UPDATE, DELETE ON public.organization_verifications FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.organization_verifications FROM app_user;
GRANT EXECUTE ON FUNCTION public.organization_matching_eligible(uuid) TO app_user;
GRANT EXECUTE ON FUNCTION public.request_organization_verification_v1(uuid, jsonb) TO app_user;

DO $$
DECLARE
    role_name text;
BEGIN
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
            EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.organization_verifications FROM %I', role_name);
            EXECUTE format('REVOKE ALL ON FUNCTION public.review_organization_verification_v1(uuid, text, uuid, text) FROM %I', role_name);
        END IF;
    END LOOP;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT SELECT ON public.organization_verifications TO authenticated;
        GRANT EXECUTE ON FUNCTION public.organization_matching_eligible(uuid) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.request_organization_verification_v1(uuid, jsonb) TO authenticated;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT SELECT ON public.organization_verifications TO service_role;
        GRANT EXECUTE ON FUNCTION public.organization_matching_eligible(uuid) TO service_role;
        GRANT EXECUTE ON FUNCTION public.review_organization_verification_v1(uuid, text, uuid, text) TO service_role;
    END IF;
END $$;

GRANT SELECT ON public.organization_verifications TO intent_matcher;
GRANT EXECUTE ON FUNCTION public.organization_matching_eligible(uuid) TO intent_matcher;

DROP POLICY IF EXISTS verification_insert ON public.organization_verifications;
DROP POLICY IF EXISTS verification_insert_authenticated ON public.organization_verifications;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        DROP POLICY IF EXISTS verification_select_authenticated ON public.organization_verifications;
        CREATE POLICY verification_select_authenticated ON public.organization_verifications
        FOR SELECT TO authenticated
        USING (public.is_organization_member(organization_id));
    END IF;
END $$;

DROP POLICY IF EXISTS business_intent_match_index_matcher ON public.business_intent_match_index;
CREATE POLICY business_intent_match_index_matcher ON public.business_intent_match_index
FOR SELECT TO intent_matcher
USING (public.organization_matching_eligible(organization_id));

DROP POLICY IF EXISTS business_opportunity_match_index_matcher ON public.business_opportunity_match_index;
CREATE POLICY business_opportunity_match_index_matcher ON public.business_opportunity_match_index
FOR SELECT TO intent_matcher
USING (public.organization_matching_eligible(organization_id));

DROP POLICY IF EXISTS business_matches_select ON public.business_matches;
CREATE POLICY business_matches_select ON public.business_matches
FOR SELECT TO app_user
USING (
    public.organization_matching_eligible((SELECT i.organization_id FROM public.business_intents i WHERE i.id = intent_id))
    AND public.organization_matching_eligible((SELECT o.organization_id FROM public.business_opportunities o WHERE o.id = opportunity_id))
    AND (
        EXISTS (SELECT 1 FROM public.business_intents i WHERE i.id = intent_id AND public.is_organization_member(i.organization_id))
        OR EXISTS (
            SELECT 1 FROM public.business_opportunities o
            WHERE o.id = opportunity_id AND o.organization_id IS NOT NULL
              AND public.is_organization_member(o.organization_id)
        )
    )
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        DROP POLICY IF EXISTS business_matches_select_authenticated ON public.business_matches;
        CREATE POLICY business_matches_select_authenticated ON public.business_matches
        FOR SELECT TO authenticated
        USING (
            public.organization_matching_eligible((SELECT i.organization_id FROM public.business_intents i WHERE i.id = intent_id))
            AND public.organization_matching_eligible((SELECT o.organization_id FROM public.business_opportunities o WHERE o.id = opportunity_id))
            AND (
                EXISTS (SELECT 1 FROM public.business_intents i WHERE i.id = intent_id AND public.is_organization_member(i.organization_id))
                OR EXISTS (
                    SELECT 1 FROM public.business_opportunities o
                    WHERE o.id = opportunity_id AND o.organization_id IS NOT NULL
                      AND public.is_organization_member(o.organization_id)
                )
            )
        );
    END IF;
END $$;
