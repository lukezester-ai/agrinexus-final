-- Organization Skill Engine v1 command boundary.
-- Mutations are transaction-owned RPCs; direct client inserts are not permitted.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;

-- Roles allowed to author and transition skills: owner, admin, member.
-- `viewer` is read-only, mirroring the intent command boundary.

CREATE OR REPLACE FUNCTION private.create_organization_skill_v1(
    p_organization_id uuid,
    p_name text,
    p_description text,
    p_when_to_use text,
    p_steps jsonb,
    p_guardrails text[],
    p_initial_status public.organization_skill_status DEFAULT 'draft',
    p_source_text text DEFAULT ''
)
RETURNS public.organization_skills
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    actor_id uuid := auth.uid();
    actor_role public.organization_role;
    created_skill public.organization_skills;
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
        RAISE EXCEPTION 'skill creation is not permitted' USING ERRCODE = '42501';
    END IF;

    IF p_initial_status NOT IN ('draft', 'active') THEN
        RAISE EXCEPTION 'initial status must be draft or active' USING ERRCODE = '22023';
    END IF;

    IF NULLIF(btrim(COALESCE(p_name, '')), '') IS NULL THEN
        RAISE EXCEPTION 'skill name is required' USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.organization_skills (
        organization_id,
        created_by,
        name,
        description,
        when_to_use,
        steps,
        guardrails,
        status,
        source_text
    ) VALUES (
        p_organization_id,
        actor_id,
        btrim(p_name),
        COALESCE(p_description, ''),
        COALESCE(p_when_to_use, ''),
        COALESCE(p_steps, '[]'::jsonb),
        COALESCE(p_guardrails, '{}'::text[]),
        p_initial_status,
        COALESCE(p_source_text, '')
    )
    RETURNING * INTO created_skill;

    INSERT INTO public.organization_audit_log (
        organization_id,
        actor_user_id,
        action,
        subject_type,
        subject_id,
        details
    ) VALUES (
        created_skill.organization_id,
        actor_id,
        'skill.created',
        'organization_skill',
        created_skill.id,
        pg_catalog.jsonb_build_object(
            'status', created_skill.status::text,
            'steps', pg_catalog.jsonb_array_length(created_skill.steps),
            'authored_by_ai', created_skill.source_text <> ''
        )
    );

    RETURN created_skill;
END;
$$;

CREATE OR REPLACE FUNCTION private.transition_organization_skill_v1(
    p_skill_id uuid,
    p_target_status public.organization_skill_status
)
RETURNS public.organization_skills
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    actor_id uuid := auth.uid();
    actor_role public.organization_role;
    current_skill public.organization_skills;
    updated_skill public.organization_skills;
    transition_allowed boolean := false;
BEGIN
    IF actor_id IS NULL THEN
        RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT s.*
      INTO current_skill
      FROM public.organization_skills AS s
     WHERE s.id = p_skill_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'skill not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT m.role
      INTO actor_role
      FROM public.organization_memberships AS m
     WHERE m.organization_id = current_skill.organization_id
       AND m.user_id = actor_id;

    IF actor_role IS NULL OR actor_role = 'viewer' THEN
        RAISE EXCEPTION 'skill transition is not permitted' USING ERRCODE = '42501';
    END IF;

    IF actor_role = 'member' AND current_skill.created_by IS DISTINCT FROM actor_id THEN
        RAISE EXCEPTION 'members may transition only skills they created' USING ERRCODE = '42501';
    END IF;

    transition_allowed := CASE current_skill.status
        WHEN 'draft' THEN p_target_status IN ('active', 'archived')
        WHEN 'active' THEN p_target_status IN ('archived')
        ELSE false
    END;

    IF NOT transition_allowed THEN
        RAISE EXCEPTION 'status transition from % to % is not permitted',
            current_skill.status, p_target_status
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.organization_skills
       SET status = p_target_status
     WHERE id = current_skill.id
    RETURNING * INTO updated_skill;

    INSERT INTO public.organization_audit_log (
        organization_id,
        actor_user_id,
        action,
        subject_type,
        subject_id,
        details
    ) VALUES (
        updated_skill.organization_id,
        actor_id,
        'skill.status_changed',
        'organization_skill',
        updated_skill.id,
        pg_catalog.jsonb_build_object(
            'from', current_skill.status::text,
            'to', updated_skill.status::text
        )
    );

    RETURN updated_skill;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_organization_skill_v1(
    p_organization_id uuid,
    p_name text,
    p_description text,
    p_when_to_use text,
    p_steps jsonb,
    p_guardrails text[],
    p_initial_status public.organization_skill_status DEFAULT 'draft',
    p_source_text text DEFAULT ''
)
RETURNS public.organization_skills
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT private.create_organization_skill_v1(
        p_organization_id,
        p_name,
        p_description,
        p_when_to_use,
        p_steps,
        p_guardrails,
        p_initial_status,
        p_source_text
    );
