-- Business Opportunity Command Boundary v1.
-- Organization-owned manual opportunities mutate only through audited RPCs.

CREATE OR REPLACE FUNCTION private.create_business_opportunity_v1(
    p_organization_id uuid,
    p_kind text,
    p_title text,
    p_summary text,
    p_industry text,
    p_target_markets text[],
    p_visibility public.business_opportunity_visibility,
    p_initial_lifecycle public.business_opportunity_lifecycle DEFAULT 'draft',
    p_expires_at timestamptz DEFAULT NULL,
    p_private_brief text DEFAULT NULL
)
RETURNS public.business_opportunities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    actor_id uuid := auth.uid();
    actor_role public.organization_role;
    created_opportunity public.business_opportunities;
    normalized_kind text := lower(btrim(COALESCE(p_kind, '')));
BEGIN
    IF actor_id IS NULL THEN
        RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT m.role
      INTO actor_role
      FROM public.organization_memberships AS m
     WHERE m.organization_id = p_organization_id
       AND m.user_id = actor_id;

    IF actor_role IS NULL OR actor_role = 'viewer' THEN
        RAISE EXCEPTION 'opportunity creation is not permitted' USING ERRCODE = '42501';
    END IF;

    IF normalized_kind NOT IN (
        'buy', 'sell', 'partner', 'invest', 'supply', 'distribute', 'hire', 'seek_capability'
    ) THEN
        RAISE EXCEPTION 'unsupported opportunity kind' USING ERRCODE = '22023';
    END IF;

    IF p_initial_lifecycle NOT IN ('draft', 'open') THEN
        RAISE EXCEPTION 'initial lifecycle must be draft or open' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.business_opportunities (
        organization_id,
        created_by,
        source_type,
        source_ref,
        title,
        summary,
        industry,
        target_markets,
        visibility,
        lifecycle,
        expires_at,
        facets,
        provenance
    ) VALUES (
        p_organization_id,
        actor_id,
        'manual',
        'command:create_business_opportunity_v1',
        p_title,
        COALESCE(p_summary, ''),
        p_industry,
        COALESCE(p_target_markets, '{}'::text[]),
        p_visibility,
        p_initial_lifecycle,
        p_expires_at,
        pg_catalog.jsonb_build_object('kind', normalized_kind),
        pg_catalog.jsonb_build_object(
            'recorded_at', pg_catalog.now(),
            'source_type', 'manual',
            'command', 'create_business_opportunity_v1'
        )
    )
    RETURNING * INTO created_opportunity;

    IF NULLIF(btrim(COALESCE(p_private_brief, '')), '') IS NOT NULL THEN
        INSERT INTO public.business_opportunity_secrets (
            opportunity_id,
            organization_id,
            private_brief
        ) VALUES (
            created_opportunity.id,
            created_opportunity.organization_id,
            p_private_brief
        );
    END IF;

    INSERT INTO public.organization_audit_log (
        organization_id,
        actor_user_id,
        action,
        subject_type,
        subject_id,
        details
    ) VALUES (
        created_opportunity.organization_id,
        actor_id,
        'opportunity.created',
        'business_opportunity',
        created_opportunity.id,
        pg_catalog.jsonb_build_object(
            'kind', normalized_kind,
            'source_type', created_opportunity.source_type::text,
            'visibility', created_opportunity.visibility::text,
            'lifecycle', created_opportunity.lifecycle::text
        )
    );

    RETURN created_opportunity;
END;
$$;

CREATE OR REPLACE FUNCTION private.transition_business_opportunity_v1(
    p_opportunity_id uuid,
    p_target_lifecycle public.business_opportunity_lifecycle
)
RETURNS public.business_opportunities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    actor_id uuid := auth.uid();
    actor_role public.organization_role;
    current_opportunity public.business_opportunities;
    updated_opportunity public.business_opportunities;
    transition_allowed boolean := false;
