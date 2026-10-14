-- Business Intent Engine v1 command boundary.
-- Mutations are transaction-owned RPCs; direct client writes are revoked.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

CREATE OR REPLACE FUNCTION private.create_business_intent_v1(
    p_organization_id uuid,
    p_kind public.business_intent_kind,
    p_headline text,
    p_public_summary text,
    p_industry text,
    p_target_markets text[],
    p_visibility public.business_intent_visibility,
    p_initial_lifecycle public.business_intent_lifecycle DEFAULT 'draft',
    p_expires_at timestamptz DEFAULT NULL,
    p_private_brief text DEFAULT NULL
)
RETURNS public.business_intents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    actor_id uuid := auth.uid();
    actor_role public.organization_role;
    created_intent public.business_intents;
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
        RAISE EXCEPTION 'intent creation is not permitted' USING ERRCODE = '42501';
    END IF;

    IF p_initial_lifecycle NOT IN ('draft', 'active') THEN
        RAISE EXCEPTION 'initial lifecycle must be draft or active' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.business_intents (
        organization_id,
        created_by,
        kind,
        headline,
        public_summary,
        industry,
        target_markets,
        visibility,
        lifecycle,
        expires_at
    ) VALUES (
        p_organization_id,
        actor_id,
        p_kind,
        p_headline,
        COALESCE(p_public_summary, ''),
        p_industry,
        COALESCE(p_target_markets, '{}'::text[]),
        p_visibility,
        p_initial_lifecycle,
        p_expires_at
    )
    RETURNING * INTO created_intent;

    IF NULLIF(btrim(COALESCE(p_private_brief, '')), '') IS NOT NULL THEN
        INSERT INTO public.business_intent_secrets (
            intent_id,
            organization_id,
            private_brief
        ) VALUES (
            created_intent.id,
            created_intent.organization_id,
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
        created_intent.organization_id,
        actor_id,
        'intent.created',
        'business_intent',
        created_intent.id,
        pg_catalog.jsonb_build_object(
            'kind', created_intent.kind::text,
            'visibility', created_intent.visibility::text,
            'lifecycle', created_intent.lifecycle::text
        )
    );

    RETURN created_intent;
END;
$$;

CREATE OR REPLACE FUNCTION private.transition_business_intent_v1(
    p_intent_id uuid,
    p_target_lifecycle public.business_intent_lifecycle
)
RETURNS public.business_intents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    actor_id uuid := auth.uid();
    actor_role public.organization_role;
    current_intent public.business_intents;
    updated_intent public.business_intents;
    transition_allowed boolean := false;
BEGIN
    IF actor_id IS NULL THEN
        RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT i.*
      INTO current_intent
      FROM public.business_intents AS i
     WHERE i.id = p_intent_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'business intent not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT m.role
      INTO actor_role
      FROM public.organization_memberships AS m
     WHERE m.organization_id = current_intent.organization_id
       AND m.user_id = actor_id;

    IF actor_role IS NULL OR actor_role = 'viewer' THEN
        RAISE EXCEPTION 'intent transition is not permitted' USING ERRCODE = '42501';
    END IF;

    IF actor_role = 'member' AND current_intent.created_by IS DISTINCT FROM actor_id THEN
        RAISE EXCEPTION 'members may transition only intents they created' USING ERRCODE = '42501';
    END IF;

    IF p_target_lifecycle IN ('matched', 'introducing', 'expired') THEN
        RAISE EXCEPTION 'target lifecycle is process-owned' USING ERRCODE = '42501';
    END IF;

    transition_allowed := CASE current_intent.lifecycle
        WHEN 'draft' THEN p_target_lifecycle IN ('active', 'withdrawn')
        WHEN 'active' THEN p_target_lifecycle IN ('paused', 'fulfilled', 'withdrawn')
        WHEN 'paused' THEN p_target_lifecycle IN ('active', 'fulfilled', 'withdrawn')
        ELSE false
    END;

    IF NOT transition_allowed THEN
        RAISE EXCEPTION 'lifecycle transition from % to % is not permitted',
            current_intent.lifecycle, p_target_lifecycle
            USING ERRCODE = '22023';
    END IF;

    IF p_target_lifecycle = 'fulfilled' AND actor_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'only owner or admin may fulfill an intent' USING ERRCODE = '42501';
    END IF;

    UPDATE public.business_intents
       SET lifecycle = p_target_lifecycle
     WHERE id = current_intent.id
    RETURNING * INTO updated_intent;

    INSERT INTO public.organization_audit_log (
        organization_id,
        actor_user_id,
        action,
        subject_type,
        subject_id,
        details
    ) VALUES (
        updated_intent.organization_id,
        actor_id,
        'intent.status_changed',
        'business_intent',
        updated_intent.id,
        pg_catalog.jsonb_build_object(
            'from', current_intent.lifecycle::text,
            'to', updated_intent.lifecycle::text
        )
    );

    RETURN updated_intent;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_business_intent_v1(
    p_organization_id uuid,
    p_kind public.business_intent_kind,
    p_headline text,
    p_public_summary text,
    p_industry text,
    p_target_markets text[],
    p_visibility public.business_intent_visibility,
    p_initial_lifecycle public.business_intent_lifecycle DEFAULT 'draft',
    p_expires_at timestamptz DEFAULT NULL,
    p_private_brief text DEFAULT NULL
)
RETURNS public.business_intents
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT private.create_business_intent_v1(
        p_organization_id,
        p_kind,
        p_headline,
        p_public_summary,
        p_industry,
        p_target_markets,
        p_visibility,
        p_initial_lifecycle,
        p_expires_at,
        p_private_brief
    );
