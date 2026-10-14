-- Matching Engine v1 production boundary.
-- Aligns Supabase `authenticated` with the validated app_user model and
-- exposes only the system-owned matcher entry point to service_role.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        RETURN;
    END IF;

    GRANT USAGE ON SCHEMA public TO authenticated;
    GRANT EXECUTE ON FUNCTION public.is_organization_member(uuid) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.can_write_organization(uuid) TO authenticated;

    GRANT USAGE ON TYPE public.business_opportunity_source_type TO authenticated;
    GRANT USAGE ON TYPE public.business_opportunity_visibility TO authenticated;
    GRANT USAGE ON TYPE public.business_opportunity_lifecycle TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_opportunities TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_opportunity_secrets TO authenticated;

    DROP POLICY IF EXISTS business_opportunities_select_authenticated ON public.business_opportunities;
    CREATE POLICY business_opportunities_select_authenticated ON public.business_opportunities
    FOR SELECT TO authenticated
    USING (
        (organization_id IS NOT NULL AND public.is_organization_member(organization_id))
        OR (
            lifecycle = 'open'
            AND visibility IN ('network', 'public')
            AND (expires_at IS NULL OR expires_at > pg_catalog.now())
        )
    );

    DROP POLICY IF EXISTS business_opportunities_insert_authenticated ON public.business_opportunities;
    CREATE POLICY business_opportunities_insert_authenticated ON public.business_opportunities
    FOR INSERT TO authenticated
    WITH CHECK (
        source_type = 'manual'
        AND organization_id IS NOT NULL
        AND public.can_write_organization(organization_id)
        AND created_by = auth.uid()
    );

    DROP POLICY IF EXISTS business_opportunities_update_authenticated ON public.business_opportunities;
    CREATE POLICY business_opportunities_update_authenticated ON public.business_opportunities
    FOR UPDATE TO authenticated
    USING (organization_id IS NOT NULL AND public.can_write_organization(organization_id))
    WITH CHECK (organization_id IS NOT NULL AND public.can_write_organization(organization_id));

    DROP POLICY IF EXISTS business_opportunities_delete_authenticated ON public.business_opportunities;
    CREATE POLICY business_opportunities_delete_authenticated ON public.business_opportunities
    FOR DELETE TO authenticated
    USING (organization_id IS NOT NULL AND public.can_write_organization(organization_id));

    DROP POLICY IF EXISTS business_opportunity_secrets_authenticated ON public.business_opportunity_secrets;
    CREATE POLICY business_opportunity_secrets_authenticated ON public.business_opportunity_secrets
    FOR ALL TO authenticated
    USING (public.is_organization_member(organization_id))
    WITH CHECK (public.can_write_organization(organization_id));

    GRANT USAGE ON TYPE public.business_match_lifecycle TO authenticated;
    GRANT SELECT ON public.business_matches TO authenticated;
    REVOKE INSERT, UPDATE, DELETE ON public.business_matches FROM authenticated;

    DROP POLICY IF EXISTS business_matches_select_authenticated ON public.business_matches;
    CREATE POLICY business_matches_select_authenticated ON public.business_matches
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_intents i
            WHERE i.id = intent_id
              AND public.is_organization_member(i.organization_id)
        )
        OR EXISTS (
            SELECT 1 FROM public.business_opportunities o
            WHERE o.id = opportunity_id
              AND o.organization_id IS NOT NULL
              AND public.is_organization_member(o.organization_id)
        )
    );

    GRANT USAGE ON TYPE public.business_match_introduction_status TO authenticated;
    GRANT USAGE ON TYPE public.business_match_event_kind TO authenticated;
    GRANT SELECT ON public.business_match_introductions TO authenticated;
    GRANT SELECT ON public.business_match_events TO authenticated;
    REVOKE INSERT, UPDATE, DELETE ON public.business_match_introductions FROM authenticated;
    REVOKE INSERT, UPDATE, DELETE ON public.business_match_events FROM authenticated;

    DROP POLICY IF EXISTS business_match_introductions_select_authenticated ON public.business_match_introductions;
    CREATE POLICY business_match_introductions_select_authenticated ON public.business_match_introductions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.business_matches m
            JOIN public.business_intents i ON i.id = m.intent_id
            WHERE m.id = match_id
              AND public.is_organization_member(i.organization_id)
        )
        OR (
            status = 'accepted'
            AND EXISTS (
                SELECT 1
                FROM public.business_matches m
                JOIN public.business_opportunities o ON o.id = m.opportunity_id
                WHERE m.id = match_id
                  AND o.organization_id IS NOT NULL
                  AND public.is_organization_member(o.organization_id)
            )
        )
        OR EXISTS (
            SELECT 1
            FROM public.business_matches m
            JOIN public.business_intents i ON i.id = m.intent_id
            JOIN public.business_opportunities o ON o.id = m.opportunity_id
            WHERE m.id = match_id
              AND i.visibility IN ('network', 'public')
              AND o.organization_id IS NOT NULL
              AND public.is_organization_member(o.organization_id)
        )
    );

    DROP POLICY IF EXISTS business_match_events_select_authenticated ON public.business_match_events;
    CREATE POLICY business_match_events_select_authenticated ON public.business_match_events
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.business_matches m
            JOIN public.business_intents i ON i.id = m.intent_id
            WHERE m.id = match_id
              AND public.is_organization_member(i.organization_id)
        )
        OR (
            kind IN ('match_created', 'lifecycle_changed')
            AND EXISTS (
                SELECT 1
                FROM public.business_matches m
                JOIN public.business_opportunities o ON o.id = m.opportunity_id
                WHERE m.id = match_id
                  AND o.organization_id IS NOT NULL
                  AND public.is_organization_member(o.organization_id)
            )
        )
        OR EXISTS (
            SELECT 1
            FROM public.business_matches m
            JOIN public.business_opportunities o ON o.id = m.opportunity_id
            WHERE m.id = match_id
              AND m.lifecycle IN ('introduced', 'converted')
              AND o.organization_id IS NOT NULL
              AND public.is_organization_member(o.organization_id)
        )
    );

    GRANT EXECUTE ON FUNCTION public.qualify_business_match(uuid) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.dismiss_business_match(uuid) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.request_business_match_introduction(uuid, text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.respond_business_match_introduction(uuid, boolean, text) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.reveal_match_parties(uuid) TO authenticated;

    GRANT USAGE ON TYPE public.business_relationship_status TO authenticated;
    GRANT USAGE ON TYPE public.business_relationship_kind TO authenticated;
    GRANT USAGE ON TYPE public.business_relationship_event_kind TO authenticated;
    GRANT SELECT ON public.business_relationships TO authenticated;
    GRANT SELECT ON public.business_relationship_events TO authenticated;
    REVOKE INSERT, UPDATE, DELETE ON public.business_relationships FROM authenticated;
    REVOKE INSERT, UPDATE, DELETE ON public.business_relationship_events FROM authenticated;

    DROP POLICY IF EXISTS business_relationships_select_authenticated ON public.business_relationships;
    CREATE POLICY business_relationships_select_authenticated ON public.business_relationships
    FOR SELECT TO authenticated
    USING (
        public.is_organization_member(organization_a)
        OR public.is_organization_member(organization_b)
    );

    DROP POLICY IF EXISTS business_relationship_events_select_authenticated ON public.business_relationship_events;
    CREATE POLICY business_relationship_events_select_authenticated ON public.business_relationship_events
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.business_relationships r
            WHERE r.id = relationship_id
              AND (
                  public.is_organization_member(r.organization_a)
                  OR public.is_organization_member(r.organization_b)
              )
        )
    );

    GRANT EXECUTE ON FUNCTION public.touch_business_relationship(uuid) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.pause_business_relationship(uuid) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.resume_business_relationship(uuid) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.close_business_relationship(uuid) TO authenticated;

    GRANT EXECUTE ON FUNCTION public.radar_party_organization_name(uuid) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.business_radar_summary() TO authenticated;
    GRANT SELECT ON public.business_radar_items TO authenticated;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION public.run_matching_engine_v1() TO service_role;
    END IF;
END $$;

REVOKE ALL ON FUNCTION public.run_matching_engine_v1() FROM PUBLIC;
DO $$
DECLARE
    role_name text;
BEGIN
    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.run_matching_engine_v1() FROM %I',
                role_name
            );
        END IF;
    END LOOP;
END $$;
