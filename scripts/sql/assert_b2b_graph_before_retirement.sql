-- Fail closed before 014. Does not drop anything.
DO $$
DECLARE
    delete_action "char";
    jobs_rls boolean;
    jobs_force boolean;
    job_policies integer;
    core_edges integer;
    owned_relations integer;
    owned_functions integer;
    matcher_login boolean;
BEGIN
    SELECT con.confdeltype INTO delete_action
    FROM pg_constraint con
    JOIN pg_class src ON src.oid = con.conrelid
    WHERE src.relname = 'business_relationships'
      AND con.conname = 'business_relationships_origin_match_id_fkey';
    IF delete_action IS DISTINCT FROM 'r' THEN
        RAISE EXCEPTION 'origin_match_id is not ON DELETE RESTRICT';
    END IF;

    SELECT c.relrowsecurity, c.relforcerowsecurity INTO jobs_rls, jobs_force
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'matching_jobs';
    SELECT count(*) INTO job_policies FROM pg_policy WHERE polrelid = 'public.matching_jobs'::regclass;
    IF jobs_rls OR jobs_force OR job_policies <> 0 THEN
        RAISE EXCEPTION 'matching_jobs has RLS or policies; retirement must drop it unchanged';
    END IF;

    SELECT rolcanlogin INTO matcher_login FROM pg_roles WHERE rolname = 'intent_matcher';
    IF matcher_login IS DISTINCT FROM false THEN
        RAISE EXCEPTION 'intent_matcher is missing or can log in';
    END IF;

    SELECT count(*) INTO owned_relations
    FROM pg_class c
    WHERE pg_get_userbyid(c.relowner) = 'intent_matcher';
    SELECT count(*) INTO owned_functions
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND pg_get_userbyid(p.proowner) = 'intent_matcher'
      AND p.proname = 'run_matching_engine_v1';
    IF owned_relations <> 0 OR owned_functions <> 1 THEN
        RAISE EXCEPTION 'intent_matcher ownership drifted: relations=% functions=%', owned_relations, owned_functions;
    END IF;

    WITH core_obj AS (
        SELECT c.oid FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname IN (
            'organizations', 'organization_memberships', 'organization_private_data',
            'organization_audit_log', 'organization_verifications'
          )
        UNION ALL
        SELECT p.oid FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE (n.nspname = 'public' AND p.proname IN ('is_organization_member', 'can_write_organization'))
           OR (n.nspname = 'auth' AND p.proname = 'uid')
        UNION ALL
        SELECT t.oid FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'organization_role'
    ),
    b2b AS (
        SELECT c.oid FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND (c.relname LIKE 'business_%' OR c.relname = 'matching_jobs')
        UNION ALL
        SELECT p.oid FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname NOT IN ('is_organization_member', 'can_write_organization')
        UNION ALL
        SELECT t.oid FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typtype = 'e' AND t.typname <> 'organization_role'
    )
    SELECT count(*) INTO core_edges
    FROM pg_depend d
    JOIN core_obj core ON core.oid = d.objid
    JOIN b2b b ON b.oid = d.refobjid;
    IF core_edges <> 0 THEN
        RAISE EXCEPTION 'core depends on B2B (% edges)', core_edges;
    END IF;
END $$;
