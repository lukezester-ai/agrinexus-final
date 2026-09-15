-- Verification Review Workspace v1.
-- Platform-reviewer authorization is private and deny-by-default. The browser
-- receives only authenticated RPC access; the service-role key remains server-only.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE TABLE IF NOT EXISTS private.verification_reviewers (
    user_id uuid PRIMARY KEY,
    granted_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
    granted_by uuid
);

ALTER TABLE private.verification_reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.verification_reviewers FORCE ROW LEVEL SECURITY;
REVOKE ALL ON private.verification_reviewers FROM PUBLIC, app_user;

CREATE OR REPLACE FUNCTION private.is_verification_reviewer_v1()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT auth.uid() IS NOT NULL
       AND EXISTS (
            SELECT 1
            FROM private.verification_reviewers reviewer
            WHERE reviewer.user_id = auth.uid()
       );
$$;

CREATE OR REPLACE FUNCTION public.is_verification_reviewer_v1()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT private.is_verification_reviewer_v1();
$$;

CREATE OR REPLACE FUNCTION private.verification_review_queue_v1()
RETURNS TABLE (
    verification_id uuid,
    organization_id uuid,
    organization_name text,
    evidence jsonb,
    requested_by uuid,
    requested_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT private.is_verification_reviewer_v1() THEN
        RAISE EXCEPTION 'verification reviewer permission required' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT verification.id, verification.organization_id, organization.name,
           verification.evidence, verification.requested_by, verification.created_at
    FROM public.organization_verifications verification
    JOIN public.organizations organization ON organization.id = verification.organization_id
    WHERE verification.status = 'pending'
    ORDER BY verification.created_at ASC, verification.id ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.verification_review_queue_v1()
RETURNS TABLE (
    verification_id uuid,
    organization_id uuid,
    organization_name text,
    evidence jsonb,
    requested_by uuid,
    requested_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT * FROM private.verification_review_queue_v1();
$$;

CREATE OR REPLACE FUNCTION private.review_organization_verification_authenticated_v1(
    p_verification_id uuid,
    p_target_status text,
    p_reason text
)
RETURNS public.organization_verifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    actor_id uuid := auth.uid();
BEGIN
    IF NOT private.is_verification_reviewer_v1() THEN
        RAISE EXCEPTION 'verification reviewer permission required' USING ERRCODE = '42501';
    END IF;
    IF p_target_status NOT IN ('approved', 'rejected') THEN
        RAISE EXCEPTION 'review target must be approved or rejected' USING ERRCODE = '22023';
    END IF;

    RETURN public.review_organization_verification_v1(
        p_verification_id,
        p_target_status,
        actor_id,
        p_reason
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.review_organization_verification_authenticated_v1(
    p_verification_id uuid,
    p_target_status text,
    p_reason text
)
RETURNS public.organization_verifications
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT private.review_organization_verification_authenticated_v1(
        p_verification_id,
        p_target_status,
        p_reason
    );
$$;

REVOKE ALL ON FUNCTION private.is_verification_reviewer_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.verification_review_queue_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.review_organization_verification_authenticated_v1(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_verification_reviewer_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verification_review_queue_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.review_organization_verification_authenticated_v1(uuid, text, text) FROM PUBLIC;

GRANT USAGE ON SCHEMA private TO app_user;
GRANT EXECUTE ON FUNCTION private.is_verification_reviewer_v1() TO app_user;
GRANT EXECUTE ON FUNCTION private.verification_review_queue_v1() TO app_user;
GRANT EXECUTE ON FUNCTION private.review_organization_verification_authenticated_v1(uuid, text, text) TO app_user;
GRANT EXECUTE ON FUNCTION public.is_verification_reviewer_v1() TO app_user;
GRANT EXECUTE ON FUNCTION public.verification_review_queue_v1() TO app_user;
GRANT EXECUTE ON FUNCTION public.review_organization_verification_authenticated_v1(uuid, text, text) TO app_user;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'REVOKE ALL ON private.verification_reviewers FROM authenticated';
        EXECUTE 'GRANT USAGE ON SCHEMA private TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION private.is_verification_reviewer_v1() TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION private.verification_review_queue_v1() TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION private.review_organization_verification_authenticated_v1(uuid, text, text) TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_verification_reviewer_v1() TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.verification_review_queue_v1() TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.review_organization_verification_authenticated_v1(uuid, text, text) TO authenticated';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON private.verification_reviewers FROM anon';
        EXECUTE 'REVOKE ALL ON FUNCTION private.is_verification_reviewer_v1() FROM anon';
        EXECUTE 'REVOKE ALL ON FUNCTION private.verification_review_queue_v1() FROM anon';
        EXECUTE 'REVOKE ALL ON FUNCTION private.review_organization_verification_authenticated_v1(uuid, text, text) FROM anon';
        EXECUTE 'REVOKE ALL ON FUNCTION public.is_verification_reviewer_v1() FROM anon';
        EXECUTE 'REVOKE ALL ON FUNCTION public.verification_review_queue_v1() FROM anon';
        EXECUTE 'REVOKE ALL ON FUNCTION public.review_organization_verification_authenticated_v1(uuid, text, text) FROM anon';
    END IF;
END $$;

-- Reviewer enrollment is an explicit production operation, never an app flow:
-- INSERT INTO private.verification_reviewers (user_id, granted_by) VALUES (<reviewer auth uid>, <granting auth uid>);