BEGIN
    IF actor_id IS NULL THEN
        RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT o.*
      INTO current_opportunity
      FROM public.business_opportunities AS o
     WHERE o.id = p_opportunity_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'business opportunity not found' USING ERRCODE = 'P0002';
    END IF;

    IF current_opportunity.organization_id IS NULL
       OR current_opportunity.source_type <> 'manual' THEN
        RAISE EXCEPTION 'only organization-owned manual opportunities use this command'
            USING ERRCODE = '42501';
    END IF;

    SELECT m.role
      INTO actor_role
      FROM public.organization_memberships AS m
     WHERE m.organization_id = current_opportunity.organization_id
       AND m.user_id = actor_id;

    IF actor_role IS NULL OR actor_role = 'viewer' THEN
        RAISE EXCEPTION 'opportunity transition is not permitted' USING ERRCODE = '42501';
    END IF;

    IF actor_role = 'member' AND current_opportunity.created_by IS DISTINCT FROM actor_id THEN
        RAISE EXCEPTION 'members may transition only opportunities they created' USING ERRCODE = '42501';
    END IF;

    IF p_target_lifecycle = 'expired' THEN
        RAISE EXCEPTION 'target lifecycle is process-owned' USING ERRCODE = '42501';
    END IF;

    transition_allowed := CASE current_opportunity.lifecycle
        WHEN 'draft' THEN p_target_lifecycle IN ('open', 'withdrawn')
        WHEN 'open' THEN p_target_lifecycle IN ('paused', 'pursuing', 'fulfilled', 'withdrawn')
        WHEN 'paused' THEN p_target_lifecycle IN ('open', 'pursuing', 'fulfilled', 'withdrawn')
        WHEN 'pursuing' THEN p_target_lifecycle IN ('paused', 'fulfilled', 'withdrawn')
        ELSE false
    END;

    IF NOT transition_allowed THEN
        RAISE EXCEPTION 'lifecycle transition from % to % is not permitted',
            current_opportunity.lifecycle, p_target_lifecycle
            USING ERRCODE = '22023';
    END IF;

    IF p_target_lifecycle = 'fulfilled' AND actor_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'only owner or admin may fulfill an opportunity' USING ERRCODE = '42501';
    END IF;

    UPDATE public.business_opportunities
       SET lifecycle = p_target_lifecycle
     WHERE id = current_opportunity.id
    RETURNING * INTO updated_opportunity;

    INSERT INTO public.organization_audit_log (
        organization_id,
        actor_user_id,
        action,
        subject_type,
        subject_id,
        details
    ) VALUES (
        updated_opportunity.organization_id,
        actor_id,
        'opportunity.status_changed',
        'business_opportunity',
        updated_opportunity.id,
        pg_catalog.jsonb_build_object(
            'from', current_opportunity.lifecycle::text,
            'to', updated_opportunity.lifecycle::text
        )
    );

    RETURN updated_opportunity;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_business_opportunity_v1(
    p_organization_id uuid,
    p_kind text,
    p_title text,
    p_summary text,
    p_industry text,
    p_target_markets text[],
    p_visibility public.business_opportunity_visibility,
    p_initial_lifecycle public.business_opportunity_lifecycle DEFAULT 'draft',
    p_expires_at timestamptz DEFAULT NULL,
    p_private_brief text DEFAULT NULL
)
RETURNS public.business_opportunities
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT private.create_business_opportunity_v1(
        p_organization_id,
        p_kind,
        p_title,
        p_summary,
        p_industry,
        p_target_markets,
        p_visibility,
        p_initial_lifecycle,
        p_expires_at,
        p_private_brief
    );
$$;

CREATE OR REPLACE FUNCTION public.transition_business_opportunity_v1(
    p_opportunity_id uuid,
    p_target_lifecycle public.business_opportunity_lifecycle
)
RETURNS public.business_opportunities
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT private.transition_business_opportunity_v1(p_opportunity_id, p_target_lifecycle);
$$;

