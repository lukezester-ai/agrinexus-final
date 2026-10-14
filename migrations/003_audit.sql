CREATE TABLE IF NOT EXISTS public.organization_audit_log (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_user_id uuid NOT NULL,
    action text NOT NULL,
    subject_type text NOT NULL,
    subject_id uuid,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_org_created
    ON public.organization_audit_log(organization_id, created_at DESC);
