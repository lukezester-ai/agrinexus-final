-- Notification / Return Loop v1.
-- Actionable inbox derived from existing domain state; no copied business payloads.

CREATE TABLE IF NOT EXISTS public.business_notification_receipts (
    user_id uuid NOT NULL,
    item_kind text NOT NULL,
    item_id uuid NOT NULL,
    item_updated_at timestamptz NOT NULL,
    read_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
    PRIMARY KEY (user_id, item_kind, item_id, item_updated_at),
    CONSTRAINT business_notification_receipts_kind
        CHECK (item_kind IN ('candidate_match', 'qualified_match', 'pending_introduction'))
);

ALTER TABLE public.business_notification_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_notification_receipts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_notification_receipts_select ON public.business_notification_receipts;
CREATE POLICY business_notification_receipts_select
ON public.business_notification_receipts FOR SELECT TO app_user
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.business_return_loop_items()
RETURNS TABLE (
    item_kind text,
    item_id uuid,
    item_updated_at timestamptz,
    safe_title text,
    safe_summary text,
    status text,
    is_unread boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    WITH actionable AS (
        SELECT
            i.*,
            CASE
                WHEN i.item_kind = 'pending_introduction' THEN intro.match_id
                ELSE i.item_id
            END AS match_id
        FROM public.business_radar_items i
        LEFT JOIN public.business_match_introductions intro
          ON i.item_kind = 'pending_introduction' AND intro.id = i.item_id
        WHERE i.item_kind IN ('candidate_match', 'qualified_match', 'pending_introduction')
    ), permitted AS (
        SELECT a.*
        FROM actionable a
        CROSS JOIN LATERAL public.business_match_capabilities(ARRAY[a.match_id]) c
        WHERE (a.item_kind = 'candidate_match' AND c.can_qualify)
           OR (a.item_kind = 'qualified_match' AND (c.can_request_introduction OR c.can_respond_introduction))
           OR (a.item_kind = 'pending_introduction' AND c.can_respond_introduction)
    )
    SELECT
        p.item_kind,
        p.item_id,
        p.updated_at,
        p.safe_title,
        p.safe_summary,
        p.status,
        r.read_at IS NULL
    FROM permitted p
    LEFT JOIN public.business_notification_receipts r
      ON r.user_id = auth.uid()
     AND r.item_kind = p.item_kind
     AND r.item_id = p.item_id
     AND r.item_updated_at = p.updated_at
    ORDER BY p.updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.mark_business_notification_read(
    p_item_kind text,
    p_item_id uuid,
    p_item_updated_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'authentication required';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM public.business_return_loop_items() i
        WHERE i.item_kind = p_item_kind
          AND i.item_id = p_item_id
          AND i.item_updated_at = p_item_updated_at
    ) THEN
        RAISE EXCEPTION 'notification is not actionable by this user';
    END IF;
    INSERT INTO public.business_notification_receipts (
        user_id, item_kind, item_id, item_updated_at, read_at
    ) VALUES (
        auth.uid(), p_item_kind, p_item_id, p_item_updated_at, pg_catalog.now()
    ) ON CONFLICT (user_id, item_kind, item_id, item_updated_at)
      DO UPDATE SET read_at = EXCLUDED.read_at;
END;
$$;

REVOKE ALL ON public.business_notification_receipts FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.business_notification_receipts FROM app_user;
GRANT SELECT ON public.business_notification_receipts TO app_user;

REVOKE ALL ON FUNCTION public.business_return_loop_items() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_business_notification_read(text, uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.business_return_loop_items() TO app_user;
GRANT EXECUTE ON FUNCTION public.mark_business_notification_read(text, uuid, timestamptz) TO app_user;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE 'DROP POLICY IF EXISTS business_notification_receipts_select_authenticated ON public.business_notification_receipts';
        EXECUTE 'CREATE POLICY business_notification_receipts_select_authenticated ON public.business_notification_receipts FOR SELECT TO authenticated USING (user_id = auth.uid())';
        EXECUTE 'GRANT SELECT ON public.business_notification_receipts TO authenticated';
        EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.business_notification_receipts FROM authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.business_return_loop_items() TO authenticated';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.mark_business_notification_read(text, uuid, timestamptz) TO authenticated';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE 'REVOKE ALL ON public.business_notification_receipts FROM anon';
        EXECUTE 'REVOKE ALL ON FUNCTION public.business_return_loop_items() FROM anon';
        EXECUTE 'REVOKE ALL ON FUNCTION public.mark_business_notification_read(text, uuid, timestamptz) FROM anon';
    END IF;
END $$;
