-- Application role only. Does not create or replace auth.uid().
-- On the minimal-core gate, auth.uid() must stay the Supabase function.

DO $$ BEGIN
    CREATE ROLE app_user LOGIN PASSWORD 'app_password' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
