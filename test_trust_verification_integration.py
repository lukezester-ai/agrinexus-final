import os
import uuid

import psycopg2
import pytest


SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
AUTH_DSN = os.environ.get("DB_URL_AUTHENTICATED")

USER_A = uuid.UUID("11111111-1111-1111-1111-111111111111")
USER_B = uuid.UUID("77777777-7777-7777-7777-777777777777")
OUTSIDER = uuid.UUID("66666666-6666-6666-6666-666666666666")
REVIEWER = uuid.UUID("99999999-9999-9999-9999-999999999999")
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


@pytest.fixture(autouse=True)
def seed_trust_scenario():
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


def request_verification(conn, organization_id, user_id):
    set_user(conn, user_id)
    return scalar(
        conn,
        "SELECT (public.request_organization_verification_v1(%s, %s::jsonb)).id",
        (str(organization_id), '{"registry":"verified-source","reference":"A-1"}'),
    )


def review(verification_id, target_status, reason="reviewed evidence"):
    with psycopg2.connect(SUPER_DSN) as conn:
        return scalar(
            conn,
            "SELECT (public.review_organization_verification_v1(%s,%s,%s,%s)).status",
            (str(verification_id), target_status, str(REVIEWER), reason),
        )


def test_authorized_request_is_atomic_and_audited(auth_conn):
    verification_id = request_verification(auth_conn, ORG_A, USER_A)
    assert scalar(auth_conn, "SELECT status FROM organization_verifications WHERE id=%s", (str(verification_id),)) == "pending"
    assert scalar(
        auth_conn,
        "SELECT count(*) FROM organization_audit_log WHERE subject_id=%s AND action='verification.requested'",
        (str(verification_id),),
    ) == 1


def test_outsider_and_direct_mutations_are_denied(auth_conn):
    set_user(auth_conn, OUTSIDER)
    with pytest.raises(psycopg2.Error):
        scalar(
            auth_conn,
            "SELECT (public.request_organization_verification_v1(%s, '{\"source\":\"x\"}'::jsonb)).id",
            (str(ORG_A),),
        )
    auth_conn.rollback()
    set_user(auth_conn, USER_A)
    with pytest.raises(psycopg2.Error):
        with auth_conn.cursor() as cur:
            cur.execute(
                "INSERT INTO organization_verifications(organization_id,requested_by,evidence) VALUES (%s,%s,'{}')",
                (str(ORG_A), str(USER_A)),
            )


def test_review_lifecycle_is_deny_by_default(auth_conn):
    verification_id = request_verification(auth_conn, ORG_A, USER_A)
    auth_conn.commit()
    assert review(verification_id, "approved") == "approved"
    with pytest.raises(psycopg2.Error):
        review(verification_id, "rejected")
    assert review(verification_id, "suspended") == "suspended"
    assert review(verification_id, "approved", "reinstated") == "approved"


def test_suspended_organization_is_excluded_from_matching_and_visibility(auth_conn):
    verification_id = request_verification(auth_conn, ORG_B, USER_B)
    auth_conn.commit()
    assert review(verification_id, "approved") == "approved"

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
        "INSERT INTO business_opportunities "
        "(organization_id,created_by,source_type,title,summary,industry,target_markets,visibility,lifecycle,facets) "
        "VALUES (%s,%s,'manual','Supply','Safe','manufacturing',ARRAY['BG'],'network','open','{\"kind\":\"supply\"}') RETURNING id",
        (str(ORG_B), str(USER_B)),
    )
    auth_conn.commit()

    with psycopg2.connect(SUPER_DSN) as admin:
        scalar(admin, "SELECT public.run_matching_engine_v1()")
    set_user(auth_conn, USER_A)
    assert scalar(auth_conn, "SELECT count(*) FROM business_matches WHERE intent_id=%s", (str(intent_id),)) == 1
    auth_conn.rollback()

    assert review(verification_id, "suspended", "compliance hold") == "suspended"
    with psycopg2.connect(SUPER_DSN) as admin:
        assert scalar(admin, "SELECT public.run_matching_engine_v1()") == 0
    set_user(auth_conn, USER_A)
    assert scalar(auth_conn, "SELECT count(*) FROM business_matches WHERE intent_id=%s AND opportunity_id=%s", (str(intent_id), str(opportunity_id))) == 0


def test_audit_failure_rolls_back_review(auth_conn):
    verification_id = request_verification(auth_conn, ORG_A, USER_A)
    auth_conn.commit()
    with psycopg2.connect(SUPER_DSN) as conn, conn.cursor() as cur:
        cur.execute("CREATE OR REPLACE FUNCTION public.fail_verification_audit_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit blocked'; END $$")
        cur.execute("CREATE TRIGGER fail_verification_audit_test BEFORE INSERT ON organization_audit_log FOR EACH ROW WHEN (NEW.action = 'verification.status_changed') EXECUTE FUNCTION public.fail_verification_audit_test()")
    try:
        with pytest.raises(psycopg2.Error):
            review(verification_id, "approved")
        with psycopg2.connect(SUPER_DSN) as conn:
            assert scalar(conn, "SELECT status FROM organization_verifications WHERE id=%s", (str(verification_id),)) == "pending"
    finally:
        with psycopg2.connect(SUPER_DSN) as conn, conn.cursor() as cur:
            cur.execute("DROP TRIGGER IF EXISTS fail_verification_audit_test ON organization_audit_log")
            cur.execute("DROP FUNCTION IF EXISTS public.fail_verification_audit_test()")


def test_privileges_are_fail_closed():
    with psycopg2.connect(SUPER_DSN) as conn:
        assert scalar(conn, "SELECT has_table_privilege('authenticated','organization_verifications','insert')") is False
        assert scalar(conn, "SELECT has_table_privilege('authenticated','organization_verifications','update')") is False
        assert scalar(conn, "SELECT has_function_privilege('authenticated','public.request_organization_verification_v1(uuid,jsonb)','execute')") is True
        assert scalar(conn, "SELECT has_function_privilege('authenticated','public.review_organization_verification_v1(uuid,text,uuid,text)','execute')") is False
