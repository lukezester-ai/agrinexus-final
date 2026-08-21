import os
import uuid

import psycopg2
import pytest
from psycopg2 import errors

SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
APP_DSN = os.environ.get("DB_URL_APPUSER")

USER_A = uuid.UUID("11111111-1111-1111-1111-111111111111")
USER_B = uuid.UUID("22222222-2222-2222-2222-222222222222")
USER_C = uuid.UUID("33333333-3333-3333-3333-333333333333")
USER_D = uuid.UUID("44444444-4444-4444-4444-444444444444")
ORG_A = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
ORG_B = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")
ROW_A = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")
ROW_B = uuid.UUID("bbbbbbbb-0000-0000-0000-000000000001")


pytestmark = pytest.mark.skipif(
    not SUPER_DSN or not APP_DSN,
    reason="DB_URL_SUPERUSER and DB_URL_APPUSER are required",
)


@pytest.fixture(scope="session", autouse=True)
def seeded_database():
    with psycopg2.connect(SUPER_DSN) as conn, conn.cursor() as cur:
        cur.execute("TRUNCATE organization_audit_log, organization_verifications, organization_private_data, organization_memberships, organizations CASCADE")
        cur.execute(
            "INSERT INTO organizations (id, name, owner_user_id) VALUES (%s, 'Farm A', %s), (%s, 'Farm B', %s)",
            (str(ORG_A), str(USER_A), str(ORG_B), str(USER_C)),
        )
        cur.execute(
            "INSERT INTO organization_memberships (organization_id, user_id, role) VALUES (%s,%s,'owner'),(%s,%s,'member'),(%s,%s,'viewer'),(%s,%s,'owner')",
            (str(ORG_A), str(USER_A), str(ORG_A), str(USER_B), str(ORG_A), str(USER_D), str(ORG_B), str(USER_C)),
        )
        cur.execute(
            "INSERT INTO organization_private_data (id, organization_id, created_by, label) VALUES (%s,%s,%s,'A private'),(%s,%s,%s,'B private')",
            (str(ROW_A), str(ORG_A), str(USER_A), str(ROW_B), str(ORG_B), str(USER_C)),
        )
    yield


@pytest.fixture
def app_conn():
    conn = psycopg2.connect(APP_DSN)
    conn.autocommit = False
    try:
        yield conn
    finally:
        conn.rollback()
        conn.close()


def as_user(conn, user_id):
    with conn.cursor() as cur:
        cur.execute("SELECT set_config('request.jwt.claims.sub', %s, true)", (str(user_id),))


def scalar(conn, sql, params=()):
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()[0]


def test_app_role_is_not_privileged(app_conn):
    with app_conn.cursor() as cur:
        cur.execute("SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user")
        name, is_super, bypasses_rls = cur.fetchone()
    assert name == "app_user"
    assert is_super is False
    assert bypasses_rls is False


def test_auth_uid_reads_transaction_claim(app_conn):
    as_user(app_conn, USER_A)
    assert uuid.UUID(str(scalar(app_conn, "SELECT auth.uid()"))) == USER_A


def test_owner_can_read_own_organization(app_conn):
    as_user(app_conn, USER_A)
    assert scalar(app_conn, "SELECT count(*) FROM organizations WHERE id=%s", (str(ORG_A),)) == 1


def test_member_can_read_organization(app_conn):
    as_user(app_conn, USER_B)
    assert scalar(app_conn, "SELECT count(*) FROM organizations WHERE id=%s", (str(ORG_A),)) == 1


def test_outsider_cannot_read_organization(app_conn):
    as_user(app_conn, USER_A)
    assert scalar(app_conn, "SELECT count(*) FROM organizations WHERE id=%s", (str(ORG_B),)) == 0


def test_owner_can_read_own_org_private_data(app_conn):
    as_user(app_conn, USER_A)
    assert scalar(app_conn, "SELECT count(*) FROM organization_private_data WHERE id=%s", (str(ROW_A),)) == 1


def test_member_can_read_org_private_data(app_conn):
    as_user(app_conn, USER_B)
    assert scalar(app_conn, "SELECT count(*) FROM organization_private_data WHERE id=%s", (str(ROW_A),)) == 1


def test_user_cannot_read_other_org_private_data(app_conn):
    as_user(app_conn, USER_A)
    assert scalar(app_conn, "SELECT count(*) FROM organization_private_data WHERE id=%s", (str(ROW_B),)) == 0


def test_viewer_can_read_org_private_data(app_conn):
    as_user(app_conn, USER_D)
    assert scalar(app_conn, "SELECT count(*) FROM organization_private_data WHERE id=%s", (str(ROW_A),)) == 1


def test_viewer_cannot_insert(app_conn):
    as_user(app_conn, USER_D)
    with pytest.raises(errors.InsufficientPrivilege), app_conn.cursor() as cur:
        cur.execute("INSERT INTO organization_private_data (organization_id, created_by, label) VALUES (%s,%s,'viewer insert')", (str(ORG_A), str(USER_D)))


def test_viewer_cannot_update(app_conn):
    as_user(app_conn, USER_D)
    with app_conn.cursor() as cur:
        cur.execute("UPDATE organization_private_data SET label='viewer update' WHERE id=%s", (str(ROW_A),))
        assert cur.rowcount == 0


def test_viewer_cannot_delete(app_conn):
    as_user(app_conn, USER_D)
    with app_conn.cursor() as cur:
        cur.execute("DELETE FROM organization_private_data WHERE id=%s", (str(ROW_A),))
        assert cur.rowcount == 0


def test_member_can_insert_for_self_in_own_org(app_conn):
    as_user(app_conn, USER_B)
    with app_conn.cursor() as cur:
        cur.execute("INSERT INTO organization_private_data (organization_id, created_by, label) VALUES (%s,%s,'member row') RETURNING id", (str(ORG_A), str(USER_B)))
        assert cur.fetchone()[0]


def test_member_cannot_spoof_creator(app_conn):
    as_user(app_conn, USER_B)
    with pytest.raises(errors.InsufficientPrivilege), app_conn.cursor() as cur:
        cur.execute("INSERT INTO organization_private_data (organization_id, created_by, label) VALUES (%s,%s,'spoof')", (str(ORG_A), str(USER_A)))


def test_user_cannot_insert_into_other_org(app_conn):
    as_user(app_conn, USER_A)
    with pytest.raises(errors.InsufficientPrivilege), app_conn.cursor() as cur:
        cur.execute("INSERT INTO organization_private_data (organization_id, created_by, label) VALUES (%s,%s,'cross tenant')", (str(ORG_B), str(USER_A)))
