import os
import uuid

import psycopg2
import pytest

SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
AUTH_DSN = os.environ.get("DB_URL_AUTHENTICATED")
USER_A = uuid.UUID("11111111-1111-1111-1111-111111111111")
USER_B = uuid.UUID("77777777-7777-7777-7777-777777777777")
OUTSIDER = uuid.UUID("66666666-6666-6666-6666-666666666666")
ORG_A = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
ORG_B = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")

pytestmark = pytest.mark.skipif(not SUPER_DSN or not AUTH_DSN, reason="database URLs required")


def set_user(conn, user_id):
    with conn.cursor() as cur:
        cur.execute("SELECT set_config('request.jwt.claims.sub', %s, false)", (str(user_id),))


def scalar(conn, sql, params=()):
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()[0]


@pytest.fixture(autouse=True)
def seed():
    with psycopg2.connect(SUPER_DSN) as conn, conn.cursor() as cur:
        cur.execute("TRUNCATE organization_audit_log, organization_verifications, organization_private_data, organization_memberships, organizations CASCADE")
        cur.execute("INSERT INTO organizations(id,name,owner_user_id) VALUES (%s,'Intent Org',%s),(%s,'Opportunity Org',%s)", (str(ORG_A), str(USER_A), str(ORG_B), str(USER_B)))
        cur.execute("INSERT INTO organization_memberships(organization_id,user_id,role) VALUES (%s,%s,'owner'),(%s,%s,'owner')", (str(ORG_A), str(USER_A), str(ORG_B), str(USER_B)))


def create_candidate(conn):
    set_user(conn, USER_A)
    intent_id = scalar(conn, "SELECT (public.create_business_intent_v1(%s,'buy','Need partner','Safe','services',ARRAY['BG'],'confidential','active',NULL,NULL)).id", (str(ORG_A),))
    set_user(conn, USER_B)
    scalar(conn, "SELECT (public.create_business_opportunity_v1(%s,'sell','Partner available','Safe','services',ARRAY['BG'],'network','open',NULL,NULL)).id", (str(ORG_B),))
    conn.commit()
    with psycopg2.connect(SUPER_DSN) as admin:
        scalar(admin, "SELECT public.run_matching_engine_v1()")
    set_user(conn, USER_A)
    return scalar(conn, "SELECT id FROM business_matches WHERE intent_id=%s", (str(intent_id),))


def test_actionable_item_can_be_marked_read():
    with psycopg2.connect(AUTH_DSN) as conn:
        match_id = create_candidate(conn)
        set_user(conn, USER_A)
        with conn.cursor() as cur:
            cur.execute("SELECT item_kind,item_id,item_updated_at,is_unread FROM public.business_return_loop_items() WHERE item_id=%s", (str(match_id),))
            kind, item_id, updated_at, unread = cur.fetchone()
        assert kind == "candidate_match" and unread is True
        scalar(conn, "SELECT public.mark_business_notification_read(%s,%s,%s)", (kind, str(item_id), updated_at))
        assert scalar(conn, "SELECT is_unread FROM public.business_return_loop_items() WHERE item_id=%s", (str(match_id),)) is False


def test_outsider_cannot_read_or_mark_item():
    with psycopg2.connect(AUTH_DSN) as conn:
        match_id = create_candidate(conn)
        set_user(conn, USER_A)
        with conn.cursor() as cur:
            cur.execute("SELECT item_updated_at FROM public.business_return_loop_items() WHERE item_id=%s", (str(match_id),))
            updated_at = cur.fetchone()[0]
        set_user(conn, OUTSIDER)
        assert scalar(conn, "SELECT count(*) FROM public.business_return_loop_items()") == 0
        with pytest.raises(psycopg2.Error):
            scalar(conn, "SELECT public.mark_business_notification_read('candidate_match',%s,%s)", (str(match_id), updated_at))


def test_privileges_are_fail_closed():
    with psycopg2.connect(SUPER_DSN) as conn:
        assert scalar(conn, "SELECT has_function_privilege('authenticated','public.business_return_loop_items()','execute')") is True
        assert scalar(conn, "SELECT has_function_privilege('public','public.business_return_loop_items()','execute')") is False
        assert scalar(conn, "SELECT has_function_privilege('public','public.mark_business_notification_read(text,uuid,timestamp with time zone)','execute')") is False
