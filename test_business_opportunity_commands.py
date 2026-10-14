import os
import uuid

import psycopg2
import pytest


SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
ROLE_DSNS = {
    "app_user": os.environ.get("DB_URL_APPUSER"),
    "authenticated": os.environ.get("DB_URL_AUTHENTICATED"),
}

OWNER = uuid.UUID("11111111-1111-1111-1111-111111111111")
ADMIN = uuid.UUID("22222222-2222-2222-2222-222222222222")
MEMBER = uuid.UUID("33333333-3333-3333-3333-333333333333")
OTHER_MEMBER = uuid.UUID("44444444-4444-4444-4444-444444444444")
VIEWER = uuid.UUID("55555555-5555-5555-5555-555555555555")
OUTSIDER = uuid.UUID("66666666-6666-6666-6666-666666666666")
OTHER_OWNER = uuid.UUID("77777777-7777-7777-7777-777777777777")
ORG_A = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
ORG_B = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")


pytestmark = pytest.mark.skipif(
    not SUPER_DSN or not all(ROLE_DSNS.values()),
    reason="DB_URL_SUPERUSER, DB_URL_APPUSER, and DB_URL_AUTHENTICATED are required",
)


def set_user(conn, user_id):
    with conn.cursor() as cur:
        cur.execute("SELECT set_config('request.jwt.claims.sub', %s, false)", (str(user_id),))


def scalar(conn, sql, params=()):
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()[0]


def create_opportunity(
    conn, *, org_id=ORG_A, lifecycle="draft", visibility="private", brief=None, kind="sell"
):
    return scalar(
        conn,
        """
        SELECT (public.create_business_opportunity_v1(
            %s, %s, 'Packaging supply', 'Public-safe summary',
            'manufacturing', ARRAY['BG'], %s, %s, NULL, %s
        )).id
        """,
        (str(org_id), kind, visibility, lifecycle, brief),
    )


