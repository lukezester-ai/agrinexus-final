-- B2B DB retirement. Leaves 001-005 in place and does not edit 006-013.
--
-- Order follows the catalog graph of a disposable 001-013 database:
--   Core -> B2B = 0
--   business_relationships.origin_match_id -> business_matches ON DELETE RESTRICT
--   plpgsql functions have no pg_depend edge to tables, so each function is named
--   matching_jobs has no RLS and no policy; it is dropped, not given one
--   intent_matcher owns only run_matching_engine_v1() and cannot log in
--   three service_role policies are removed; the service_role role is not
--
-- Apply as a superuser. Local postgres cannot drop a function owned by intent_matcher.

DROP POLICY IF EXISTS business_intents_select ON public.business_intents;
DROP POLICY IF EXISTS business_intents_insert ON public.business_intents;
DROP POLICY IF EXISTS business_intents_update ON public.business_intents;
DROP POLICY IF EXISTS business_intents_delete ON public.business_intents;
DROP POLICY IF EXISTS business_intent_secrets_member ON public.business_intent_secrets;
DROP POLICY IF EXISTS business_intent_match_index_matcher ON public.business_intent_match_index;
DROP POLICY IF EXISTS business_intent_match_index_service ON public.business_intent_match_index;
DROP POLICY IF EXISTS business_opportunities_select ON public.business_opportunities;
DROP POLICY IF EXISTS business_opportunities_insert ON public.business_opportunities;
DROP POLICY IF EXISTS business_opportunities_update ON public.business_opportunities;
DROP POLICY IF EXISTS business_opportunities_delete ON public.business_opportunities;
DROP POLICY IF EXISTS business_opportunity_secrets_member ON public.business_opportunity_secrets;
DROP POLICY IF EXISTS business_opportunity_match_index_matcher ON public.business_opportunity_match_index;
DROP POLICY IF EXISTS business_opportunity_match_index_service ON public.business_opportunity_match_index;
DROP POLICY IF EXISTS business_matches_select ON public.business_matches;
DROP POLICY IF EXISTS business_matches_update_lifecycle ON public.business_matches;
DROP POLICY IF EXISTS business_matches_matcher ON public.business_matches;
DROP POLICY IF EXISTS business_matches_service ON public.business_matches;
DROP POLICY IF EXISTS business_match_introductions_select ON public.business_match_introductions;
DROP POLICY IF EXISTS business_match_events_select ON public.business_match_events;
DROP POLICY IF EXISTS business_relationships_select ON public.business_relationships;
DROP POLICY IF EXISTS business_relationship_events_select ON public.business_relationship_events;

DROP TRIGGER IF EXISTS trg_business_intent_match_index ON public.business_intents;
DROP TRIGGER IF EXISTS trg_business_intent_touch ON public.business_intents;
DROP TRIGGER IF EXISTS trg_business_intent_secret_org ON public.business_intent_secrets;
DROP TRIGGER IF EXISTS trg_enqueue_matching_job_intent_ins ON public.business_intents;
DROP TRIGGER IF EXISTS trg_enqueue_matching_job_intent_upd ON public.business_intents;
DROP TRIGGER IF EXISTS trg_business_opportunity_match_index ON public.business_opportunities;
DROP TRIGGER IF EXISTS trg_business_opportunity_touch ON public.business_opportunities;
DROP TRIGGER IF EXISTS trg_business_opportunity_secret_org ON public.business_opportunity_secrets;
DROP TRIGGER IF EXISTS trg_enqueue_matching_job_opportunity_ins ON public.business_opportunities;
DROP TRIGGER IF EXISTS trg_enqueue_matching_job_opportunity_upd ON public.business_opportunities;
DROP TRIGGER IF EXISTS trg_business_match_guard ON public.business_matches;
DROP TRIGGER IF EXISTS trg_business_match_audit ON public.business_matches;
DROP TRIGGER IF EXISTS trg_business_match_open_relationship ON public.business_matches;
DROP TRIGGER IF EXISTS trg_business_match_introduction_audit ON public.business_match_introductions;

DROP VIEW IF EXISTS public.business_radar_items;

