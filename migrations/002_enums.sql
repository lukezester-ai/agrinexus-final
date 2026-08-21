DO $$ BEGIN
    CREATE TYPE public.organization_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.organization_memberships
    ADD COLUMN IF NOT EXISTS role public.organization_role NOT NULL DEFAULT 'member';
