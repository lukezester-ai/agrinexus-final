import os
import uuid

import psycopg2
import pytest


SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
AUTH_DSN = os.environ.get("DB_URL_AUTHENTICATED")
REQUESTER = uuid.UUID("11111111-1111-1111-1111-111111111111")
REVIEWER = uuid.UUID("99999999-9999-9999-9999-999999999999")
OUTSIDER = uuid.UUID("66666666-6666-6666-6666-666666666666")
ORG = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")

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
def seed_scenario():
    with psycopg2.connect(SUPER_DSN) as conn, conn.cursor() as cur:
        cur.execute("TRUNCATE organization_audit_log, organization_verifications, organization_memberships, organizations CASCADE")
        cur.execute("TRUNCATE private.verification_reviewers")
        cur.execute("INSERT INTO organizations(id,name,owner_user_id) VALUES (%s,'Review Org',%s)", (str(ORG), str(REQUESTER)))
        cur.execute("INSERT INTO organization_memberships(organization_id,user_id,role) VALUES (%s,%s,'owner')", (str(ORG), str(REQUESTER)))


@pytest.fixture
def auth_conn():
    conn = psycopg2.connect(AUTH_DSN)
    conn.autocommit = False
    try:
        yield conn
    finally:
        conn.rollback()
        conn.close()


def create_pending(conn):
    set_user(conn, REQUESTER)
    verification_id = scalar(
        conn,
        "SELECT (public.request_organization_verification_v1(%s, '{\"registration_country\":\"BG\",\"registration_number\":\"TEST-1\"}'::jsonb)).id",
        (str(ORG),),
    )
    conn.commit()
    return verification_id


def enroll_reviewer():
    with psycopg2.connect(SUPER_DSN) as conn, conn.cursor() as cur:
        cur.execute("INSERT INTO private.verification_reviewers(user_id,granted_by) VALUES (%s,%s)", (str(REVIEWER), str(REVIEWER)))


def test_non_reviewer_is_denied_queue_and_review(auth_conn):
    verification_id = create_pending(auth_conn)
    set_user(auth_conn, OUTSIDER)
    assert scalar(auth_conn, "SELECT public.is_verification_reviewer_v1()") is False
    with pytest.raises(psycopg2.Error):
        scalar(auth_conn, "SELECT count(*) FROM public.verification_review_queue_v1()")
    auth_conn.rollback()
    set_user(auth_conn, OUTSIDER)
    with pytest.raises(psycopg2.Error):
        scalar(auth_conn, "SELECT (public.review_organization_verification_authenticated_v1(%s,'approved','not allowed')).status", (str(verification_id),))


def test_reviewer_can_read_and_approve_with_audit(auth_conn):
    verification_id = create_pending(auth_conn)
    enroll_reviewer()
    set_user(auth_conn, REVIEWER)
    assert scalar(auth_conn, "SELECT public.is_verification_reviewer_v1()") is True
    assert scalar(auth_conn, "SELECT count(*) FROM public.verification_review_queue_v1()") == 1
    assert scalar(
        auth_conn,
        "SELECT (public.review_organization_verification_authenticated_v1(%s,'approved','registry checked')).status",
        (str(verification_id),),
    ) == "approved"
    auth_conn.commit()
    with psycopg2.connect(SUPER_DSN) as observer:
        assert scalar(observer, "SELECT count(*) FROM organization_audit_log WHERE subject_id=%s AND action='verification.status_changed'", (str(verification_id),)) == 1


def test_privileges_are_fail_closed():
    with psycopg2.connect(SUPER_DSN) as conn:
        assert scalar(conn, "SELECT has_table_privilege('authenticated','private.verification_reviewers','select')") is False
        assert scalar(conn, "SELECT has_function_privilege('anon','public.verification_review_queue_v1()','execute')") is False
        assert scalar(conn, "SELECT has_function_privilege('anon','public.review_organization_verification_authenticated_v1(uuid,text,text)','execute')") is False
        assert scalar(conn, "SELECT has_function_privilege('authenticated','public.verification_review_queue_v1()','execute')") is True
