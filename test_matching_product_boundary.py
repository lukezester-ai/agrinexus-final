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


@pytest.fixture(scope="session", autouse=True)
def seed_matching_scenario():
    with psycopg2.connect(SUPER_DSN) as conn, conn.cursor() as cur:
        cur.execute(
            "TRUNCATE organization_audit_log, organization_verifications, "
            "organization_private_data, organization_memberships, organizations CASCADE"
        )
        cur.execute(
            "INSERT INTO organizations(id,name,owner_user_id) VALUES (%s,'Org A',%s),(%s,'Org B',%s)",
            (str(ORG_A), str(USER_A), str(ORG_B), str(USER_B)),
        )
        cur.execute(
            "INSERT INTO organization_memberships(organization_id,user_id,role) "
            "VALUES (%s,%s,'owner'),(%s,%s,'owner')",
            (str(ORG_A), str(USER_A), str(ORG_B), str(USER_B)),
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


def create_scenario(auth_conn):
    set_user(auth_conn, USER_A)
    intent_id = scalar(
        auth_conn,
        "SELECT (public.create_business_intent_v1(%s,'buy','Need supply','Safe','manufacturing',"
        "ARRAY['BG'],'network','active',NULL,NULL)).id",
        (str(ORG_A),),
    )
    set_user(auth_conn, USER_B)
    opportunity_id = scalar(
        auth_conn,
        "INSERT INTO public.business_opportunities "
        "(organization_id,created_by,source_type,title,summary,industry,target_markets,visibility,lifecycle,facets) "
        "VALUES (%s,%s,'manual','Supply available','Safe','manufacturing',ARRAY['BG'],'network','open',"
        "'{\"kind\":\"supply\"}'::jsonb) RETURNING id",
        (str(ORG_B), str(USER_B)),
    )
    auth_conn.commit()
    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute("SET ROLE intent_matcher")
        cur.execute("SELECT public.run_matching_engine_v1()")
        assert cur.fetchone()[0] >= 1
        cur.execute("RESET ROLE")
    return intent_id, opportunity_id


def test_authenticated_can_create_manual_opportunity(auth_conn):
    create_scenario(auth_conn)


def test_matcher_is_not_user_callable(auth_conn):
    set_user(auth_conn, USER_A)
    with pytest.raises(psycopg2.Error):
        scalar(auth_conn, "SELECT public.run_matching_engine_v1()")


def test_match_visibility_is_party_only(auth_conn):
    intent_id, _ = create_scenario(auth_conn)
    set_user(auth_conn, USER_A)
    match_id = scalar(auth_conn, "SELECT id FROM business_matches WHERE intent_id=%s", (str(intent_id),))
    assert match_id is not None
    auth_conn.rollback()
    set_user(auth_conn, OUTSIDER)
    assert scalar(auth_conn, "SELECT count(*) FROM business_matches WHERE id=%s", (str(match_id),)) == 0


def test_lifecycle_is_rpc_only_and_radar_is_readable(auth_conn):
    intent_id, _ = create_scenario(auth_conn)
    set_user(auth_conn, USER_A)
    match_id = scalar(auth_conn, "SELECT id FROM business_matches WHERE intent_id=%s", (str(intent_id),))
    with pytest.raises(psycopg2.Error):
        with auth_conn.cursor() as cur:
            cur.execute("UPDATE business_matches SET lifecycle='qualified' WHERE id=%s", (str(match_id),))
    auth_conn.rollback()
    set_user(auth_conn, USER_A)
    assert scalar(
        auth_conn,
        "SELECT (public.qualify_business_match(%s)).lifecycle::text",
        (str(match_id),),
    ) == "qualified"
    assert scalar(auth_conn, "SELECT candidate_matches + qualified_matches FROM public.business_radar_summary()") >= 1
    assert scalar(auth_conn, "SELECT count(*) FROM public.business_radar_items") >= 1


def test_privilege_contract_is_fail_closed():
    with psycopg2.connect(SUPER_DSN) as conn:
        assert scalar(conn, "SELECT has_function_privilege('authenticated','public.run_matching_engine_v1()','execute')") is False
        assert scalar(conn, "SELECT has_function_privilege('public','public.run_matching_engine_v1()','execute')") is False
        if scalar(conn, "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')"):
            assert scalar(conn, "SELECT has_function_privilege('anon','public.run_matching_engine_v1()','execute')") is False
        assert scalar(conn, "SELECT has_function_privilege('authenticated','public.qualify_business_match(uuid)','execute')") is True
        assert scalar(conn, "SELECT has_table_privilege('authenticated','public.business_matches','insert')") is False
        assert scalar(conn, "SELECT has_table_privilege('authenticated','public.business_matches','update')") is False
