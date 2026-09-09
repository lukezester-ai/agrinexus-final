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


def create_intent(conn, *, org_id=ORG_A, lifecycle="draft", visibility="private", brief=None):
    return scalar(
        conn,
        """
        SELECT (public.create_business_intent_v1(
            %s, 'buy', 'Need packaging', 'Public-safe summary',
            'manufacturing', ARRAY['BG'], %s, %s, NULL, %s
        )).id
        """,
        (str(org_id), visibility, lifecycle, brief),
    )


def seed_intent_as_admin(*, lifecycle, created_by=OWNER):
    intent_id = uuid.uuid4()
    with psycopg2.connect(SUPER_DSN) as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO business_intents (
                id, organization_id, created_by, kind, headline,
                public_summary, industry, visibility, lifecycle
            ) VALUES (%s, %s, %s, 'buy', 'Lifecycle matrix', '',
                      'manufacturing', 'private', %s)
            """,
            (str(intent_id), str(ORG_A), str(created_by), lifecycle),
        )
    return intent_id


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
                (%s, %s, 'owner'),
                (%s, %s, 'admin'),
                (%s, %s, 'member'),
                (%s, %s, 'member'),
                (%s, %s, 'viewer'),
                (%s, %s, 'owner')
            """,
            (
                str(ORG_A), str(OWNER),
                str(ORG_A), str(ADMIN),
                str(ORG_A), str(MEMBER),
                str(ORG_A), str(OTHER_MEMBER),
                str(ORG_A), str(VIEWER),
                str(ORG_B), str(OTHER_OWNER),
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
def test_authorized_roles_create_atomically_with_audit(role_conn, actor):
    _, conn = role_conn
    set_user(conn, actor)
    intent_id = create_intent(conn, brief="Confidential requirements")

    assert scalar(conn, "SELECT count(*) FROM business_intents WHERE id=%s", (str(intent_id),)) == 1
    assert scalar(conn, "SELECT count(*) FROM business_intent_secrets WHERE intent_id=%s", (str(intent_id),)) == 1
    assert scalar(
        conn,
        """
        SELECT count(*) FROM organization_audit_log
        WHERE subject_id=%s AND action='intent.created'
          AND actor_user_id=%s AND details->>'lifecycle'='draft'
        """,
        (str(intent_id), str(actor)),
    ) == 1


@pytest.mark.parametrize("actor,org_id", ((VIEWER, ORG_A), (OUTSIDER, ORG_A), (OWNER, ORG_B)))
def test_unauthorized_create_is_denied(role_conn, actor, org_id):
    _, conn = role_conn
    set_user(conn, actor)
    with pytest.raises(psycopg2.Error):
        create_intent(conn, org_id=org_id)


def test_direct_mutations_are_revoked(role_conn):
    _, conn = role_conn
    set_user(conn, OWNER)
    with pytest.raises(psycopg2.Error):
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO business_intents
                    (organization_id, created_by, kind, headline, industry)
                VALUES (%s, %s, 'buy', 'Bypass', 'manufacturing')
                """,
                (str(ORG_A), str(OWNER)),
            )
    conn.rollback()
    set_user(conn, OWNER)
    intent_id = create_intent(conn)
    conn.commit()
    set_user(conn, OWNER)
    with pytest.raises(psycopg2.Error):
        with conn.cursor() as cur:
            cur.execute("UPDATE business_intents SET lifecycle='active' WHERE id=%s", (str(intent_id),))


def test_create_rolls_back_when_audit_fails(role_conn):
    _, conn = role_conn
    marker = f"rollback-{uuid.uuid4()}"
    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            """
            CREATE OR REPLACE FUNCTION public.fail_intent_audit_for_test()
            RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
            BEGIN
                IF NEW.action = 'intent.created' AND NEW.details->>'kind' = 'buy' THEN
                    RAISE EXCEPTION 'forced audit failure';
                END IF;
                RETURN NEW;
            END $$;
            DROP TRIGGER IF EXISTS fail_intent_audit_for_test ON public.organization_audit_log;
            CREATE TRIGGER fail_intent_audit_for_test
            BEFORE INSERT ON public.organization_audit_log
            FOR EACH ROW EXECUTE PROCEDURE public.fail_intent_audit_for_test();
            """
        )
    try:
        set_user(conn, OWNER)
        with pytest.raises(psycopg2.Error):
            scalar(
                conn,
                """
                SELECT (public.create_business_intent_v1(
                    %s, 'buy', %s, '', 'manufacturing', ARRAY['BG'],
                    'private', 'draft', NULL, 'secret'
                )).id
                """,
                (str(ORG_A), marker),
            )
        conn.rollback()
        with psycopg2.connect(SUPER_DSN) as admin:
            assert scalar(admin, "SELECT count(*) FROM business_intents WHERE headline=%s", (marker,)) == 0
    finally:
        with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
            cur.execute("DROP TRIGGER IF EXISTS fail_intent_audit_for_test ON public.organization_audit_log")
            cur.execute("DROP FUNCTION IF EXISTS public.fail_intent_audit_for_test()")


def test_visibility_contract_is_equivalent(role_conn):
    _, conn = role_conn
    set_user(conn, OWNER)
    private_id = create_intent(conn, lifecycle="active", visibility="private")
    public_id = create_intent(conn, lifecycle="active", visibility="public")
    draft_public_id = create_intent(conn, lifecycle="draft", visibility="public")
    conn.commit()

    set_user(conn, OUTSIDER)
    assert scalar(conn, "SELECT count(*) FROM business_intents WHERE id=%s", (str(private_id),)) == 0
    assert scalar(conn, "SELECT count(*) FROM business_intents WHERE id=%s", (str(public_id),)) == 1
    assert scalar(conn, "SELECT count(*) FROM business_intents WHERE id=%s", (str(draft_public_id),)) == 0


def test_allowed_transition_and_audit(role_conn):
    _, conn = role_conn
    set_user(conn, MEMBER)
    intent_id = create_intent(conn)
    conn.commit()

    set_user(conn, MEMBER)
    lifecycle = scalar(
        conn,
        "SELECT (public.transition_business_intent_v1(%s, 'active')).lifecycle",
        (str(intent_id),),
    )
    assert lifecycle == "active"
    assert scalar(
        conn,
        """
        SELECT count(*) FROM organization_audit_log
        WHERE subject_id=%s AND action='intent.status_changed'
          AND actor_user_id=%s AND details->>'from'='draft' AND details->>'to'='active'
        """,
        (str(intent_id), str(MEMBER)),
    ) == 1


def test_complete_allowed_transition_matrix(role_conn):
    _, conn = role_conn
    allowed = {
        "draft": ("active", "withdrawn"),
        "active": ("paused", "fulfilled", "withdrawn"),
        "paused": ("active", "fulfilled", "withdrawn"),
    }
    for current, targets in allowed.items():
        for target in targets:
            intent_id = seed_intent_as_admin(lifecycle=current)
            set_user(conn, OWNER)
            assert scalar(
                conn,
                "SELECT (public.transition_business_intent_v1(%s, %s)).lifecycle",
                (str(intent_id), target),
            ) == target
            conn.commit()


def test_lifecycle_matrix_is_exhaustive_and_deny_by_default(role_conn):
    _, conn = role_conn
    states = ("draft", "active", "paused", "matched", "introducing", "fulfilled", "expired", "withdrawn")
    allowed = {
        ("draft", "active"),
        ("draft", "withdrawn"),
        ("active", "paused"),
        ("active", "fulfilled"),
        ("active", "withdrawn"),
        ("paused", "active"),
        ("paused", "fulfilled"),
        ("paused", "withdrawn"),
    }
    for current in states:
        for target in states:
            if (current, target) in allowed:
                continue
            intent_id = seed_intent_as_admin(lifecycle=current)
            set_user(conn, OWNER)
            with pytest.raises(psycopg2.Error):
                scalar(
                    conn,
                    "SELECT public.transition_business_intent_v1(%s, %s)",
                    (str(intent_id), target),
                )
            conn.rollback()
            with psycopg2.connect(SUPER_DSN) as admin:
                assert scalar(
                    admin,
                    "SELECT lifecycle FROM business_intents WHERE id=%s",
                    (str(intent_id),),
                ) == current
                assert scalar(
                    admin,
                    """
                    SELECT count(*) FROM organization_audit_log
                    WHERE subject_id=%s AND action='intent.status_changed'
                    """,
                    (str(intent_id),),
                ) == 0


@pytest.mark.parametrize("target", ("draft", "matched", "introducing", "expired", "fulfilled"))
def test_forbidden_member_transitions_write_no_audit(role_conn, target):
    _, conn = role_conn
    set_user(conn, MEMBER)
    intent_id = create_intent(conn)
    conn.commit()

    set_user(conn, MEMBER)
    with pytest.raises(psycopg2.Error):
        scalar(
            conn,
            "SELECT (public.transition_business_intent_v1(%s, %s)).lifecycle",
            (str(intent_id), target),
        )
    conn.rollback()
    with psycopg2.connect(SUPER_DSN) as admin:
        assert scalar(
            admin,
            "SELECT count(*) FROM organization_audit_log WHERE subject_id=%s AND action='intent.status_changed'",
            (str(intent_id),),
        ) == 0


def test_member_cannot_transition_another_members_intent(role_conn):
    _, conn = role_conn
    set_user(conn, MEMBER)
    intent_id = create_intent(conn)
    conn.commit()
    set_user(conn, OTHER_MEMBER)
    with pytest.raises(psycopg2.Error):
        scalar(conn, "SELECT public.transition_business_intent_v1(%s, 'active')", (str(intent_id),))


def test_owner_can_fulfill_and_viewer_cannot_transition(role_conn):
    _, conn = role_conn
    set_user(conn, MEMBER)
    intent_id = create_intent(conn, lifecycle="active")
    conn.commit()

    set_user(conn, VIEWER)
    with pytest.raises(psycopg2.Error):
        scalar(conn, "SELECT public.transition_business_intent_v1(%s, 'paused')", (str(intent_id),))
    conn.rollback()

    set_user(conn, OWNER)
    assert scalar(
        conn,
        "SELECT (public.transition_business_intent_v1(%s, 'fulfilled')).lifecycle",
        (str(intent_id),),
    ) == "fulfilled"


def test_transition_rolls_back_when_audit_fails(role_conn):
    _, conn = role_conn
    set_user(conn, OWNER)
    intent_id = create_intent(conn, lifecycle="active")
    conn.commit()
    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            """
            CREATE OR REPLACE FUNCTION public.fail_intent_status_audit_for_test()
            RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
            BEGIN
                IF NEW.action = 'intent.status_changed' THEN
                    RAISE EXCEPTION 'forced status audit failure';
                END IF;
                RETURN NEW;
            END $$;
            DROP TRIGGER IF EXISTS fail_intent_status_audit_for_test ON public.organization_audit_log;
            CREATE TRIGGER fail_intent_status_audit_for_test
            BEFORE INSERT ON public.organization_audit_log
            FOR EACH ROW EXECUTE PROCEDURE public.fail_intent_status_audit_for_test();
            """
        )
    try:
        set_user(conn, OWNER)
        with pytest.raises(psycopg2.Error):
            scalar(conn, "SELECT public.transition_business_intent_v1(%s, 'paused')", (str(intent_id),))
        conn.rollback()
        with psycopg2.connect(SUPER_DSN) as admin:
            assert scalar(
                admin,
                "SELECT lifecycle FROM business_intents WHERE id=%s",
                (str(intent_id),),
            ) == "active"
            assert scalar(
                admin,
                """
                SELECT count(*) FROM organization_audit_log
                WHERE subject_id=%s AND action='intent.status_changed'
                """,
                (str(intent_id),),
            ) == 0
    finally:
        with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
            cur.execute("DROP TRIGGER IF EXISTS fail_intent_status_audit_for_test ON public.organization_audit_log")
            cur.execute("DROP FUNCTION IF EXISTS public.fail_intent_status_audit_for_test()")


def test_anon_and_public_have_no_command_execute():
    with psycopg2.connect(SUPER_DSN) as conn:
        signature = (
            "public.create_business_intent_v1(uuid, public.business_intent_kind, text, text, text, "
            "text[], public.business_intent_visibility, public.business_intent_lifecycle, timestamp with time zone, text)"
        )
        assert scalar(
            conn,
            """
            SELECT NOT EXISTS (
                SELECT 1
                FROM pg_proc AS p,
                     aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
                WHERE p.oid = %s::regprocedure
                  AND acl.grantee = 0
                  AND acl.privilege_type = 'EXECUTE'
            )
            """,
            (signature,),
        ) is True
        if scalar(conn, "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon')"):
            assert scalar(conn, "SELECT has_function_privilege('anon', %s, 'EXECUTE')", (signature,)) is False
