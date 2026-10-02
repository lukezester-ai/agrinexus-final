SELECT 'FINGERPRINT=' || md5(string_agg(line, E'\n' ORDER BY line))
FROM (
    SELECT format('column %s %s %s %s %s', table_name, ordinal_position, column_name, udt_name, is_nullable) AS line
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN (
        'organizations', 'organization_memberships', 'organization_private_data',
        'organization_audit_log', 'organization_verifications'
      )
    UNION ALL
    SELECT format('index %s', indexdef)
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename IN (
        'organizations', 'organization_memberships', 'organization_private_data',
        'organization_audit_log', 'organization_verifications'
      )
    UNION ALL
    SELECT format(
        'policy %s %s %s %s',
        c.relname, pol.polname, pol.polcmd,
        coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') || '|' ||
            coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '')
    )
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'organizations', 'organization_memberships', 'organization_private_data',
        'organization_audit_log', 'organization_verifications'
      )
    UNION ALL
    SELECT format('function %s %s', p.proname, md5(p.prosrc))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('is_organization_member', 'can_write_organization')
    UNION ALL
    SELECT format('auth.uid %s', md5(p.prosrc))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
    UNION ALL
    SELECT format('enum %s %s', t.typname, e.enumlabel)
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'organization_role'
    UNION ALL
    SELECT format('rls %s %s %s', c.relname, c.relrowsecurity, c.relforcerowsecurity)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'organizations', 'organization_memberships', 'organization_private_data',
        'organization_audit_log', 'organization_verifications'
      )
    UNION ALL
    SELECT format('app_user %s %s %s %s', rolsuper, rolbypassrls, rolcreatedb, rolcreaterole)
    FROM pg_roles WHERE rolname = 'app_user'
    UNION ALL
    SELECT format('grant %s %s %s', grantee, table_name, privilege_type)
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND grantee = 'app_user'
      AND table_name IN (
        'organizations', 'organization_memberships', 'organization_private_data',
        'organization_audit_log', 'organization_verifications'
      )
) surface;