$$;

CREATE OR REPLACE FUNCTION public.transition_business_intent_v1(
    p_intent_id uuid,
    p_target_lifecycle public.business_intent_lifecycle
)
RETURNS public.business_intents
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT private.transition_business_intent_v1(p_intent_id, p_target_lifecycle);
$$;

REVOKE ALL ON FUNCTION private.create_business_intent_v1(
    uuid,
    public.business_intent_kind,
    text,
    text,
    text,
    text[],
    public.business_intent_visibility,
    public.business_intent_lifecycle,
    timestamptz,
    text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.transition_business_intent_v1(
    uuid,
    public.business_intent_lifecycle
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_business_intent_v1(
    uuid,
    public.business_intent_kind,
    text,
    text,
    text,
    text[],
    public.business_intent_visibility,
    public.business_intent_lifecycle,
    timestamptz,
    text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transition_business_intent_v1(
    uuid,
    public.business_intent_lifecycle
) FROM PUBLIC;

REVOKE INSERT, UPDATE, DELETE ON public.business_intents FROM app_user;
REVOKE INSERT, UPDATE, DELETE ON public.business_intent_secrets FROM app_user;

GRANT USAGE ON SCHEMA private TO app_user;
GRANT EXECUTE ON FUNCTION private.create_business_intent_v1(
    uuid,
    public.business_intent_kind,
    text,
    text,
    text,
    text[],
    public.business_intent_visibility,
    public.business_intent_lifecycle,
    timestamptz,
    text
) TO app_user;
GRANT EXECUTE ON FUNCTION private.transition_business_intent_v1(
    uuid,
    public.business_intent_lifecycle
) TO app_user;
GRANT EXECUTE ON FUNCTION public.create_business_intent_v1(
    uuid,
    public.business_intent_kind,
    text,
    text,
    text,
    text[],
    public.business_intent_visibility,
    public.business_intent_lifecycle,
    timestamptz,
    text
) TO app_user;
GRANT EXECUTE ON FUNCTION public.transition_business_intent_v1(
    uuid,
    public.business_intent_lifecycle
) TO app_user;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.business_intents FROM authenticated';
        EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.business_intent_secrets FROM authenticated';

        EXECUTE 'GRANT USAGE ON SCHEMA public TO authenticated';
        EXECUTE 'GRANT USAGE ON SCHEMA private TO authenticated';
        EXECUTE 'GRANT USAGE ON SCHEMA auth TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_organization_member(uuid) TO authenticated';
        EXECUTE 'GRANT USAGE ON TYPE public.business_intent_kind TO authenticated';
        EXECUTE 'GRANT USAGE ON TYPE public.business_intent_visibility TO authenticated';
        EXECUTE 'GRANT USAGE ON TYPE public.business_intent_lifecycle TO authenticated';
        EXECUTE 'GRANT SELECT ON public.business_intents TO authenticated';
        EXECUTE 'GRANT SELECT ON public.business_intent_secrets TO authenticated';
        EXECUTE 'GRANT SELECT ON public.organization_audit_log TO authenticated';

        EXECUTE 'GRANT EXECUTE ON FUNCTION private.create_business_intent_v1(uuid, public.business_intent_kind, text, text, text, text[], public.business_intent_visibility, public.business_intent_lifecycle, timestamptz, text) TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION private.transition_business_intent_v1(uuid, public.business_intent_lifecycle) TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.create_business_intent_v1(uuid, public.business_intent_kind, text, text, text, text[], public.business_intent_visibility, public.business_intent_lifecycle, timestamptz, text) TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.transition_business_intent_v1(uuid, public.business_intent_lifecycle) TO authenticated';

        EXECUTE 'DROP POLICY IF EXISTS business_intents_select_authenticated ON public.business_intents';
        EXECUTE $policy$
            CREATE POLICY business_intents_select_authenticated ON public.business_intents
            FOR SELECT TO authenticated
            USING (
                public.is_organization_member(organization_id)
                OR (
                    lifecycle = 'active'
                    AND visibility IN ('network', 'public')
                    AND (expires_at IS NULL OR expires_at > pg_catalog.now())
                )
            )
        $policy$;

        EXECUTE 'DROP POLICY IF EXISTS business_intent_secrets_select_authenticated ON public.business_intent_secrets';
        EXECUTE $policy$
            CREATE POLICY business_intent_secrets_select_authenticated ON public.business_intent_secrets
            FOR SELECT TO authenticated
            USING (public.is_organization_member(organization_id))
        $policy$;

        EXECUTE 'DROP POLICY IF EXISTS business_intent_audit_select_authenticated ON public.organization_audit_log';
        EXECUTE $policy$
            CREATE POLICY business_intent_audit_select_authenticated ON public.organization_audit_log
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
                'REVOKE ALL ON FUNCTION private.create_business_intent_v1(uuid, public.business_intent_kind, text, text, text, text[], public.business_intent_visibility, public.business_intent_lifecycle, timestamptz, text) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION private.transition_business_intent_v1(uuid, public.business_intent_lifecycle) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.create_business_intent_v1(uuid, public.business_intent_kind, text, text, text, text[], public.business_intent_visibility, public.business_intent_lifecycle, timestamptz, text) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.transition_business_intent_v1(uuid, public.business_intent_lifecycle) FROM %I',
                r
            );
        END IF;
    END LOOP;
END $$;
