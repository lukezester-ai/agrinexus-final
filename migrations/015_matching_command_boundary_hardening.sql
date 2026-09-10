-- Matching Engine v1 command-boundary hardening.
-- Supabase `authenticated` inherits the local `app_user` role, so revoking
-- UPDATE only from `authenticated` does not remove the inherited privilege.
-- Lifecycle mutations remain available through SECURITY DEFINER commands.

REVOKE UPDATE ON public.business_matches FROM app_user;
REVOKE INSERT, UPDATE, DELETE ON public.business_matches FROM PUBLIC;

DO $$
DECLARE
    role_name text;
BEGIN
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
            EXECUTE format(
                'REVOKE INSERT, UPDATE, DELETE ON public.business_matches FROM %I',
                role_name
            );
        END IF;
    END LOOP;
END $$;