$$;

CREATE OR REPLACE FUNCTION public.transition_organization_skill_v1(
    p_skill_id uuid,
    p_target_status public.organization_skill_status
)
RETURNS public.organization_skills
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT private.transition_organization_skill_v1(p_skill_id, p_target_status);
$$;

REVOKE ALL ON FUNCTION private.create_organization_skill_v1(
    uuid, text, text, text, jsonb, text[], public.organization_skill_status, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.transition_organization_skill_v1(
    uuid, public.organization_skill_status
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_organization_skill_v1(
    uuid, text, text, text, jsonb, text[], public.organization_skill_status, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.transition_organization_skill_v1(
    uuid, public.organization_skill_status
) FROM PUBLIC;

-- Direct client inserts stay impossible: the audit event must exist in the same transaction.
REVOKE INSERT ON public.organization_skills FROM app_user;

GRANT USAGE ON SCHEMA private TO app_user;
GRANT EXECUTE ON FUNCTION private.create_organization_skill_v1(
    uuid, text, text, text, jsonb, text[], public.organization_skill_status, text
) TO app_user;
GRANT EXECUTE ON FUNCTION private.transition_organization_skill_v1(
    uuid, public.organization_skill_status
) TO app_user;
GRANT EXECUTE ON FUNCTION public.create_organization_skill_v1(
    uuid, text, text, text, jsonb, text[], public.organization_skill_status, text
) TO app_user;
GRANT EXECUTE ON FUNCTION public.transition_organization_skill_v1(
    uuid, public.organization_skill_status
) TO app_user;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'REVOKE INSERT ON public.organization_skills FROM authenticated';

        EXECUTE 'GRANT USAGE ON SCHEMA private TO authenticated';
        EXECUTE 'GRANT USAGE ON SCHEMA auth TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.is_organization_member(uuid) TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.can_write_organization(uuid) TO authenticated';

        EXECUTE 'GRANT EXECUTE ON FUNCTION private.create_organization_skill_v1(uuid, text, text, text, jsonb, text[], public.organization_skill_status, text) TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION private.transition_organization_skill_v1(uuid, public.organization_skill_status) TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.create_organization_skill_v1(uuid, text, text, text, jsonb, text[], public.organization_skill_status, text) TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.transition_organization_skill_v1(uuid, public.organization_skill_status) TO authenticated';

        EXECUTE 'DROP POLICY IF EXISTS organization_skill_audit_select_authenticated ON public.organization_audit_log';
        EXECUTE $policy$
            CREATE POLICY organization_skill_audit_select_authenticated ON public.organization_audit_log
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
                'REVOKE ALL ON FUNCTION private.create_organization_skill_v1(uuid, text, text, text, jsonb, text[], public.organization_skill_status, text) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION private.transition_organization_skill_v1(uuid, public.organization_skill_status) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.create_organization_skill_v1(uuid, text, text, text, jsonb, text[], public.organization_skill_status, text) FROM %I',
                r
            );
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.transition_organization_skill_v1(uuid, public.organization_skill_status) FROM %I',
                r
            );
        END IF;
    END LOOP;
END $$;
