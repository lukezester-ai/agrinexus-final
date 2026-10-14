-- Matching Engine v1 — deterministic, explainable, system-owned.
-- Reads only 006/007 match indexes. Writes candidate rows on 008.
-- Domain lifecycle (qualified / introduced / ...) is never set here.
-- Score is not LLM-generated.

ALTER TABLE public.business_opportunity_match_index
    ADD COLUMN IF NOT EXISTS source_type public.business_opportunity_source_type;

UPDATE public.business_opportunity_match_index idx
SET source_type = o.source_type
FROM public.business_opportunities o
WHERE o.id = idx.opportunity_id
  AND idx.source_type IS NULL;

CREATE OR REPLACE FUNCTION public.sync_business_opportunity_match_index()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.lifecycle = 'open'
       AND NEW.visibility IN ('confidential', 'network', 'public')
       AND (NEW.expires_at IS NULL OR NEW.expires_at > pg_catalog.now()) THEN
        INSERT INTO public.business_opportunity_match_index (
            opportunity_id, organization_id, industry, target_markets, visibility,
            expires_at, facets, source_type, updated_at
        ) VALUES (
            NEW.id,
            NEW.organization_id,
            NEW.industry,
            NEW.target_markets,
            NEW.visibility,
            NEW.expires_at,
            NEW.facets,
            NEW.source_type,
            pg_catalog.now()
        )
        ON CONFLICT (opportunity_id) DO UPDATE SET
            organization_id = EXCLUDED.organization_id,
            industry = EXCLUDED.industry,
            target_markets = EXCLUDED.target_markets,
            visibility = EXCLUDED.visibility,
            expires_at = EXCLUDED.expires_at,
            facets = EXCLUDED.facets,
            source_type = EXCLUDED.source_type,
            updated_at = pg_catalog.now();
    ELSE
        DELETE FROM public.business_opportunity_match_index WHERE opportunity_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.kind_compatible(
    intent_kind public.business_intent_kind,
    opportunity_kind text
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT CASE
        WHEN opportunity_kind IS NULL OR btrim(opportunity_kind) = '' THEN NULL
        WHEN intent_kind::text = 'buy' AND opportunity_kind IN ('sell', 'supply', 'distribute') THEN true
        WHEN intent_kind::text = 'sell' AND opportunity_kind IN ('buy') THEN true
        WHEN intent_kind::text = 'partner' AND opportunity_kind IN ('partner', 'seek_capability') THEN true
        WHEN intent_kind::text = 'invest' AND opportunity_kind IN ('invest') THEN true
        WHEN intent_kind::text = 'supply' AND opportunity_kind IN ('buy') THEN true
        WHEN intent_kind::text = 'distribute' AND opportunity_kind IN ('buy', 'sell') THEN true
        WHEN intent_kind::text = 'hire' AND opportunity_kind IN ('seek_capability') THEN true
        WHEN intent_kind::text = 'seek_capability' AND opportunity_kind IN ('hire', 'supply', 'partner') THEN true
        ELSE false
    END;
$$;

CREATE OR REPLACE FUNCTION public.run_matching_engine_v1()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    written bigint := 0;
    intent record;
    opp record;
    opp_kind text;
    kinds_ok boolean;
    industry_ok boolean;
    market_intersect int;
    market_union int;
    market_score numeric(8, 6);
    kind_score numeric(8, 6);
    industry_score numeric(8, 6);
    visibility_score numeric(8, 6) := 1;
    eligibility_score numeric(8, 6) := 1;
    source_score numeric(8, 6);
    total_score numeric(8, 6);
    conf numeric(8, 6);
    reasons jsonb;
    explanation text;
    engine_name text := 'deterministic-v1';
    engine_version text := '1';
BEGIN
    FOR intent IN
        SELECT i.intent_id, i.organization_id, i.kind, i.industry, i.target_markets, i.visibility, i.expires_at
        FROM public.business_intent_match_index AS i
    LOOP
        FOR opp IN
            SELECT
                o.opportunity_id,
                o.organization_id,
                o.industry,
                o.target_markets,
                o.visibility,
                o.expires_at,
                o.facets,
                o.source_type
            FROM public.business_opportunity_match_index AS o
        LOOP
            IF intent.organization_id IS NOT NULL
               AND opp.organization_id IS NOT NULL
               AND intent.organization_id = opp.organization_id THEN
                CONTINUE;
            END IF;

            opp_kind := NULLIF(btrim(opp.facets->>'kind'), '');
            kinds_ok := public.kind_compatible(intent.kind, opp_kind);
            IF kinds_ok IS FALSE THEN
                CONTINUE;
            END IF;

            kind_score := CASE
                WHEN kinds_ok IS TRUE THEN 1
                ELSE 0
            END;

            industry_ok := lower(btrim(intent.industry)) = lower(btrim(opp.industry));
            industry_score := CASE WHEN industry_ok THEN 1 ELSE 0 END;

            SELECT
                COALESCE(cardinality(ARRAY(SELECT unnest(intent.target_markets) INTERSECT SELECT unnest(opp.target_markets))), 0),
                COALESCE(cardinality(ARRAY(SELECT unnest(intent.target_markets) UNION SELECT unnest(opp.target_markets))), 0)
            INTO market_intersect, market_union;
            market_score := CASE
                WHEN market_union = 0 THEN 0
                ELSE round((market_intersect::numeric / market_union::numeric), 6)
            END;

            source_score := CASE
                WHEN opp.source_type IS NULL THEN 0
                ELSE 1
            END;

            IF kind_score = 0 AND industry_score = 0 AND market_score = 0 THEN
                CONTINUE;
            END IF;

            total_score := round(
                kind_score * 0.30
                + industry_score * 0.30
                + market_score * 0.25
                + visibility_score * 0.05
                + eligibility_score * 0.05
                + source_score * 0.05
            , 6);

            IF total_score < 0.35 THEN
                CONTINUE;
            END IF;

            conf := round((
                CASE WHEN kinds_ok IS TRUE THEN 0.20 ELSE 0 END
                + CASE WHEN industry_ok THEN 0.20 ELSE 0 END
                + CASE WHEN market_intersect > 0 THEN 0.20 ELSE 0 END
                + 0.20
                + CASE WHEN opp.source_type IS NOT NULL THEN 0.20 ELSE 0 END
            ), 6);

            reasons := pg_catalog.jsonb_build_array(
                pg_catalog.jsonb_build_object('code', 'kind_compatibility', 'weight', 0.30, 'ok', COALESCE(kinds_ok, false)),
                pg_catalog.jsonb_build_object('code', 'industry_match', 'weight', 0.30, 'ok', industry_ok),
                pg_catalog.jsonb_build_object('code', 'target_market_overlap', 'weight', 0.25, 'value', market_score),
                pg_catalog.jsonb_build_object('code', 'visibility_eligibility', 'weight', 0.05, 'ok', true),
                pg_catalog.jsonb_build_object('code', 'lifecycle_expiry_eligibility', 'weight', 0.05, 'ok', true),
                pg_catalog.jsonb_build_object('code', 'source_provenance_validity', 'weight', 0.05, 'ok', opp.source_type IS NOT NULL)
            );

            explanation := format(
                'deterministic-v1/1: kind=%s industry=%s markets=%s source=%s',
                CASE WHEN kinds_ok IS TRUE THEN 'compatible' WHEN kinds_ok IS FALSE THEN 'incompatible' ELSE 'unspecified' END,
                CASE WHEN industry_ok THEN 'match' ELSE 'mismatch' END,
                market_score::text,
                COALESCE(opp.source_type::text, 'unknown')
            );

            INSERT INTO public.business_matches (
                intent_id,
                opportunity_id,
                matcher_engine,
                matcher_version,
                score,
                confidence,
                reasons,
                explanation,
                lifecycle,
                provenance
            ) VALUES (
                intent.intent_id,
                opp.opportunity_id,
                engine_name,
                engine_version,
                total_score,
                conf,
                reasons,
                explanation,
                'candidate',
                pg_catalog.jsonb_build_object(
                    'recorded_at', pg_catalog.now(),
                    'matcher_engine', engine_name,
                    'matcher_version', engine_version,
                    'mode', 'deterministic'
                )
            )
            ON CONFLICT (intent_id, opportunity_id, matcher_engine, matcher_version) DO UPDATE SET
                score = EXCLUDED.score,
                confidence = EXCLUDED.confidence,
                reasons = EXCLUDED.reasons,
                explanation = EXCLUDED.explanation,
                provenance = EXCLUDED.provenance,
                updated_at = pg_catalog.now()
            WHERE public.business_matches.lifecycle = 'candidate';

            IF FOUND THEN
                written := written + 1;
            END IF;
        END LOOP;
    END LOOP;

    RETURN written;
END;
$$;

ALTER FUNCTION public.kind_compatible(public.business_intent_kind, text) OWNER TO postgres;
ALTER FUNCTION public.run_matching_engine_v1() OWNER TO intent_matcher;

REVOKE ALL ON FUNCTION public.kind_compatible(public.business_intent_kind, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_matching_engine_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_matching_engine_v1() FROM app_user;
REVOKE ALL ON FUNCTION public.kind_compatible(public.business_intent_kind, text) FROM app_user;

GRANT EXECUTE ON FUNCTION public.kind_compatible(public.business_intent_kind, text) TO intent_matcher;
GRANT EXECUTE ON FUNCTION public.run_matching_engine_v1() TO intent_matcher;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON FUNCTION public.run_matching_engine_v1() FROM %I', r);
            EXECUTE format('REVOKE ALL ON FUNCTION public.kind_compatible(public.business_intent_kind, text) FROM %I', r);
        END IF;
    END LOOP;
END $$;