DROP FUNCTION IF EXISTS public.sync_business_intent_match_index();
DROP FUNCTION IF EXISTS public.tg_business_intent_touch();
DROP FUNCTION IF EXISTS public.tg_business_intent_secret_org();
DROP FUNCTION IF EXISTS public.sync_business_opportunity_match_index();
DROP FUNCTION IF EXISTS public.tg_business_opportunity_touch();
DROP FUNCTION IF EXISTS public.tg_business_opportunity_secret_org();
DROP FUNCTION IF EXISTS public.tg_business_match_guard();
DROP FUNCTION IF EXISTS public.kind_compatible(public.business_intent_kind, text);
DROP FUNCTION IF EXISTS public.run_matching_engine_v1();
DROP FUNCTION IF EXISTS public.tg_business_match_audit();
DROP FUNCTION IF EXISTS public.tg_business_match_introduction_audit();
DROP FUNCTION IF EXISTS public.qualify_business_match(uuid);
DROP FUNCTION IF EXISTS public.dismiss_business_match(uuid);
DROP FUNCTION IF EXISTS public.request_business_match_introduction(uuid, text);
DROP FUNCTION IF EXISTS public.respond_business_match_introduction(uuid, boolean, text);
DROP FUNCTION IF EXISTS public.reveal_match_parties(uuid);
DROP FUNCTION IF EXISTS public.ensure_business_relationship_from_match(uuid);
DROP FUNCTION IF EXISTS public.tg_business_match_open_relationship();
DROP FUNCTION IF EXISTS public._assert_relationship_writer(uuid);
DROP FUNCTION IF EXISTS public.touch_business_relationship(uuid);
DROP FUNCTION IF EXISTS public.pause_business_relationship(uuid);
DROP FUNCTION IF EXISTS public.resume_business_relationship(uuid);
DROP FUNCTION IF EXISTS public.close_business_relationship(uuid);
DROP FUNCTION IF EXISTS public.radar_party_organization_name(uuid);
DROP FUNCTION IF EXISTS public.business_radar_summary();
DROP FUNCTION IF EXISTS public.enqueue_matching_job(public.matching_job_entity_type, uuid, text);
DROP FUNCTION IF EXISTS public.tg_enqueue_matching_job_intent();
DROP FUNCTION IF EXISTS public.tg_enqueue_matching_job_opportunity();

DROP INDEX IF EXISTS public.idx_business_intents_org;
DROP INDEX IF EXISTS public.idx_business_intents_match_scan;
DROP INDEX IF EXISTS public.idx_business_opportunities_org;
DROP INDEX IF EXISTS public.idx_business_opportunities_match_scan;
DROP INDEX IF EXISTS public.idx_business_matches_intent;
DROP INDEX IF EXISTS public.idx_business_matches_opportunity;
DROP INDEX IF EXISTS public.idx_business_match_events_match;
DROP INDEX IF EXISTS public.idx_business_relationships_org_a;
DROP INDEX IF EXISTS public.idx_business_relationships_org_b;
DROP INDEX IF EXISTS public.idx_business_relationships_origin_match;
DROP INDEX IF EXISTS public.idx_business_relationship_events_rel;
DROP INDEX IF EXISTS public.idx_matching_jobs_claim;
DROP INDEX IF EXISTS public.idx_matching_jobs_pending_entity;

-- Relationships before matches: origin_match_id is ON DELETE RESTRICT.
DROP TABLE IF EXISTS public.business_relationship_events;
DROP TABLE IF EXISTS public.business_relationships;
DROP TABLE IF EXISTS public.business_match_events;
DROP TABLE IF EXISTS public.business_match_introductions;
DROP TABLE IF EXISTS public.matching_jobs;
DROP TABLE IF EXISTS public.business_matches;
DROP TABLE IF EXISTS public.business_intent_secrets;
DROP TABLE IF EXISTS public.business_intent_match_index;
DROP TABLE IF EXISTS public.business_opportunity_secrets;
DROP TABLE IF EXISTS public.business_opportunity_match_index;
DROP TABLE IF EXISTS public.business_intents;
DROP TABLE IF EXISTS public.business_opportunities;

DROP TYPE IF EXISTS public.business_intent_kind;
DROP TYPE IF EXISTS public.business_intent_visibility;
DROP TYPE IF EXISTS public.business_intent_lifecycle;
DROP TYPE IF EXISTS public.business_opportunity_source_type;
DROP TYPE IF EXISTS public.business_opportunity_visibility;
DROP TYPE IF EXISTS public.business_opportunity_lifecycle;
DROP TYPE IF EXISTS public.business_match_lifecycle;
DROP TYPE IF EXISTS public.business_match_introduction_status;
DROP TYPE IF EXISTS public.business_match_event_kind;
DROP TYPE IF EXISTS public.business_relationship_status;
DROP TYPE IF EXISTS public.business_relationship_kind;
DROP TYPE IF EXISTS public.business_relationship_event_kind;
DROP TYPE IF EXISTS public.matching_job_entity_type;
DROP TYPE IF EXISTS public.matching_job_status;

REVOKE ALL PRIVILEGES ON SCHEMA public FROM intent_matcher;
DROP ROLE IF EXISTS intent_matcher;
