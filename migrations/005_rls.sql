CREATE OR REPLACE FUNCTION public.is_organization_member(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_memberships m
        WHERE m.organization_id = target_organization_id
          AND m.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.can_write_organization(target_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.organization_memberships m
        WHERE m.organization_id = target_organization_id
          AND m.user_id = auth.uid()
          AND m.role IN ('owner', 'admin', 'member')
    );
$$;

REVOKE ALL ON FUNCTION public.is_organization_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_organization_member(uuid) TO app_user;
REVOKE ALL ON FUNCTION public.can_write_organization(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_write_organization(uuid) TO app_user;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_private_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_verifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_private_data FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_verifications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_select ON public.organizations;
CREATE POLICY organizations_select ON public.organizations FOR SELECT TO app_user
USING (owner_user_id = auth.uid() OR public.is_organization_member(id));

DROP POLICY IF EXISTS organizations_insert ON public.organizations;
CREATE POLICY organizations_insert ON public.organizations FOR INSERT TO app_user
WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS organizations_update ON public.organizations;
CREATE POLICY organizations_update ON public.organizations FOR UPDATE TO app_user
USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS memberships_select ON public.organization_memberships;
CREATE POLICY memberships_select ON public.organization_memberships FOR SELECT TO app_user
USING (user_id = auth.uid() OR public.is_organization_member(organization_id));

DROP POLICY IF EXISTS memberships_write_owner ON public.organization_memberships;
CREATE POLICY memberships_write_owner ON public.organization_memberships FOR ALL TO app_user
USING (EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.owner_user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.owner_user_id = auth.uid()));

DROP POLICY IF EXISTS private_data_member ON public.organization_private_data;
CREATE POLICY private_data_member ON public.organization_private_data FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));

DROP POLICY IF EXISTS private_data_insert ON public.organization_private_data;
CREATE POLICY private_data_insert ON public.organization_private_data FOR INSERT TO app_user
WITH CHECK (public.can_write_organization(organization_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS private_data_update ON public.organization_private_data;
CREATE POLICY private_data_update ON public.organization_private_data FOR UPDATE TO app_user
USING (public.can_write_organization(organization_id))
WITH CHECK (public.can_write_organization(organization_id));

DROP POLICY IF EXISTS private_data_delete ON public.organization_private_data;
CREATE POLICY private_data_delete ON public.organization_private_data FOR DELETE TO app_user
USING (public.can_write_organization(organization_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS audit_select ON public.organization_audit_log;
CREATE POLICY audit_select ON public.organization_audit_log FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));

DROP POLICY IF EXISTS audit_insert ON public.organization_audit_log;
CREATE POLICY audit_insert ON public.organization_audit_log FOR INSERT TO app_user
WITH CHECK (public.can_write_organization(organization_id) AND actor_user_id = auth.uid());

DROP POLICY IF EXISTS verification_select ON public.organization_verifications;
CREATE POLICY verification_select ON public.organization_verifications FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));

DROP POLICY IF EXISTS verification_insert ON public.organization_verifications;
CREATE POLICY verification_insert ON public.organization_verifications FOR INSERT TO app_user
WITH CHECK (public.can_write_organization(organization_id) AND requested_by = auth.uid());

GRANT USAGE ON SCHEMA public, auth TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON FUNCTION auth.uid() TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO app_user;
