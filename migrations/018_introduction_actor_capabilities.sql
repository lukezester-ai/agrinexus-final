-- Introduction Actor Boundary v1.
-- The UI consumes these server-derived capabilities and never infers actor side.
-- Existing command functions remain the final authorization and audit boundary.

CREATE OR REPLACE FUNCTION public.business_match_capabilities(p_match_ids uuid[])
RETURNS TABLE (
    match_id uuid,
    can_qualify boolean,
    can_request_introduction boolean,
    can_respond_introduction boolean,
    can_manage_relationship boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        m.id,
        m.lifecycle = 'candidate'
            AND public.can_write_organization(i.organization_id),
        m.lifecycle = 'qualified'
            AND public.can_write_organization(i.organization_id)
            AND (intro.id IS NULL OR intro.status = 'declined'),
        m.lifecycle = 'qualified'
            AND o.organization_id IS NOT NULL
            AND public.can_write_organization(o.organization_id)
            AND intro.status = 'requested',
        rel.id IS NOT NULL
            AND rel.status <> 'closed'
            AND (
                public.can_write_organization(rel.organization_a)
                OR public.can_write_organization(rel.organization_b)
            )
    FROM public.business_matches AS m
    JOIN public.business_intents AS i ON i.id = m.intent_id
    JOIN public.business_opportunities AS o ON o.id = m.opportunity_id
    LEFT JOIN public.business_match_introductions AS intro ON intro.match_id = m.id
    LEFT JOIN public.business_relationships AS rel ON rel.origin_match_id = m.id
    WHERE m.id = ANY(COALESCE(p_match_ids, '{}'::uuid[]))
      AND (
          public.is_organization_member(i.organization_id)
          OR (
              o.organization_id IS NOT NULL
              AND public.is_organization_member(o.organization_id)
          )
      );
$$;

REVOKE ALL ON FUNCTION public.business_match_capabilities(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.business_match_capabilities(uuid[]) TO app_user;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.business_match_capabilities(uuid[]) TO authenticated';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON FUNCTION public.business_match_capabilities(uuid[]) FROM anon';
    END IF;
END $$;