def seed_opportunity_as_admin(*, lifecycle, created_by=OWNER):
    opportunity_id = uuid.uuid4()
    with psycopg2.connect(SUPER_DSN) as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO business_opportunities (
                id, organization_id, created_by, source_type, source_ref,
                title, summary, industry, visibility, lifecycle, facets
            ) VALUES (%s, %s, %s, 'manual', 'test', 'Lifecycle matrix', '',
                      'manufacturing', 'private', %s, '{"kind":"sell"}')
            """,
            (str(opportunity_id), str(ORG_A), str(created_by), lifecycle),
        )
    return opportunity_id


@pytest.fixture(scope="session", autouse=True)
def seed_database():
    with psycopg2.connect(SUPER_DSN) as conn, conn.cursor() as cur:
        cur.execute(
            "TRUNCATE organization_audit_log, organization_verifications, "
            "organization_private_data, organization_memberships, organizations CASCADE"
        )
        cur.execute(
            """
            INSERT INTO organizations (id, name, owner_user_id)
            VALUES (%s, 'Organization A', %s), (%s, 'Organization B', %s)
            """,
            (str(ORG_A), str(OWNER), str(ORG_B), str(OTHER_OWNER)),
        )
        cur.execute(
            """
            INSERT INTO organization_memberships (organization_id, user_id, role)
            VALUES
                (%s, %s, 'owner'), (%s, %s, 'admin'),
                (%s, %s, 'member'), (%s, %s, 'member'),
                (%s, %s, 'viewer'), (%s, %s, 'owner')
            """,
            (
                str(ORG_A), str(OWNER), str(ORG_A), str(ADMIN),
                str(ORG_A), str(MEMBER), str(ORG_A), str(OTHER_MEMBER),
                str(ORG_A), str(VIEWER), str(ORG_B), str(OTHER_OWNER),
            ),
        )
    yield


@pytest.fixture(params=("app_user", "authenticated"))
def role_conn(request):
    conn = psycopg2.connect(ROLE_DSNS[request.param])
    conn.autocommit = False
    try:
        yield request.param, conn
    finally:
        conn.rollback()
        conn.close()


def test_roles_are_unprivileged(role_conn):
    role_name, conn = role_conn
    with conn.cursor() as cur:
        cur.execute("SELECT current_user, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user")
        assert cur.fetchone() == (role_name, False, False)


@pytest.mark.parametrize("actor", (OWNER, ADMIN, MEMBER))
def test_authorized_roles_create_atomically_with_secret_index_and_audit(role_conn, actor):
    _, conn = role_conn
    set_user(conn, actor)
    opportunity_id = create_opportunity(
        conn, lifecycle="open", visibility="confidential", brief="Private requirements"
    )
    assert scalar(conn, "SELECT count(*) FROM business_opportunities WHERE id=%s", (str(opportunity_id),)) == 1
    assert scalar(conn, "SELECT count(*) FROM business_opportunity_secrets WHERE opportunity_id=%s", (str(opportunity_id),)) == 1
    conn.commit()
    with psycopg2.connect(SUPER_DSN) as admin:
        assert scalar(admin, "SELECT count(*) FROM business_opportunity_match_index WHERE opportunity_id=%s", (str(opportunity_id),)) == 1
    set_user(conn, actor)
    assert scalar(
        conn,
        """
        SELECT count(*) FROM organization_audit_log
        WHERE subject_id=%s AND action='opportunity.created'
          AND actor_user_id=%s AND details->>'lifecycle'='open'
        """,
        (str(opportunity_id), str(actor)),
    ) == 1


@pytest.mark.parametrize("actor,org_id", ((VIEWER, ORG_A), (OUTSIDER, ORG_A), (OWNER, ORG_B)))
def test_unauthorized_create_is_denied(role_conn, actor, org_id):
    _, conn = role_conn
    set_user(conn, actor)
    with pytest.raises(psycopg2.Error):
        create_opportunity(conn, org_id=org_id)


def test_invalid_kind_and_initial_lifecycle_are_denied(role_conn):
    _, conn = role_conn
    set_user(conn, OWNER)
    with pytest.raises(psycopg2.Error):
        create_opportunity(conn, kind="unknown")
    conn.rollback()
    set_user(conn, OWNER)
    with pytest.raises(psycopg2.Error):
        create_opportunity(conn, lifecycle="pursuing")


def test_direct_mutations_are_revoked(role_conn):
    _, conn = role_conn
    set_user(conn, OWNER)
    with pytest.raises(psycopg2.Error):
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO business_opportunities
                    (organization_id, created_by, source_type, title, industry)
                VALUES (%s, %s, 'manual', 'Bypass', 'manufacturing')
                """,
                (str(ORG_A), str(OWNER)),
            )
    conn.rollback()
    set_user(conn, OWNER)
    opportunity_id = create_opportunity(conn)
    conn.commit()
    set_user(conn, OWNER)
    with pytest.raises(psycopg2.Error):
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE business_opportunities SET lifecycle='open' WHERE id=%s",
                (str(opportunity_id),),
            )


def test_create_rolls_back_when_audit_fails(role_conn):
    _, conn = role_conn
    marker = f"rollback-{uuid.uuid4()}"
    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            """
            CREATE OR REPLACE FUNCTION public.fail_opportunity_audit_for_test()
            RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
            BEGIN
                IF NEW.action = 'opportunity.created' THEN
                    RAISE EXCEPTION 'forced audit failure';
                END IF;
                RETURN NEW;
            END $$;
            CREATE TRIGGER fail_opportunity_audit_for_test
            BEFORE INSERT ON public.organization_audit_log
            FOR EACH ROW EXECUTE PROCEDURE public.fail_opportunity_audit_for_test();
            """
        )
    try:
        set_user(conn, OWNER)
        with pytest.raises(psycopg2.Error):
            scalar(
                conn,
                """
                SELECT public.create_business_opportunity_v1(
                    %s, 'sell', %s, '', 'manufacturing', ARRAY['BG'],
                    'private', 'draft', NULL, 'secret'
                )
                """,
                (str(ORG_A), marker),
            )
        conn.rollback()
        with psycopg2.connect(SUPER_DSN) as admin:
            assert scalar(admin, "SELECT count(*) FROM business_opportunities WHERE title=%s", (marker,)) == 0
    finally:
        with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
            cur.execute("DROP TRIGGER IF EXISTS fail_opportunity_audit_for_test ON public.organization_audit_log")
            cur.execute("DROP FUNCTION IF EXISTS public.fail_opportunity_audit_for_test()")


