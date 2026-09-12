import os
import uuid

import psycopg2
import pytest


SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
AUTH_DSN = os.environ.get("DB_URL_AUTHENTICATED")

USER_A = uuid.UUID("11111111-1111-1111-1111-111111111111")
USER_B = uuid.UUID("77777777-7777-7777-7777-777777777777")
VIEWER = uuid.UUID("88888888-8888-8888-8888-888888888888")
OUTSIDER = uuid.UUID("66666666-6666-6666-6666-666666666666")
ORG_A = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
ORG_B = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")

pytestmark = pytest.mark.skipif(
    not SUPER_DSN or not AUTH_DSN,
    reason="DB_URL_SUPERUSER and DB_URL_AUTHENTICATED are required",
)


def set_user(conn, user_id):
    with conn.cursor() as cur:
        cur.execute("SELECT set_config('request.jwt.claims.sub', %s, false)", (str(user_id),))


def scalar(conn, sql, params=()):
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()[0]


def capability(conn, match_id):
    with conn.cursor() as cur:
        cur.execute(
            "SELECT can_qualify, can_request_introduction, can_respond_introduction, "
            "can_manage_relationship FROM public.business_match_capabilities(ARRAY[%s]::uuid[])",
            (str(match_id),),
        )
        return cur.fetchone()


@pytest.fixture(autouse=True)
def seed_organizations():
    with psycopg2.connect(SUPER_DSN) as conn, conn.cursor() as cur:
        cur.execute(
            "TRUNCATE organization_audit_log, organization_verifications, "
            "organization_private_data, organization_memberships, organizations CASCADE"
        )
        cur.execute(
            "INSERT INTO organizations(id,name,owner_user_id) VALUES (%s,'Intent Org',%s),(%s,'Opportunity Org',%s)",
            (str(ORG_A), str(USER_A), str(ORG_B), str(USER_B)),
        )
        cur.execute(
            "INSERT INTO organization_memberships(organization_id,user_id,role) "
            "VALUES (%s,%s,'owner'),(%s,%s,'owner'),(%s,%s,'viewer')",
            (str(ORG_A), str(USER_A), str(ORG_B), str(USER_B), str(ORG_A), str(VIEWER)),
        )


@pytest.fixture
def auth_conn():
    conn = psycopg2.connect(AUTH_DSN)
    conn.autocommit = False
    try:
        yield conn
    finally:
        conn.rollback()
        conn.close()


def create_match(conn):
    set_user(conn, USER_A)
    intent_id = scalar(
        conn,
        "SELECT (public.create_business_intent_v1(%s,'buy','Need a partner','Public safe',"
        "'business services',ARRAY['BG'],'confidential','active',NULL,NULL)).id",
        (str(ORG_A),),
    )
    set_user(conn, USER_B)
    opportunity_id = scalar(
        conn,
        "SELECT (public.create_business_opportunity_v1(%s,'sell','Available partner','Public safe',"
        "'business services',ARRAY['BG'],'network','open',NULL,NULL)).id",
        (str(ORG_B),),
    )
    conn.commit()
    with psycopg2.connect(SUPER_DSN) as admin:
        scalar(admin, "SELECT public.run_matching_engine_v1()")
    set_user(conn, USER_A)
    match_id = scalar(conn, "SELECT id FROM business_matches WHERE intent_id=%s", (str(intent_id),))
    return match_id, opportunity_id


def test_capabilities_follow_actor_and_lifecycle(auth_conn):
    match_id, _ = create_match(auth_conn)

    set_user(auth_conn, USER_A)
    assert capability(auth_conn, match_id) == (True, False, False, False)
    scalar(auth_conn, "SELECT (public.qualify_business_match(%s)).id", (str(match_id),))
    assert capability(auth_conn, match_id) == (False, True, False, False)
    scalar(auth_conn, "SELECT (public.request_business_match_introduction(%s,%s)).id", (str(match_id), "Safe introduction"))
    assert capability(auth_conn, match_id) == (False, False, False, False)

    set_user(auth_conn, USER_B)
    assert capability(auth_conn, match_id) == (False, False, True, False)
    scalar(auth_conn, "SELECT (public.respond_business_match_introduction(%s,true,%s)).id", (str(match_id), "Accepted"))
    assert capability(auth_conn, match_id) == (False, False, False, True)

    assert scalar(auth_conn, "SELECT count(*) FROM business_relationships WHERE origin_match_id=%s", (str(match_id),)) == 1
    assert scalar(auth_conn, "SELECT count(*) FROM business_match_events WHERE match_id=%s AND kind IN ('introduction_requested','introduction_accepted')", (str(match_id),)) == 2


def test_viewer_and_outsider_receive_no_actions(auth_conn):
    match_id, _ = create_match(auth_conn)
    set_user(auth_conn, VIEWER)
    assert capability(auth_conn, match_id) == (False, False, False, False)
    set_user(auth_conn, OUTSIDER)
    assert capability(auth_conn, match_id) is None


def test_capability_function_privileges_are_fail_closed():
    with psycopg2.connect(SUPER_DSN) as conn:
        assert scalar(conn, "SELECT has_function_privilege('authenticated','public.business_match_capabilities(uuid[])','execute')") is True
        assert scalar(conn, "SELECT has_function_privilege('public','public.business_match_capabilities(uuid[])','execute')") is False
        if scalar(conn, "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')"):
            assert scalar(conn, "SELECT has_function_privilege('anon','public.business_match_capabilities(uuid[])','execute')") is False