REVOKE ALL ON FUNCTION private.create_business_opportunity_v1(
    uuid, text, text, text, text, text[],
    public.business_opportunity_visibility,
    public.business_opportunity_lifecycle,
    timestamptz, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.transition_business_opportunity_v1(
    uuid, public.business_opportunity_lifecycle
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_business_opportunity_v1(
    uuid, text, text, text, text, text[],
    public.business_opportunity_visibility,
    public.business_opportunity_lifecycle,
    timestamptz, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transition_business_opportunity_v1(
    uuid, public.business_opportunity_lifecycle
) FROM PUBLIC;

DROP POLICY IF EXISTS business_opportunities_insert ON public.business_opportunities;
DROP POLICY IF EXISTS business_opportunities_update ON public.business_opportunities;
DROP POLICY IF EXISTS business_opportunities_delete ON public.business_opportunities;
DROP POLICY IF EXISTS business_opportunity_secrets_member ON public.business_opportunity_secrets;

DROP POLICY IF EXISTS business_opportunity_secrets_select_app_user ON public.business_opportunity_secrets;
CREATE POLICY business_opportunity_secrets_select_app_user ON public.business_opportunity_secrets
FOR SELECT TO app_user
USING (public.is_organization_member(organization_id));

REVOKE INSERT, UPDATE, DELETE ON public.business_opportunities FROM app_user;
REVOKE INSERT, UPDATE, DELETE ON public.business_opportunity_secrets FROM app_user;

GRANT USAGE ON SCHEMA private TO app_user;
GRANT EXECUTE ON FUNCTION private.create_business_opportunity_v1(
    uuid, text, text, text, text, text[],
    public.business_opportunity_visibility,
    public.business_opportunity_lifecycle,
    timestamptz, text
) TO app_user;
GRANT EXECUTE ON FUNCTION private.transition_business_opportunity_v1(
    uuid, public.business_opportunity_lifecycle
) TO app_user;
GRANT EXECUTE ON FUNCTION public.create_business_opportunity_v1(
    uuid, text, text, text, text, text[],
    public.business_opportunity_visibility,
    public.business_opportunity_lifecycle,
    timestamptz, text
) TO app_user;
GRANT EXECUTE ON FUNCTION public.transition_business_opportunity_v1(
    uuid, public.business_opportunity_lifecycle
) TO app_user;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.business_opportunities FROM authenticated';
        EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.business_opportunity_secrets FROM authenticated';

        EXECUTE 'GRANT USAGE ON SCHEMA public TO authenticated';
        EXECUTE 'GRANT USAGE ON SCHEMA private TO authenticated';
        EXECUTE 'GRANT USAGE ON SCHEMA auth TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_organization_member(uuid) TO authenticated';
        EXECUTE 'GRANT USAGE ON TYPE public.business_opportunity_visibility TO authenticated';
        EXECUTE 'GRANT USAGE ON TYPE public.business_opportunity_lifecycle TO authenticated';
        EXECUTE 'GRANT SELECT ON public.business_opportunities TO authenticated';
        EXECUTE 'GRANT SELECT ON public.business_opportunity_secrets TO authenticated';
        EXECUTE 'GRANT SELECT ON public.organization_audit_log TO authenticated';

        EXECUTE 'GRANT EXECUTE ON FUNCTION private.create_business_opportunity_v1(uuid, text, text, text, text, text[], public.business_opportunity_visibility, public.business_opportunity_lifecycle, timestamptz, text) TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION private.transition_business_opportunity_v1(uuid, public.business_opportunity_lifecycle) TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.create_business_opportunity_v1(uuid, text, text, text, text, text[], public.business_opportunity_visibility, public.business_opportunity_lifecycle, timestamptz, text) TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.transition_business_opportunity_v1(uuid, public.business_opportunity_lifecycle) TO authenticated';

        EXECUTE 'DROP POLICY IF EXISTS business_opportunities_select_authenticated ON public.business_opportunities';
        EXECUTE $policy$
            CREATE POLICY business_opportunities_select_authenticated ON public.business_opportunities
            FOR SELECT TO authenticated
            USING (
                (organization_id IS NOT NULL AND public.is_organization_member(organization_id))
                OR (
                    lifecycle = 'open'
                    AND visibility IN ('network', 'public')
                    AND (expires_at IS NULL OR expires_at > pg_catalog.now())
                )
            )
        $policy$;

        EXECUTE 'DROP POLICY IF EXISTS business_opportunity_secrets_select_authenticated ON public.business_opportunity_secrets';
        EXECUTE $policy$
            CREATE POLICY business_opportunity_secrets_select_authenticated ON public.business_opportunity_secrets
            FOR SELECT TO authenticated
            USING (public.is_organization_member(organization_id))
        $policy$;
    END IF;
END $$;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format(
                'REVOKE ALL ON FUNCTION private.create_business_opportunity_v1(uuid, text, text, text, text, text[], public.business_opportunity_visibility, public.business_opportunity_lifecycle, timestamptz, text) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION private.transition_business_opportunity_v1(uuid, public.business_opportunity_lifecycle) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.create_business_opportunity_v1(uuid, text, text, text, text, text[], public.business_opportunity_visibility, public.business_opportunity_lifecycle, timestamptz, text) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.transition_business_opportunity_v1(uuid, public.business_opportunity_lifecycle) FROM %I',
                r
            );
        END IF;
    END LOOP;
END $$;
