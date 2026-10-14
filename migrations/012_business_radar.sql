-- Business Radar v1 — operational read model over frozen 006–011.
-- Not a transactional domain. No lifecycle writes. No new score.
-- Visibility is never wider than the source row: invoker RLS on matches,
-- introductions, relationships, intents, and opportunities. Counterpart
-- identity is added only after an introduced relationship exists.

CREATE OR REPLACE FUNCTION public.radar_party_organization_name(p_organization_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT o.name
    FROM public.organizations o
    WHERE o.id = p_organization_id
      AND (
          public.is_organization_member(p_organization_id)
          OR EXISTS (
              SELECT 1
              FROM public.business_relationships r
              WHERE (r.organization_a = p_organization_id OR r.organization_b = p_organization_id)
                AND (
                    public.is_organization_member(r.organization_a)
                    OR public.is_organization_member(r.organization_b)
                )
          )
      );
$$;

CREATE OR REPLACE FUNCTION public.business_radar_summary()
RETURNS TABLE (
    candidate_matches bigint,
    qualified_matches bigint,
    pending_introductions bigint,
    active_relationships bigint,
    open_opportunities bigint
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT
        (SELECT count(*) FROM public.business_matches WHERE lifecycle = 'candidate'),
        (SELECT count(*) FROM public.business_matches WHERE lifecycle = 'qualified'),
        (SELECT count(*) FROM public.business_match_introductions WHERE status = 'requested'),
        (SELECT count(*) FROM public.business_relationships WHERE status = 'active'),
        (SELECT count(*) FROM public.business_opportunities WHERE lifecycle = 'open');
$$;

CREATE OR REPLACE VIEW public.business_radar_items
WITH (security_invoker = true) AS
SELECT
    'candidate_match'::text AS item_kind,
    m.id AS item_id,
    m.updated_at,
    m.score,
    m.lifecycle::text AS status,
    COALESCE(
        CASE WHEN i.id IS NOT NULL THEN i.headline END,
        CASE WHEN o.id IS NOT NULL THEN o.title END
    ) AS safe_title,
    COALESCE(
        CASE WHEN i.id IS NOT NULL THEN i.public_summary END,
        CASE WHEN o.id IS NOT NULL THEN o.summary END
    ) AS safe_summary,
    NULL::uuid AS organization_a,
    NULL::uuid AS organization_b,
    NULL::text AS organization_a_name,
    NULL::text AS organization_b_name
FROM public.business_matches m
LEFT JOIN public.business_intents i ON i.id = m.intent_id
LEFT JOIN public.business_opportunities o ON o.id = m.opportunity_id
WHERE m.lifecycle = 'candidate'

UNION ALL
SELECT
    'qualified_match',
    m.id,
    m.updated_at,
    m.score,
    m.lifecycle::text,
    COALESCE(
        CASE WHEN i.id IS NOT NULL THEN i.headline END,
        CASE WHEN o.id IS NOT NULL THEN o.title END
    ),
    COALESCE(
        CASE WHEN i.id IS NOT NULL THEN i.public_summary END,
        CASE WHEN o.id IS NOT NULL THEN o.summary END
    ),
    NULL::uuid,
    NULL::uuid,
    NULL::text,
    NULL::text
FROM public.business_matches m
LEFT JOIN public.business_intents i ON i.id = m.intent_id
LEFT JOIN public.business_opportunities o ON o.id = m.opportunity_id
WHERE m.lifecycle = 'qualified'

UNION ALL
SELECT
    'pending_introduction',
    intro.id,
    intro.requested_at,
    m.score,
    intro.status::text,
    COALESCE(
        CASE WHEN i.id IS NOT NULL THEN i.headline END,
        CASE WHEN o.id IS NOT NULL THEN o.title END
    ),
    COALESCE(
        CASE WHEN i.id IS NOT NULL THEN i.public_summary END,
        CASE WHEN o.id IS NOT NULL THEN o.summary END
    ),
    NULL::uuid,
    NULL::uuid,
    NULL::text,
    NULL::text
FROM public.business_match_introductions intro
JOIN public.business_matches m ON m.id = intro.match_id
LEFT JOIN public.business_intents i ON i.id = m.intent_id
LEFT JOIN public.business_opportunities o ON o.id = m.opportunity_id
WHERE intro.status = 'requested'

UNION ALL
SELECT
    'relationship',
    r.id,
    r.last_interaction_at,
    NULL::numeric,
    r.status::text,
    NULL::text,
    NULL::text,
    r.organization_a,
    r.organization_b,
    public.radar_party_organization_name(r.organization_a),
    public.radar_party_organization_name(r.organization_b)
FROM public.business_relationships r
WHERE r.status IN ('active', 'paused')

UNION ALL
SELECT
    'open_opportunity',
    o.id,
    o.updated_at,
    NULL::numeric,
    o.lifecycle::text,
    o.title,
    o.summary,
    o.organization_id,
    NULL::uuid,
    CASE
        WHEN o.organization_id IS NOT NULL AND public.is_organization_member(o.organization_id)
            THEN (SELECT name FROM public.organizations WHERE id = o.organization_id)
        ELSE NULL
    END,
    NULL::text
FROM public.business_opportunities o
WHERE o.lifecycle = 'open';

REVOKE ALL ON FUNCTION public.radar_party_organization_name(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.radar_party_organization_name(uuid) TO app_user;
REVOKE ALL ON FUNCTION public.business_radar_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.business_radar_summary() TO app_user;

REVOKE ALL ON public.business_radar_items FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.business_radar_items FROM app_user;
GRANT SELECT ON public.business_radar_items TO app_user;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON public.business_radar_items FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.radar_party_organization_name(uuid) FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.business_radar_summary() FROM %I', r);
        END IF;
    END LOOP;
END $$;