def test_visibility_contract_is_equivalent(role_conn):
    _, conn = role_conn
    set_user(conn, OWNER)
    private_id = create_opportunity(conn, lifecycle="open", visibility="private")
    public_id = create_opportunity(conn, lifecycle="open", visibility="public")
    draft_public_id = create_opportunity(conn, lifecycle="draft", visibility="public")
    conn.commit()
    set_user(conn, OUTSIDER)
    assert scalar(conn, "SELECT count(*) FROM business_opportunities WHERE id=%s", (str(private_id),)) == 0
    assert scalar(conn, "SELECT count(*) FROM business_opportunities WHERE id=%s", (str(public_id),)) == 1
    assert scalar(conn, "SELECT count(*) FROM business_opportunities WHERE id=%s", (str(draft_public_id),)) == 0


def test_allowed_transition_updates_index_and_audit(role_conn):
    _, conn = role_conn
    set_user(conn, MEMBER)
    opportunity_id = create_opportunity(conn, visibility="confidential")
    conn.commit()
    set_user(conn, MEMBER)
    lifecycle = scalar(
        conn,
        "SELECT (public.transition_business_opportunity_v1(%s, 'open')).lifecycle",
        (str(opportunity_id),),
    )
    assert lifecycle == "open"
    conn.commit()
    with psycopg2.connect(SUPER_DSN) as admin:
        assert scalar(admin, "SELECT count(*) FROM business_opportunity_match_index WHERE opportunity_id=%s", (str(opportunity_id),)) == 1
    set_user(conn, MEMBER)
    assert scalar(
        conn,
        """
        SELECT count(*) FROM organization_audit_log
        WHERE subject_id=%s AND action='opportunity.status_changed'
          AND actor_user_id=%s AND details->>'from'='draft' AND details->>'to'='open'
        """,
        (str(opportunity_id), str(MEMBER)),
    ) == 1


def test_complete_allowed_transition_matrix(role_conn):
    _, conn = role_conn
    allowed = {
        "draft": ("open", "withdrawn"),
        "open": ("paused", "pursuing", "fulfilled", "withdrawn"),
        "paused": ("open", "pursuing", "fulfilled", "withdrawn"),
        "pursuing": ("paused", "fulfilled", "withdrawn"),
    }
    for current, targets in allowed.items():
        for target in targets:
            opportunity_id = seed_opportunity_as_admin(lifecycle=current)
            set_user(conn, OWNER)
            assert scalar(
                conn,
                "SELECT (public.transition_business_opportunity_v1(%s, %s)).lifecycle",
                (str(opportunity_id), target),
            ) == target
            conn.commit()


def test_lifecycle_matrix_is_exhaustive_and_deny_by_default(role_conn):
    _, conn = role_conn
    states = ("draft", "open", "paused", "pursuing", "fulfilled", "expired", "withdrawn")
    allowed = {
        ("draft", "open"), ("draft", "withdrawn"),
        ("open", "paused"), ("open", "pursuing"), ("open", "fulfilled"), ("open", "withdrawn"),
        ("paused", "open"), ("paused", "pursuing"), ("paused", "fulfilled"), ("paused", "withdrawn"),
        ("pursuing", "paused"), ("pursuing", "fulfilled"), ("pursuing", "withdrawn"),
    }
    for current in states:
        for target in states:
            if (current, target) in allowed:
                continue
            opportunity_id = seed_opportunity_as_admin(lifecycle=current)
            set_user(conn, OWNER)
            with pytest.raises(psycopg2.Error):
                scalar(
                    conn,
                    "SELECT public.transition_business_opportunity_v1(%s, %s)",
                    (str(opportunity_id), target),
                )
            conn.rollback()
            with psycopg2.connect(SUPER_DSN) as admin:
                assert scalar(admin, "SELECT lifecycle FROM business_opportunities WHERE id=%s", (str(opportunity_id),)) == current
                assert scalar(admin, "SELECT count(*) FROM organization_audit_log WHERE subject_id=%s AND action='opportunity.status_changed'", (str(opportunity_id),)) == 0


