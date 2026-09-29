-- Broker / live boundary gate 2. Does not alter 001-005 and does not recreate 006-028.
-- Recheck compares a stored order intent with the current evaluation and policy.
-- It does not calculate risk, authorize a send, or leave the system.

CREATE OR REPLACE FUNCTION public.finance_recheck_order_intent(p_intent_id uuid) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    intent_org uuid;
    intent_book uuid;
    intent_evaluation text;
    intent_digest text;
    current_evaluation text;
    accepted boolean;
    evaluation_policy text;
    current_policy text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'auth.uid() is required';
    END IF;
    SELECT intents.organization_id, intents.book_id, intents.intent->>'evaluation_digest', intents.intent_digest
    INTO intent_org, intent_book, intent_evaluation, intent_digest
    FROM public.finance_order_intents intents
    WHERE intents.id = p_intent_id;
    IF intent_org IS NULL OR intent_book IS NULL OR intent_evaluation IS NULL THEN
        RAISE EXCEPTION 'order intent not found';
    END IF;
    IF NOT public.can_write_organization(intent_org) THEN
        RAISE EXCEPTION 'not an organization writer';
    END IF;
    SELECT evaluations.evaluation_digest, evaluations.accepted,
           evaluations.policy_digest, policies.policy_digest
    INTO current_evaluation, accepted, evaluation_policy, current_policy
    FROM public.finance_risk_evaluations evaluations
    JOIN public.finance_risk_policies policies ON policies.id = evaluations.policy_id
    WHERE evaluations.book_id = intent_book
      AND evaluations.organization_id = intent_org
    ORDER BY evaluations.created_at DESC, evaluations.ctid DESC
    LIMIT 1;
    IF intent_evaluation IS DISTINCT FROM current_evaluation
        OR accepted IS NOT TRUE
        OR evaluation_policy IS DISTINCT FROM current_policy THEN
        RAISE EXCEPTION 'order intent does not match';
    END IF;
    PERFORM public.finance_audit(
        intent_org,
        'order_intent.rechecked',
        'finance_order_intent',
        p_intent_id,
        jsonb_build_object('intent_digest', intent_digest, 'evaluation_digest', current_evaluation)
    );
    RETURN p_intent_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finance_recheck_order_intent(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finance_recheck_order_intent(uuid) TO app_user;

DO $$
DECLARE
    r text;
BEGIN
    FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format(
                'REVOKE ALL ON FUNCTION public.finance_recheck_order_intent(uuid) FROM %I',
                r
            );
        END IF;
    END LOOP;
END $$;
