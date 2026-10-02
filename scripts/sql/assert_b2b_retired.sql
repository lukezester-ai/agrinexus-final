-- After 014. B2B catalog is empty. Core enum and helpers remain. service_role remains.
DO $$
DECLARE
    leftover text;
BEGIN
    SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO leftover
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'v', 'i')
      AND (
        c.relname LIKE 'business_%'
        OR c.relname LIKE 'idx_business_%'
        OR c.relname LIKE 'idx_matching_%'
        OR c.relname = 'matching_jobs'
        OR c.relname LIKE 'matching_jobs%'
      );
    IF leftover IS NOT NULL THEN
        RAISE EXCEPTION 'B2B relations or indexes remain: %', leftover;
    END IF;

    SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO leftover
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname NOT IN ('is_organization_member', 'can_write_organization');
    IF leftover IS NOT NULL THEN
        RAISE EXCEPTION 'public functions remain: %', leftover;
    END IF;

    SELECT string_agg(t.typname, ', ' ORDER BY t.typname) INTO leftover
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype = 'e' AND t.typname <> 'organization_role';
    IF leftover IS NOT NULL THEN
        RAISE EXCEPTION 'B2B enums remain: %', leftover;
    END IF;

    SELECT string_agg(pol.polname, ', ' ORDER BY pol.polname) INTO leftover
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname NOT IN (
        'organizations', 'organization_memberships', 'organization_private_data',
        'organization_audit_log', 'organization_verifications'
      );
    IF leftover IS NOT NULL THEN
        RAISE EXCEPTION 'non-core policies remain: %', leftover;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'intent_matcher') THEN
        RAISE EXCEPTION 'intent_matcher still exists';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        RAISE EXCEPTION 'service_role was removed';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'organization_role'
    ) THEN
        RAISE EXCEPTION 'organization_role was removed';
    END IF;
END $$;