def test_member_cannot_transition_another_members_opportunity(role_conn):
    _, conn = role_conn
    set_user(conn, MEMBER)
    opportunity_id = create_opportunity(conn)
    conn.commit()
    set_user(conn, OTHER_MEMBER)
    with pytest.raises(psycopg2.Error):
        scalar(conn, "SELECT public.transition_business_opportunity_v1(%s, 'open')", (str(opportunity_id),))


def test_viewer_cannot_transition_and_member_cannot_fulfill(role_conn):
    _, conn = role_conn
    set_user(conn, MEMBER)
    opportunity_id = create_opportunity(conn, lifecycle="open")
    conn.commit()
    set_user(conn, VIEWER)
    with pytest.raises(psycopg2.Error):
        scalar(conn, "SELECT public.transition_business_opportunity_v1(%s, 'paused')", (str(opportunity_id),))
    conn.rollback()
    set_user(conn, MEMBER)
    with pytest.raises(psycopg2.Error):
        scalar(conn, "SELECT public.transition_business_opportunity_v1(%s, 'fulfilled')", (str(opportunity_id),))


def test_transition_rolls_back_when_audit_fails(role_conn):
    _, conn = role_conn
    set_user(conn, OWNER)
    opportunity_id = create_opportunity(conn, lifecycle="open")
    conn.commit()
    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            """
            CREATE OR REPLACE FUNCTION public.fail_opportunity_status_audit_for_test()
            RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
            BEGIN
                IF NEW.action = 'opportunity.status_changed' THEN
                    RAISE EXCEPTION 'forced status audit failure';
                END IF;
                RETURN NEW;
            END $$;
            CREATE TRIGGER fail_opportunity_status_audit_for_test
            BEFORE INSERT ON public.organization_audit_log
            FOR EACH ROW EXECUTE PROCEDURE public.fail_opportunity_status_audit_for_test();
            """
        )
    try:
        set_user(conn, OWNER)
        with pytest.raises(psycopg2.Error):
            scalar(conn, "SELECT public.transition_business_opportunity_v1(%s, 'paused')", (str(opportunity_id),))
        conn.rollback()
        with psycopg2.connect(SUPER_DSN) as admin:
            assert scalar(admin, "SELECT lifecycle FROM business_opportunities WHERE id=%s", (str(opportunity_id),)) == "open"
            assert scalar(admin, "SELECT count(*) FROM organization_audit_log WHERE subject_id=%s AND action='opportunity.status_changed'", (str(opportunity_id),)) == 0
    finally:
        with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
            cur.execute("DROP TRIGGER IF EXISTS fail_opportunity_status_audit_for_test ON public.organization_audit_log")
            cur.execute("DROP FUNCTION IF EXISTS public.fail_opportunity_status_audit_for_test()")


def test_anon_and_public_have_no_command_execute():
    with psycopg2.connect(SUPER_DSN) as conn:
        signature = (
            "public.create_business_opportunity_v1(uuid, text, text, text, text, text[], "
            "public.business_opportunity_visibility, public.business_opportunity_lifecycle, "
            "timestamp with time zone, text)"
        )
        assert scalar(
            conn,
            """
            SELECT NOT EXISTS (
                SELECT 1 FROM pg_proc AS p,
                aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
                WHERE p.oid = %s::regprocedure AND acl.grantee = 0
                  AND acl.privilege_type = 'EXECUTE'
            )
            """,
            (signature,),
        ) is True
        if scalar(conn, "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')"):
            assert scalar(conn, "SELECT has_function_privilege('anon', %s, 'EXECUTE')", (signature,)) is False
