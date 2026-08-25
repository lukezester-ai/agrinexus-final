import os
import re
import uuid

import psycopg2
import psycopg2.extras
import pytest
from psycopg2 import errors

SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
APP_DSN = os.environ.get("DB_URL_APPUSER")

USER_A = uuid.UUID("11111111-1111-1111-1111-111111111111")
USER_B = uuid.UUID("22222222-2222-2222-2222-222222222222")
USER_C = uuid.UUID("33333333-3333-3333-3333-333333333333")
USER_D = uuid.UUID("44444444-4444-4444-4444-444444444444")
USER_E = uuid.UUID("55555555-5555-5555-5555-555555555555")
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
            "INSERT INTO organization_memberships (organization_id, user_id, role) VALUES (%s,%s,'owner'),(%s,%s,'admin'),(%s,%s,'member'),(%s,%s,'viewer'),(%s,%s,'owner')",
            (str(ORG_A), str(USER_A), str(ORG_A), str(USER_E), str(ORG_A), str(USER_B), str(ORG_A), str(USER_D), str(ORG_B), str(USER_C)),
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


@pytest.fixture
def super_conn():
    conn = psycopg2.connect(SUPER_DSN)
    conn.autocommit = True
    try:
        yield conn
    finally:
        with conn.cursor() as cur:
            cur.execute("RESET ROLE")
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


def _insert_intent(conn, *, intent_id, org_id, user_id, visibility, lifecycle, expires_at=None, kind="buy"):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO business_intents (
                id, organization_id, created_by, kind, headline, public_summary,
                industry, target_markets, visibility, lifecycle, expires_at
            ) VALUES (
                %s, %s, %s, %s, 'Headline', 'Public-safe summary',
                'manufacturing', ARRAY['BG'], %s, %s, %s
            )
            """,
            (str(intent_id), str(org_id), str(user_id), kind, visibility, lifecycle, expires_at),
        )


def _index_has(super_conn, intent_id):
    with super_conn.cursor() as cur:
        try:
            cur.execute("SET ROLE intent_matcher")
            cur.execute(
                "SELECT count(*) FROM public.business_intent_match_index WHERE intent_id=%s",
                (str(intent_id),),
            )
            return cur.fetchone()[0] == 1
        finally:
            cur.execute("RESET ROLE")


def test_owner_admin_member_can_insert_intent_viewer_cannot(app_conn):
    as_user(app_conn, USER_A)
    _insert_intent(app_conn, intent_id=uuid.uuid4(), org_id=ORG_A, user_id=USER_A, visibility="private", lifecycle="draft")
    as_user(app_conn, USER_E)
    _insert_intent(app_conn, intent_id=uuid.uuid4(), org_id=ORG_A, user_id=USER_E, visibility="private", lifecycle="draft")
    as_user(app_conn, USER_B)
    _insert_intent(app_conn, intent_id=uuid.uuid4(), org_id=ORG_A, user_id=USER_B, visibility="private", lifecycle="draft")
    as_user(app_conn, USER_D)
    with pytest.raises(errors.InsufficientPrivilege), app_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO business_intents (
                organization_id, created_by, kind, headline, industry, visibility, lifecycle
            ) VALUES (%s, %s, 'buy', 'Viewer intent', 'manufacturing', 'private', 'draft')
            """,
            (str(ORG_A), str(USER_D)),
        )


def test_outsider_cannot_insert_or_read_private_intent(app_conn):
    intent_id = uuid.uuid4()
    as_user(app_conn, USER_A)
    _insert_intent(app_conn, intent_id=intent_id, org_id=ORG_A, user_id=USER_A, visibility="private", lifecycle="active")
    app_conn.commit()
    as_user(app_conn, USER_C)
    assert scalar(app_conn, "SELECT count(*) FROM business_intents WHERE id=%s", (str(intent_id),)) == 0
    with pytest.raises(errors.InsufficientPrivilege), app_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO business_intents (
                organization_id, created_by, kind, headline, industry, visibility, lifecycle
            ) VALUES (%s, %s, 'buy', 'Spoof org', 'manufacturing', 'private', 'draft')
            """,
            (str(ORG_A), str(USER_C)),
        )


def test_cannot_spoof_created_by_or_organization_id(app_conn):
    as_user(app_conn, USER_B)
    with pytest.raises(errors.InsufficientPrivilege), app_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO business_intents (
                organization_id, created_by, kind, headline, industry, visibility, lifecycle
            ) VALUES (%s, %s, 'buy', 'Spoof creator', 'manufacturing', 'private', 'draft')
            """,
            (str(ORG_A), str(USER_A)),
        )
    app_conn.rollback()
    as_user(app_conn, USER_B)
    with pytest.raises(errors.InsufficientPrivilege), app_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO business_intents (
                organization_id, created_by, kind, headline, industry, visibility, lifecycle
            ) VALUES (%s, %s, 'buy', 'Spoof org id', 'manufacturing', 'private', 'draft')
            """,
            (str(ORG_B), str(USER_B)),
        )


def test_cannot_mutate_identity_columns(app_conn):
    intent_id = uuid.uuid4()
    as_user(app_conn, USER_A)
    _insert_intent(app_conn, intent_id=intent_id, org_id=ORG_A, user_id=USER_A, visibility="private", lifecycle="draft")
    with pytest.raises(Exception), app_conn.cursor() as cur:
        cur.execute(
            "UPDATE business_intents SET organization_id=%s WHERE id=%s",
            (str(ORG_B), str(intent_id)),
        )


def test_confidential_intent_hidden_from_other_org(app_conn, super_conn):
    intent_id = uuid.uuid4()
    as_user(app_conn, USER_A)
    _insert_intent(
        app_conn,
        intent_id=intent_id,
        org_id=ORG_A,
        user_id=USER_A,
        visibility="confidential",
        lifecycle="active",
    )
    app_conn.commit()
    as_user(app_conn, USER_A)
    assert scalar(app_conn, "SELECT count(*) FROM business_intents WHERE id=%s", (str(intent_id),)) == 1
    as_user(app_conn, USER_D)
    assert scalar(app_conn, "SELECT count(*) FROM business_intents WHERE id=%s", (str(intent_id),)) == 1
    as_user(app_conn, USER_C)
    assert scalar(app_conn, "SELECT count(*) FROM business_intents WHERE id=%s", (str(intent_id),)) == 0
    assert _index_has(super_conn, intent_id) is True


def test_private_intent_not_in_match_index(app_conn, super_conn):
    intent_id = uuid.uuid4()
    as_user(app_conn, USER_A)
    _insert_intent(app_conn, intent_id=intent_id, org_id=ORG_A, user_id=USER_A, visibility="private", lifecycle="active")
    app_conn.commit()
    assert _index_has(super_conn, intent_id) is False
    as_user(app_conn, USER_C)
    assert scalar(app_conn, "SELECT count(*) FROM business_intents WHERE id=%s", (str(intent_id),)) == 0


def test_network_and_public_visible_only_when_active_and_unexpired(app_conn, super_conn):
    live_public = uuid.uuid4()
    live_network = uuid.uuid4()
    draft_public = uuid.uuid4()
    paused_network = uuid.uuid4()
    expired_public = uuid.uuid4()
    as_user(app_conn, USER_A)
    _insert_intent(app_conn, intent_id=live_public, org_id=ORG_A, user_id=USER_A, visibility="public", lifecycle="active")
    _insert_intent(app_conn, intent_id=live_network, org_id=ORG_A, user_id=USER_A, visibility="network", lifecycle="active")
    _insert_intent(app_conn, intent_id=draft_public, org_id=ORG_A, user_id=USER_A, visibility="public", lifecycle="draft")
    _insert_intent(app_conn, intent_id=paused_network, org_id=ORG_A, user_id=USER_A, visibility="network", lifecycle="paused")
    _insert_intent(app_conn, intent_id=expired_public, org_id=ORG_A, user_id=USER_A, visibility="public", lifecycle="active")
    app_conn.commit()

    with super_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE public.business_intents
            SET created_at = now() - interval '2 hours',
                expires_at = now() - interval '1 minute'
            WHERE id = %s
            """,
            (str(expired_public),),
        )

    as_user(app_conn, USER_C)
    assert scalar(app_conn, "SELECT count(*) FROM business_intents WHERE id=%s", (str(live_public),)) == 1
    assert scalar(app_conn, "SELECT count(*) FROM business_intents WHERE id=%s", (str(live_network),)) == 1
    assert scalar(app_conn, "SELECT count(*) FROM business_intents WHERE id=%s", (str(draft_public),)) == 0
    assert scalar(app_conn, "SELECT count(*) FROM business_intents WHERE id=%s", (str(paused_network),)) == 0
    assert scalar(app_conn, "SELECT count(*) FROM business_intents WHERE id=%s", (str(expired_public),)) == 0
    assert _index_has(super_conn, live_public) is True
    assert _index_has(super_conn, live_network) is True
    assert _index_has(super_conn, draft_public) is False
    assert _index_has(super_conn, paused_network) is False
    assert _index_has(super_conn, expired_public) is False


def test_intent_secrets_are_org_only(app_conn):
    intent_id = uuid.uuid4()
    as_user(app_conn, USER_A)
    _insert_intent(app_conn, intent_id=intent_id, org_id=ORG_A, user_id=USER_A, visibility="public", lifecycle="active", kind="partner")
    with app_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO business_intent_secrets (intent_id, organization_id, private_brief) VALUES (%s, %s, 'Reserve price 12.4')",
            (str(intent_id), str(ORG_A)),
        )
    app_conn.commit()
    as_user(app_conn, USER_C)
    assert scalar(app_conn, "SELECT count(*) FROM business_intent_secrets WHERE intent_id=%s", (str(intent_id),)) == 0


def test_match_index_not_readable_or_executable_by_app_user(app_conn, super_conn):
    as_user(app_conn, USER_A)
    _insert_intent(
        app_conn,
        intent_id=uuid.uuid4(),
        org_id=ORG_A,
        user_id=USER_A,
        visibility="confidential",
        lifecycle="active",
    )
    app_conn.commit()
    with pytest.raises(errors.InsufficientPrivilege), app_conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM business_intent_match_index")
    assert scalar(
        super_conn,
        "SELECT has_table_privilege('app_user', 'public.business_intent_match_index', 'SELECT')",
    ) is False
    assert scalar(
        super_conn,
        "SELECT has_function_privilege('app_user', 'public.sync_business_intent_match_index()', 'EXECUTE')",
    ) is False
    with super_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(proacl::text, ''), COALESCE(proconfig, ARRAY[]::text[])
            FROM pg_proc
            WHERE proname = 'sync_business_intent_match_index'
              AND pronamespace = 'public'::regnamespace
            """
        )
        acl, configs = cur.fetchone()
    assert not re.search(r"(^|[,{])=X/", acl)
    assert "app_user=X" not in acl
    assert any(
        item.startswith("search_path=") and item.split("=", 1)[1].strip("\"'") == ""
        for item in configs
    )


def _insert_opportunity(
    conn,
    *,
    opportunity_id,
    org_id,
    user_id,
    visibility,
    lifecycle,
    source_type="manual",
    source_ref="ui",
    external_origin=None,
    facets=None,
    provenance=None,
):
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO business_opportunities (
                id, organization_id, created_by, source_type, source_ref, external_origin,
                title, summary, industry, target_markets, visibility, lifecycle, facets, provenance
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                'Opportunity title', 'Public-safe summary',
                'manufacturing', ARRAY['BG'], %s, %s, %s, %s
            )
            """,
            (
                str(opportunity_id),
                str(org_id) if org_id is not None else None,
                str(user_id) if user_id is not None else None,
                source_type,
                source_ref,
                external_origin,
                visibility,
                lifecycle,
                psycopg2.extras.Json(facets or {}),
                psycopg2.extras.Json(provenance or {}),
            ),
        )


def _opportunity_index_has(super_conn, opportunity_id):
    with super_conn.cursor() as cur:
        try:
            cur.execute("SET ROLE intent_matcher")
            cur.execute(
                "SELECT count(*) FROM public.business_opportunity_match_index WHERE opportunity_id=%s",
                (str(opportunity_id),),
            )
            return cur.fetchone()[0] == 1
        finally:
            cur.execute("RESET ROLE")


def test_opportunity_has_no_score_column(super_conn):
    assert (
        scalar(
            super_conn,
            """
            SELECT count(*) FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'business_opportunities'
              AND column_name IN ('score', 'match_score', 'matchScore')
            """,
        )
        == 0
    )


def test_owner_can_insert_manual_opportunity_viewer_cannot(app_conn):
    as_user(app_conn, USER_A)
    _insert_opportunity(
        app_conn,
        opportunity_id=uuid.uuid4(),
        org_id=ORG_A,
        user_id=USER_A,
        visibility="private",
        lifecycle="draft",
    )
    as_user(app_conn, USER_D)
    with pytest.raises(errors.InsufficientPrivilege), app_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO business_opportunities (
                organization_id, created_by, source_type, title, industry, visibility, lifecycle
            ) VALUES (%s, %s, 'manual', 'Viewer opp', 'manufacturing', 'private', 'draft')
            """,
            (str(ORG_A), str(USER_D)),
        )


def test_app_user_cannot_insert_system_discovered_opportunity(app_conn):
    as_user(app_conn, USER_A)
    with pytest.raises(errors.InsufficientPrivilege), app_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO business_opportunities (
                organization_id, created_by, source_type, source_ref, title, industry, visibility, lifecycle
            ) VALUES (%s, %s, 'system_discovery', 'job:1', 'Discovered', 'energy', 'confidential', 'open')
            """,
            (str(ORG_A), str(USER_A)),
        )


def test_opportunity_facets_reject_match_score(app_conn):
    as_user(app_conn, USER_A)
    with pytest.raises(errors.CheckViolation), app_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO business_opportunities (
                organization_id, created_by, source_type, title, industry, visibility, lifecycle, facets
            ) VALUES (%s, %s, 'manual', 'Scored opp', 'manufacturing', 'private', 'draft', '{"match_score": 0.9}'::jsonb)
            """,
            (str(ORG_A), str(USER_A)),
        )


def test_cannot_spoof_opportunity_org_or_creator(app_conn):
    as_user(app_conn, USER_B)
    with pytest.raises(errors.InsufficientPrivilege), app_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO business_opportunities (
                organization_id, created_by, source_type, title, industry, visibility, lifecycle
            ) VALUES (%s, %s, 'manual', 'Spoof creator', 'manufacturing', 'private', 'draft')
            """,
            (str(ORG_A), str(USER_A)),
        )
    app_conn.rollback()
    as_user(app_conn, USER_B)
    with pytest.raises(errors.InsufficientPrivilege), app_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO business_opportunities (
                organization_id, created_by, source_type, title, industry, visibility, lifecycle
            ) VALUES (%s, %s, 'manual', 'Spoof org', 'manufacturing', 'private', 'draft')
            """,
            (str(ORG_B), str(USER_B)),
        )


def test_opportunity_provenance_origin_is_immutable(app_conn):
    opportunity_id = uuid.uuid4()
    as_user(app_conn, USER_A)
    _insert_opportunity(
        app_conn,
        opportunity_id=opportunity_id,
        org_id=ORG_A,
        user_id=USER_A,
        visibility="private",
        lifecycle="draft",
        source_ref="ui:form",
    )
    with pytest.raises(Exception), app_conn.cursor() as cur:
        cur.execute(
            "UPDATE business_opportunities SET source_ref='tampered' WHERE id=%s",
            (str(opportunity_id),),
        )


def test_confidential_opportunity_hidden_from_other_org(app_conn, super_conn):
    opportunity_id = uuid.uuid4()
    as_user(app_conn, USER_A)
    _insert_opportunity(
        app_conn,
        opportunity_id=opportunity_id,
        org_id=ORG_A,
        user_id=USER_A,
        visibility="confidential",
        lifecycle="open",
        facets={"kind": "sell"},
        provenance={"recorded_by": str(USER_A)},
    )
    app_conn.commit()
    as_user(app_conn, USER_C)
    assert scalar(app_conn, "SELECT count(*) FROM business_opportunities WHERE id=%s", (str(opportunity_id),)) == 0
    assert _opportunity_index_has(super_conn, opportunity_id) is True


def test_private_opportunity_not_in_match_index(app_conn, super_conn):
    opportunity_id = uuid.uuid4()
    as_user(app_conn, USER_A)
    _insert_opportunity(
        app_conn,
        opportunity_id=opportunity_id,
        org_id=ORG_A,
        user_id=USER_A,
        visibility="private",
        lifecycle="open",
    )
    app_conn.commit()
    assert _opportunity_index_has(super_conn, opportunity_id) is False
    as_user(app_conn, USER_C)
    assert scalar(app_conn, "SELECT count(*) FROM business_opportunities WHERE id=%s", (str(opportunity_id),)) == 0


def test_network_public_opportunity_visible_only_when_open_and_unexpired(app_conn, super_conn):
    live_public = uuid.uuid4()
    draft_public = uuid.uuid4()
    expired_network = uuid.uuid4()
    as_user(app_conn, USER_A)
    _insert_opportunity(app_conn, opportunity_id=live_public, org_id=ORG_A, user_id=USER_A, visibility="public", lifecycle="open")
    _insert_opportunity(app_conn, opportunity_id=draft_public, org_id=ORG_A, user_id=USER_A, visibility="public", lifecycle="draft")
    _insert_opportunity(app_conn, opportunity_id=expired_network, org_id=ORG_A, user_id=USER_A, visibility="network", lifecycle="open")
    app_conn.commit()
    with super_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE public.business_opportunities
            SET created_at = now() - interval '2 hours',
                expires_at = now() - interval '1 minute'
            WHERE id = %s
            """,
            (str(expired_network),),
        )
    as_user(app_conn, USER_C)
    assert scalar(app_conn, "SELECT count(*) FROM business_opportunities WHERE id=%s", (str(live_public),)) == 1
    assert scalar(app_conn, "SELECT count(*) FROM business_opportunities WHERE id=%s", (str(draft_public),)) == 0
    assert scalar(app_conn, "SELECT count(*) FROM business_opportunities WHERE id=%s", (str(expired_network),)) == 0
    assert _opportunity_index_has(super_conn, live_public) is True
    assert _opportunity_index_has(super_conn, draft_public) is False
    assert _opportunity_index_has(super_conn, expired_network) is False


def test_external_confidential_opportunity_is_index_only_for_app_user(super_conn, app_conn):
    opportunity_id = uuid.uuid4()
    with super_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO public.business_opportunities (
                id, organization_id, created_by, source_type, source_ref, external_origin,
                title, industry, visibility, lifecycle, facets, provenance
            ) VALUES (
                %s, NULL, NULL, 'external_signal', 'feed:77', 'market-wire',
                'External opening', 'logistics', 'confidential', 'open',
                '{"kind":"buy"}'::jsonb, '{"ingested_from":"market-wire"}'::jsonb
            )
            """,
            (str(opportunity_id),),
        )
    as_user(app_conn, USER_A)
    assert scalar(app_conn, "SELECT count(*) FROM business_opportunities WHERE id=%s", (str(opportunity_id),)) == 0
    assert _opportunity_index_has(super_conn, opportunity_id) is True


def test_opportunity_secrets_are_org_only(app_conn):
    opportunity_id = uuid.uuid4()
    as_user(app_conn, USER_A)
    _insert_opportunity(
        app_conn,
        opportunity_id=opportunity_id,
        org_id=ORG_A,
        user_id=USER_A,
        visibility="public",
        lifecycle="open",
    )
    with app_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO business_opportunity_secrets (opportunity_id, organization_id, private_brief) VALUES (%s, %s, 'Internal reserve')",
            (str(opportunity_id), str(ORG_A)),
        )
    app_conn.commit()
    as_user(app_conn, USER_C)
    assert scalar(app_conn, "SELECT count(*) FROM business_opportunity_secrets WHERE opportunity_id=%s", (str(opportunity_id),)) == 0


def test_opportunity_match_index_not_readable_or_executable_by_app_user(app_conn, super_conn):
    as_user(app_conn, USER_A)
    _insert_opportunity(
        app_conn,
        opportunity_id=uuid.uuid4(),
        org_id=ORG_A,
        user_id=USER_A,
        visibility="confidential",
        lifecycle="open",
    )
    app_conn.commit()
    with pytest.raises(errors.InsufficientPrivilege), app_conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM business_opportunity_match_index")
    assert scalar(
        super_conn,
        "SELECT has_table_privilege('app_user', 'public.business_opportunity_match_index', 'SELECT')",
    ) is False
    assert scalar(
        super_conn,
        "SELECT has_function_privilege('app_user', 'public.sync_business_opportunity_match_index()', 'EXECUTE')",
    ) is False
    with super_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(proacl::text, ''), COALESCE(proconfig, ARRAY[]::text[])
            FROM pg_proc
            WHERE proname = 'sync_business_opportunity_match_index'
              AND pronamespace = 'public'::regnamespace
            """
        )
        acl, configs = cur.fetchone()
    assert not re.search(r"(^|[,{])=X/", acl)
    assert "app_user=X" not in acl
    assert any(
        item.startswith("search_path=") and item.split("=", 1)[1].strip("\"'") == ""
        for item in configs
    )


def _insert_match(super_conn, *, match_id, intent_id, opportunity_id, score=0.72, confidence=0.4, version="1"):
    with super_conn.cursor() as cur:
        try:
            cur.execute("SET ROLE intent_matcher")
            cur.execute(
                """
                INSERT INTO public.business_matches (
                    id, intent_id, opportunity_id, matcher_engine, matcher_version,
                    score, confidence, reasons, explanation
                ) VALUES (
                    %s, %s, %s, 'core-matcher', %s,
                    %s, %s, '[{"code":"industry"}]'::jsonb, 'Industry overlap'
                )
                """,
                (str(match_id), str(intent_id), str(opportunity_id), version, score, confidence),
            )
        finally:
            cur.execute("RESET ROLE")


def test_match_row_has_no_business_payload_columns(super_conn):
    assert (
        scalar(
            super_conn,
            """
            SELECT count(*) FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'business_matches'
              AND column_name IN (
                'headline', 'title', 'summary', 'industry', 'target_markets',
                'private_brief', 'public_summary', 'facets'
              )
            """,
        )
        == 0
    )


def test_app_user_cannot_insert_or_write_match_score(app_conn, super_conn):
    intent_id = uuid.uuid4()
    opportunity_id = uuid.uuid4()
    match_id = uuid.uuid4()
    as_user(app_conn, USER_A)
    _insert_intent(app_conn, intent_id=intent_id, org_id=ORG_A, user_id=USER_A, visibility="network", lifecycle="active")
    _insert_opportunity(app_conn, opportunity_id=opportunity_id, org_id=ORG_A, user_id=USER_A, visibility="network", lifecycle="open")
    app_conn.commit()
    as_user(app_conn, USER_A)
    with pytest.raises(errors.InsufficientPrivilege), app_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO business_matches (
                intent_id, opportunity_id, matcher_engine, matcher_version, score, confidence
            ) VALUES (%s, %s, 'spoof', '1', 0.99, 0.99)
            """,
            (str(intent_id), str(opportunity_id)),
        )
    app_conn.rollback()
    _insert_match(super_conn, match_id=match_id, intent_id=intent_id, opportunity_id=opportunity_id)
    as_user(app_conn, USER_A)
    with pytest.raises(Exception), app_conn.cursor() as cur:
        cur.execute("UPDATE business_matches SET score = 0.01 WHERE id=%s", (str(match_id),))
    app_conn.rollback()
    as_user(app_conn, USER_A)
    with app_conn.cursor() as cur:
        cur.execute("UPDATE business_matches SET lifecycle = 'dismissed' WHERE id=%s", (str(match_id),))
        assert cur.rowcount == 1
    assert float(scalar(app_conn, "SELECT score FROM business_matches WHERE id=%s", (str(match_id),))) == 0.72


def test_match_uniqueness_and_score_range(super_conn, app_conn):
    intent_id = uuid.uuid4()
    opportunity_id = uuid.uuid4()
    as_user(app_conn, USER_A)
    _insert_intent(app_conn, intent_id=intent_id, org_id=ORG_A, user_id=USER_A, visibility="public", lifecycle="active")
    _insert_opportunity(app_conn, opportunity_id=opportunity_id, org_id=ORG_A, user_id=USER_A, visibility="public", lifecycle="open")
    app_conn.commit()
    _insert_match(super_conn, match_id=uuid.uuid4(), intent_id=intent_id, opportunity_id=opportunity_id, version="1")
    with pytest.raises(errors.UniqueViolation):
        _insert_match(super_conn, match_id=uuid.uuid4(), intent_id=intent_id, opportunity_id=opportunity_id, version="1")
    with pytest.raises(errors.CheckViolation):
        _insert_match(
            super_conn,
            match_id=uuid.uuid4(),
            intent_id=intent_id,
            opportunity_id=opportunity_id,
            score=1.2,
            version="2",
        )
    _insert_match(
        super_conn,
        match_id=uuid.uuid4(),
        intent_id=intent_id,
        opportunity_id=opportunity_id,
        score=0.2,
        confidence=0.9,
        version="2",
    )
    assert (
        scalar(
            super_conn,
            "SELECT count(*) FROM business_matches WHERE intent_id=%s AND opportunity_id=%s",
            (str(intent_id), str(opportunity_id)),
        )
        == 2
    )


def test_confidential_sides_do_not_leak_through_match(app_conn, super_conn):
    intent_id = uuid.uuid4()
    opportunity_id = uuid.uuid4()
    match_id = uuid.uuid4()
    as_user(app_conn, USER_A)
    _insert_intent(
        app_conn,
        intent_id=intent_id,
        org_id=ORG_A,
        user_id=USER_A,
        visibility="confidential",
        lifecycle="active",
    )
    app_conn.commit()
    as_user(app_conn, USER_C)
    _insert_opportunity(
        app_conn,
        opportunity_id=opportunity_id,
        org_id=ORG_B,
        user_id=USER_C,
        visibility="confidential",
        lifecycle="open",
    )
    app_conn.commit()
    _insert_match(super_conn, match_id=match_id, intent_id=intent_id, opportunity_id=opportunity_id)
    as_user(app_conn, USER_A)
    assert scalar(app_conn, "SELECT count(*) FROM business_matches WHERE id=%s", (str(match_id),)) == 1
    assert scalar(app_conn, "SELECT count(*) FROM business_opportunities WHERE id=%s", (str(opportunity_id),)) == 0
    as_user(app_conn, USER_C)
    assert scalar(app_conn, "SELECT count(*) FROM business_matches WHERE id=%s", (str(match_id),)) == 1
    assert scalar(app_conn, "SELECT count(*) FROM business_intents WHERE id=%s", (str(intent_id),)) == 0
    as_user(app_conn, USER_D)
    assert scalar(app_conn, "SELECT count(*) FROM business_matches WHERE id=%s", (str(match_id),)) == 1
    as_user(app_conn, USER_C)
    with app_conn.cursor() as cur:
        cur.execute("UPDATE business_matches SET lifecycle = 'qualified' WHERE id=%s", (str(match_id),))
        assert cur.rowcount == 0
    as_user(app_conn, USER_D)
    with app_conn.cursor() as cur:
        cur.execute("UPDATE business_matches SET lifecycle = 'qualified' WHERE id=%s", (str(match_id),))
        assert cur.rowcount == 0


def test_match_guard_function_is_locked_from_app_user(super_conn):
    assert scalar(
        super_conn,
        "SELECT has_table_privilege('app_user', 'public.business_matches', 'INSERT')",
    ) is False
    assert scalar(
        super_conn,
        "SELECT has_function_privilege('app_user', 'public.tg_business_match_guard()', 'EXECUTE')",
    ) is False
    with super_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(proacl::text, ''), COALESCE(proconfig, ARRAY[]::text[])
            FROM pg_proc
            WHERE proname = 'tg_business_match_guard'
              AND pronamespace = 'public'::regnamespace
            """
        )
        acl, configs = cur.fetchone()
    assert not re.search(r"(^|[,{])=X/", acl)
    assert "app_user=X" not in acl
    assert any(
        item.startswith("search_path=") and item.split("=", 1)[1].strip("\"'") == ""
        for item in configs
    )


def _run_engine(super_conn):
    with super_conn.cursor() as cur:
        try:
            cur.execute("SET ROLE intent_matcher")
            cur.execute("SELECT public.run_matching_engine_v1()")
            return cur.fetchone()[0]
        finally:
            cur.execute("RESET ROLE")


def test_engine_writes_candidate_not_qualified(app_conn, super_conn):
    intent_id = uuid.uuid4()
    opportunity_id = uuid.uuid4()
    as_user(app_conn, USER_A)
    _insert_intent(
        app_conn,
        intent_id=intent_id,
        org_id=ORG_A,
        user_id=USER_A,
        visibility="network",
        lifecycle="active",
        kind="buy",
    )
    app_conn.commit()
    as_user(app_conn, USER_C)
    _insert_opportunity(
        app_conn,
        opportunity_id=opportunity_id,
        org_id=ORG_B,
        user_id=USER_C,
        visibility="network",
        lifecycle="open",
        facets={"kind": "sell"},
    )
    app_conn.commit()
    written = _run_engine(super_conn)
    assert written >= 1
    with super_conn.cursor() as cur:
        cur.execute(
            """
            SELECT score, confidence, lifecycle, matcher_engine, matcher_version, reasons, explanation
            FROM public.business_matches
            WHERE intent_id=%s AND opportunity_id=%s
            """,
            (str(intent_id), str(opportunity_id)),
        )
        row = cur.fetchone()
    assert row is not None
    score, confidence, lifecycle, engine, version, reasons, explanation = row
    assert lifecycle == "candidate"
    assert engine == "deterministic-v1"
    assert version == "1"
    assert 0.35 <= float(score) <= 1
    assert 0 <= float(confidence) <= 1
    assert any(item.get("code") == "kind_compatibility" for item in reasons)
    assert explanation.startswith("deterministic-v1/1:")
    as_user(app_conn, USER_A)
    with pytest.raises(errors.InsufficientPrivilege), app_conn.cursor() as cur:
        cur.execute("SELECT public.run_matching_engine_v1()")


def test_engine_skips_same_org_and_incompatible_kind(app_conn, super_conn):
    buy_id = uuid.uuid4()
    self_opp = uuid.uuid4()
    hire_opp = uuid.uuid4()
    as_user(app_conn, USER_A)
    _insert_intent(app_conn, intent_id=buy_id, org_id=ORG_A, user_id=USER_A, visibility="public", lifecycle="active", kind="buy")
    _insert_opportunity(
        app_conn,
        opportunity_id=self_opp,
        org_id=ORG_A,
        user_id=USER_A,
        visibility="public",
        lifecycle="open",
        facets={"kind": "sell"},
    )
    app_conn.commit()
    as_user(app_conn, USER_C)
    _insert_opportunity(
        app_conn,
        opportunity_id=hire_opp,
        org_id=ORG_B,
        user_id=USER_C,
        visibility="public",
        lifecycle="open",
        facets={"kind": "hire"},
    )
    app_conn.commit()
    _run_engine(super_conn)
    assert (
        scalar(
            super_conn,
            "SELECT count(*) FROM business_matches WHERE intent_id=%s AND opportunity_id=%s",
            (str(buy_id), str(self_opp)),
        )
        == 0
    )
    assert (
        scalar(
            super_conn,
            "SELECT count(*) FROM business_matches WHERE intent_id=%s AND opportunity_id=%s",
            (str(buy_id), str(hire_opp)),
        )
        == 0
    )


def test_engine_does_not_override_domain_lifecycle(app_conn, super_conn):
    intent_id = uuid.uuid4()
    opportunity_id = uuid.uuid4()
    as_user(app_conn, USER_A)
    _insert_intent(app_conn, intent_id=intent_id, org_id=ORG_A, user_id=USER_A, visibility="public", lifecycle="active", kind="buy")
    app_conn.commit()
    as_user(app_conn, USER_C)
    _insert_opportunity(
        app_conn,
        opportunity_id=opportunity_id,
        org_id=ORG_B,
        user_id=USER_C,
        visibility="public",
        lifecycle="open",
        facets={"kind": "sell"},
    )
    app_conn.commit()
    _run_engine(super_conn)
    as_user(app_conn, USER_A)
    with app_conn.cursor() as cur:
        cur.execute(
            """
            UPDATE business_matches
            SET lifecycle = 'qualified'
            WHERE intent_id=%s AND opportunity_id=%s
            """,
            (str(intent_id), str(opportunity_id)),
        )
        assert cur.rowcount == 1
    app_conn.commit()
    _run_engine(super_conn)
    assert (
        scalar(
            super_conn,
            "SELECT lifecycle FROM business_matches WHERE intent_id=%s AND opportunity_id=%s",
            (str(intent_id), str(opportunity_id)),
        )
        == "qualified"
    )


def test_engine_execute_and_search_path_locked(super_conn):
    assert scalar(
        super_conn,
        "SELECT has_function_privilege('app_user', 'public.run_matching_engine_v1()', 'EXECUTE')",
    ) is False
    with super_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(proacl::text, ''), COALESCE(proconfig, ARRAY[]::text[])
            FROM pg_proc
            WHERE proname = 'run_matching_engine_v1'
              AND pronamespace = 'public'::regnamespace
            """
        )
        acl, configs = cur.fetchone()
    assert "app_user=X" not in acl
    assert not re.search(r"(^|[,{])=X/", acl)
    assert any(
        item.startswith("search_path=") and item.split("=", 1)[1].strip("\"'") == ""
        for item in configs
    )
    assert (
        scalar(
            super_conn,
            "SELECT pg_get_userbyid(p.proowner) FROM pg_proc p WHERE p.proname = 'run_matching_engine_v1'",
        )
        == "intent_matcher"
    )


def _seed_cross_org_match(app_conn, super_conn, *, visibility="confidential"):
    intent_id = uuid.uuid4()
    opportunity_id = uuid.uuid4()
    match_id = uuid.uuid4()
    as_user(app_conn, USER_A)
    _insert_intent(
        app_conn,
        intent_id=intent_id,
        org_id=ORG_A,
        user_id=USER_A,
        visibility=visibility,
        lifecycle="active",
        kind="buy",
    )
    app_conn.commit()
    as_user(app_conn, USER_C)
    _insert_opportunity(
        app_conn,
        opportunity_id=opportunity_id,
        org_id=ORG_B,
        user_id=USER_C,
        visibility=visibility,
        lifecycle="open",
        facets={"kind": "sell"},
    )
    app_conn.commit()
    _insert_match(super_conn, match_id=match_id, intent_id=intent_id, opportunity_id=opportunity_id)
    return match_id, intent_id, opportunity_id


def test_intent_writers_can_qualify_and_dismiss_only(app_conn, super_conn):
    match_id, _, _ = _seed_cross_org_match(app_conn, super_conn)
    as_user(app_conn, USER_C)
    with pytest.raises(Exception), app_conn.cursor() as cur:
        cur.execute("SELECT public.qualify_business_match(%s)", (str(match_id),))
    app_conn.rollback()
    as_user(app_conn, USER_D)
    with pytest.raises(Exception), app_conn.cursor() as cur:
        cur.execute("SELECT public.qualify_business_match(%s)", (str(match_id),))
    app_conn.rollback()
    as_user(app_conn, USER_B)
    with app_conn.cursor() as cur:
        cur.execute("SELECT lifecycle FROM public.qualify_business_match(%s)", (str(match_id),))
        assert cur.fetchone()[0] == "qualified"
    app_conn.commit()
    as_user(app_conn, USER_A)
    with pytest.raises(Exception), app_conn.cursor() as cur:
        cur.execute("UPDATE business_matches SET lifecycle = 'introduced' WHERE id=%s", (str(match_id),))
    app_conn.rollback()
    as_user(app_conn, USER_A)
    with pytest.raises(Exception), app_conn.cursor() as cur:
        cur.execute("UPDATE business_matches SET lifecycle = 'candidate' WHERE id=%s", (str(match_id),))
    app_conn.rollback()
    as_user(app_conn, USER_A)
    with app_conn.cursor() as cur:
        cur.execute("SELECT lifecycle FROM public.dismiss_business_match(%s)", (str(match_id),))
        assert cur.fetchone()[0] == "dismissed"
    assert (
        scalar(app_conn, "SELECT count(*) FROM business_match_events WHERE match_id=%s AND kind='lifecycle_changed'", (str(match_id),))
        >= 1
    )


def test_introduction_requires_qualified_and_opportunity_consent(app_conn, super_conn):
    match_id, _, _ = _seed_cross_org_match(app_conn, super_conn, visibility="confidential")
    as_user(app_conn, USER_A)
    with pytest.raises(Exception), app_conn.cursor() as cur:
        cur.execute("SELECT public.request_business_match_introduction(%s)", (str(match_id),))
    app_conn.rollback()
    as_user(app_conn, USER_A)
    with app_conn.cursor() as cur:
        cur.execute("SELECT public.qualify_business_match(%s)", (str(match_id),))
    app_conn.commit()
    as_user(app_conn, USER_C)
    with pytest.raises(Exception), app_conn.cursor() as cur:
        cur.execute("SELECT public.request_business_match_introduction(%s)", (str(match_id),))
    app_conn.rollback()
    as_user(app_conn, USER_A)
    with app_conn.cursor() as cur:
        cur.execute("SELECT status FROM public.request_business_match_introduction(%s, %s)", (str(match_id), "hello"))
        assert cur.fetchone()[0] == "requested"
    app_conn.commit()
    as_user(app_conn, USER_C)
    assert scalar(app_conn, "SELECT count(*) FROM business_match_introductions WHERE match_id=%s", (str(match_id),)) == 0
    assert (
        scalar(
            app_conn,
            "SELECT count(*) FROM business_match_events WHERE match_id=%s AND kind='introduction_requested'",
            (str(match_id),),
        )
        == 0
    )
    as_user(app_conn, USER_A)
    assert scalar(app_conn, "SELECT count(*) FROM business_match_introductions WHERE match_id=%s", (str(match_id),)) == 1
    as_user(app_conn, USER_A)
    assert (
        scalar(app_conn, "SELECT count(*) FROM reveal_match_parties(%s)", (str(match_id),))
        == 0
    )
    as_user(app_conn, USER_C)
    with app_conn.cursor() as cur:
        cur.execute("SELECT status FROM public.respond_business_match_introduction(%s, true, %s)", (str(match_id), "ok"))
        assert cur.fetchone()[0] == "accepted"
    app_conn.commit()
    assert scalar(super_conn, "SELECT lifecycle FROM business_matches WHERE id=%s", (str(match_id),)) == "introduced"
    as_user(app_conn, USER_C)
    assert uuid.UUID(str(scalar(app_conn, "SELECT requested_by_org_id FROM business_match_introductions WHERE match_id=%s", (str(match_id),)))) == ORG_A
    as_user(app_conn, USER_A)
    with app_conn.cursor() as cur:
        cur.execute("SELECT side, organization_name FROM reveal_match_parties(%s) ORDER BY side", (str(match_id),))
        rows = cur.fetchall()
    assert rows == [("intent", "Farm A"), ("opportunity", "Farm B")]
    as_user(app_conn, USER_C)
    assert (
        scalar(
            app_conn,
            "SELECT count(*) FROM business_match_events WHERE match_id=%s AND kind='introduction_requested'",
            (str(match_id),),
        )
        == 1
    )
    _run_engine(super_conn)
    assert scalar(super_conn, "SELECT lifecycle FROM business_matches WHERE id=%s", (str(match_id),)) == "introduced"


def test_external_opportunity_cannot_accept_introduction(app_conn, super_conn):
    intent_id = uuid.uuid4()
    opportunity_id = uuid.uuid4()
    match_id = uuid.uuid4()
    as_user(app_conn, USER_A)
    _insert_intent(app_conn, intent_id=intent_id, org_id=ORG_A, user_id=USER_A, visibility="public", lifecycle="active", kind="buy")
    app_conn.commit()
    with super_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO business_opportunities (
                id, organization_id, created_by, source_type, source_ref, external_origin,
                title, summary, industry, target_markets, visibility, lifecycle, facets
            ) VALUES (
                %s, NULL, NULL, 'external_signal', 'feed', 'customs-bg',
                'External opening', 'Public-safe summary',
                'manufacturing', ARRAY['BG'], 'public', 'open', %s
            )
            """,
            (str(opportunity_id), psycopg2.extras.Json({"kind": "sell"})),
        )
    _insert_match(super_conn, match_id=match_id, intent_id=intent_id, opportunity_id=opportunity_id)
    as_user(app_conn, USER_A)
    with app_conn.cursor() as cur:
        cur.execute("SELECT public.qualify_business_match(%s)", (str(match_id),))
        cur.execute("SELECT public.request_business_match_introduction(%s)", (str(match_id),))
    app_conn.commit()
    as_user(app_conn, USER_A)
    with pytest.raises(Exception), app_conn.cursor() as cur:
        cur.execute("SELECT public.respond_business_match_introduction(%s, true)", (str(match_id),))
    assert scalar(super_conn, "SELECT lifecycle FROM business_matches WHERE id=%s", (str(match_id),)) == "qualified"


def test_introduction_tables_are_process_owned(super_conn):
    assert scalar(super_conn, "SELECT has_table_privilege('app_user', 'public.business_match_introductions', 'INSERT')") is False
    assert scalar(super_conn, "SELECT has_table_privilege('app_user', 'public.business_match_events', 'INSERT')") is False
    assert scalar(
        super_conn,
        "SELECT has_function_privilege('app_user', 'public.qualify_business_match(uuid)', 'EXECUTE')",
    ) is True
    assert scalar(
        super_conn,
        "SELECT has_function_privilege('app_user', 'public.tg_business_match_audit()', 'EXECUTE')",
    ) is False
    with super_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(proconfig, ARRAY[]::text[])
            FROM pg_proc
            WHERE proname = 'request_business_match_introduction'
              AND pronamespace = 'public'::regnamespace
            """
        )
        configs = cur.fetchone()[0]
    assert any(item.startswith("search_path=") and item.split("=", 1)[1].strip("\"'") == "" for item in configs)


USER_F = uuid.UUID("66666666-6666-6666-6666-666666666666")


def _clear_relationships(super_conn):
    with super_conn.cursor() as cur:
        cur.execute("TRUNCATE business_relationships CASCADE")


def _introduce_cross_org_match(app_conn, super_conn, *, visibility="confidential"):
    match_id, intent_id, opportunity_id = _seed_cross_org_match(app_conn, super_conn, visibility=visibility)
    as_user(app_conn, USER_A)
    with app_conn.cursor() as cur:
        cur.execute("SELECT public.qualify_business_match(%s)", (str(match_id),))
        cur.execute("SELECT public.request_business_match_introduction(%s)", (str(match_id),))
    app_conn.commit()
    as_user(app_conn, USER_C)
    with app_conn.cursor() as cur:
        cur.execute("SELECT public.respond_business_match_introduction(%s, true)", (str(match_id),))
    app_conn.commit()
    return match_id, intent_id, opportunity_id


def test_relationship_opens_only_after_introduction(app_conn, super_conn):
    _clear_relationships(super_conn)
    match_id, _, _ = _seed_cross_org_match(app_conn, super_conn)
    as_user(app_conn, USER_A)
    assert scalar(app_conn, "SELECT count(*) FROM business_relationships") == 0
    with app_conn.cursor() as cur:
        cur.execute("SELECT public.qualify_business_match(%s)", (str(match_id),))
        cur.execute("SELECT public.request_business_match_introduction(%s)", (str(match_id),))
    app_conn.commit()
    as_user(app_conn, USER_A)
    assert scalar(app_conn, "SELECT count(*) FROM business_relationships") == 0
    as_user(app_conn, USER_C)
    with app_conn.cursor() as cur:
        cur.execute("SELECT public.respond_business_match_introduction(%s, true)", (str(match_id),))
    app_conn.commit()
    as_user(app_conn, USER_A)
    assert scalar(app_conn, "SELECT count(*) FROM business_relationships WHERE origin_match_id=%s", (str(match_id),)) == 1
    assert scalar(app_conn, "SELECT status FROM business_relationships WHERE origin_match_id=%s", (str(match_id),)) == "active"
    assert uuid.UUID(str(scalar(app_conn, "SELECT organization_a FROM business_relationships WHERE origin_match_id=%s", (str(match_id),)))) == ORG_A
    assert uuid.UUID(str(scalar(app_conn, "SELECT organization_b FROM business_relationships WHERE origin_match_id=%s", (str(match_id),)))) == ORG_B
    as_user(app_conn, USER_D)
    assert scalar(app_conn, "SELECT count(*) FROM business_relationships WHERE origin_match_id=%s", (str(match_id),)) == 1
    as_user(app_conn, USER_F)
    assert scalar(app_conn, "SELECT count(*) FROM business_relationships") == 0
    assert (
        scalar(
            super_conn,
            """
            SELECT count(*) FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'business_relationships'
              AND column_name IN ('score', 'match_score', 'confidence', 'reasons', 'explanation')
            """,
        )
        == 0
    )


def test_relationship_pair_is_unique_and_has_no_copied_score(app_conn, super_conn):
    _clear_relationships(super_conn)
    match_id, _, _ = _introduce_cross_org_match(app_conn, super_conn)
    second_match, _, _ = _seed_cross_org_match(app_conn, super_conn, visibility="network")
    as_user(app_conn, USER_A)
    with app_conn.cursor() as cur:
        cur.execute("SELECT public.qualify_business_match(%s)", (str(second_match),))
        cur.execute("SELECT public.request_business_match_introduction(%s)", (str(second_match),))
    app_conn.commit()
    as_user(app_conn, USER_C)
    with app_conn.cursor() as cur:
        cur.execute("SELECT public.respond_business_match_introduction(%s, true)", (str(second_match),))
    app_conn.commit()
    as_user(app_conn, USER_A)
    assert scalar(app_conn, "SELECT count(*) FROM business_relationships") == 1
    assert uuid.UUID(str(scalar(app_conn, "SELECT origin_match_id FROM business_relationships"))) == match_id
    assert scalar(
        app_conn,
        "SELECT provenance ? 'later_match_id' FROM business_relationships WHERE origin_match_id=%s",
        (str(match_id),),
    ) is True
    assert scalar(
        app_conn,
        "SELECT provenance ? 'score' FROM business_relationships WHERE origin_match_id=%s",
        (str(match_id),),
    ) is False


def test_relationship_lifecycle_is_process_owned(app_conn, super_conn):
    _clear_relationships(super_conn)
    match_id, _, _ = _introduce_cross_org_match(app_conn, super_conn)
    rel_id = scalar(super_conn, "SELECT id FROM business_relationships WHERE origin_match_id=%s", (str(match_id),))
    as_user(app_conn, USER_A)
    with pytest.raises(Exception), app_conn.cursor() as cur:
        cur.execute(
            "INSERT INTO business_relationships (organization_a, organization_b, origin_match_id) VALUES (%s,%s,%s)",
            (str(ORG_A), str(ORG_B), str(match_id)),
        )
    app_conn.rollback()
    as_user(app_conn, USER_D)
    with pytest.raises(Exception), app_conn.cursor() as cur:
        cur.execute("SELECT public.pause_business_relationship(%s)", (str(rel_id),))
    app_conn.rollback()
    as_user(app_conn, USER_A)
    with app_conn.cursor() as cur:
        cur.execute("SELECT status FROM public.pause_business_relationship(%s)", (str(rel_id),))
        assert cur.fetchone()[0] == "paused"
        cur.execute("SELECT status FROM public.resume_business_relationship(%s)", (str(rel_id),))
        assert cur.fetchone()[0] == "active"
        cur.execute("SELECT status FROM public.close_business_relationship(%s)", (str(rel_id),))
        assert cur.fetchone()[0] == "closed"
    app_conn.commit()
    as_user(app_conn, USER_A)
    with pytest.raises(Exception), app_conn.cursor() as cur:
        cur.execute("SELECT public.touch_business_relationship(%s)", (str(rel_id),))
    app_conn.rollback()
    as_user(app_conn, USER_A)
    assert scalar(app_conn, "SELECT count(*) FROM business_relationship_events WHERE relationship_id=%s", (str(rel_id),)) >= 3
    assert scalar(
        super_conn,
        "SELECT has_table_privilege('app_user', 'public.business_relationships', 'INSERT')",
    ) is False
    assert scalar(
        super_conn,
        "SELECT has_function_privilege('app_user', 'public.ensure_business_relationship_from_match(uuid)', 'EXECUTE')",
    ) is False
    with super_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(proconfig, ARRAY[]::text[])
            FROM pg_proc
            WHERE proname = 'ensure_business_relationship_from_match'
              AND pronamespace = 'public'::regnamespace
            """
        )
        configs = cur.fetchone()[0]
    assert any(item.startswith("search_path=") and item.split("=", 1)[1].strip("\"'") == "" for item in configs)


def test_external_introduced_path_does_not_open_relationship(app_conn, super_conn):
    intent_id = uuid.uuid4()
    opportunity_id = uuid.uuid4()
    match_id = uuid.uuid4()
    as_user(app_conn, USER_A)
    _insert_intent(app_conn, intent_id=intent_id, org_id=ORG_A, user_id=USER_A, visibility="public", lifecycle="active", kind="buy")
    app_conn.commit()
    with super_conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO business_opportunities (
                id, organization_id, created_by, source_type, source_ref, external_origin,
                title, summary, industry, target_markets, visibility, lifecycle, facets
            ) VALUES (
                %s, NULL, NULL, 'external_signal', 'feed', 'customs-bg',
                'External opening', 'Public-safe summary',
                'manufacturing', ARRAY['BG'], 'public', 'open', %s
            )
            """,
            (str(opportunity_id), psycopg2.extras.Json({"kind": "sell"})),
        )
    _insert_match(super_conn, match_id=match_id, intent_id=intent_id, opportunity_id=opportunity_id)
    as_user(app_conn, USER_A)
    with app_conn.cursor() as cur:
        cur.execute("SELECT public.qualify_business_match(%s)", (str(match_id),))
        cur.execute("SELECT public.request_business_match_introduction(%s)", (str(match_id),))
    app_conn.commit()
    assert scalar(super_conn, "SELECT count(*) FROM business_relationships WHERE origin_match_id=%s", (str(match_id),)) == 0


def _radar_summary(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM public.business_radar_summary()")
        row = cur.fetchone()
    return {
        "candidate_matches": row[0],
        "qualified_matches": row[1],
        "pending_introductions": row[2],
        "active_relationships": row[3],
        "open_opportunities": row[4],
    }


def test_radar_is_read_model_and_does_not_widen_confidential_identity(app_conn, super_conn):
    _clear_relationships(super_conn)
    match_id, intent_id, opportunity_id = _seed_cross_org_match(app_conn, super_conn, visibility="confidential")
    as_user(app_conn, USER_A)
    with app_conn.cursor() as cur:
        cur.execute("SELECT public.qualify_business_match(%s)", (str(match_id),))
        cur.execute("SELECT public.request_business_match_introduction(%s)", (str(match_id),))
    app_conn.commit()
    as_user(app_conn, USER_A)
    summary_a = _radar_summary(app_conn)
    assert summary_a["qualified_matches"] >= 1
    assert summary_a["pending_introductions"] >= 1
    with app_conn.cursor() as cur:
        cur.execute(
            """
            SELECT item_kind, safe_title, organization_a, organization_a_name
            FROM business_radar_items
            WHERE item_kind IN ('qualified_match', 'pending_introduction')
            """
        )
        rows = cur.fetchall()
    assert any(kind == "qualified_match" and title == "Headline" for kind, title, _, _ in rows)
    assert all(org_id is None and org_name is None for _, _, org_id, org_name in rows)
    as_user(app_conn, USER_C)
    summary_c = _radar_summary(app_conn)
    assert summary_c["qualified_matches"] >= 1
    assert summary_c["pending_introductions"] == 0
    with app_conn.cursor() as cur:
        cur.execute(
            """
            SELECT safe_title, organization_a, organization_a_name, organization_b_name
            FROM business_radar_items
            WHERE item_kind = 'qualified_match' AND item_id=%s
            """,
            (str(match_id),),
        )
        title, org_a, name_a, name_b = cur.fetchone()
    assert title == "Opportunity title"
    assert org_a is None and name_a is None and name_b is None
    as_user(app_conn, USER_F)
    empty = _radar_summary(app_conn)
    assert empty["candidate_matches"] == 0
    assert empty["qualified_matches"] == 0
    assert empty["pending_introductions"] == 0
    assert empty["active_relationships"] == 0
    as_user(app_conn, USER_F)
    assert scalar(app_conn, "SELECT count(*) FROM business_radar_items WHERE item_kind IN ('qualified_match', 'pending_introduction', 'relationship')") == 0


def test_radar_reveals_relationship_identity_only_after_introduction(app_conn, super_conn):
    _clear_relationships(super_conn)
    match_id, _, opportunity_id = _introduce_cross_org_match(app_conn, super_conn)
    as_user(app_conn, USER_C)
    summary = _radar_summary(app_conn)
    assert summary["pending_introductions"] == 0
    assert summary["active_relationships"] == 1
    with app_conn.cursor() as cur:
        cur.execute(
            """
            SELECT organization_a, organization_b, organization_a_name, organization_b_name
            FROM business_radar_items
            WHERE item_kind = 'relationship'
            """
        )
        org_a, org_b, name_a, name_b = cur.fetchone()
    assert uuid.UUID(str(org_a)) == ORG_A
    assert uuid.UUID(str(org_b)) == ORG_B
    assert name_a == "Farm A"
    assert name_b == "Farm B"
    as_user(app_conn, USER_C)
    assert scalar(
        app_conn,
        "SELECT count(*) FROM business_radar_items WHERE item_kind='open_opportunity' AND item_id=%s",
        (str(opportunity_id),),
    ) == 1
    as_user(app_conn, USER_A)
    assert scalar(
        app_conn,
        "SELECT count(*) FROM business_radar_items WHERE item_kind='open_opportunity' AND item_id=%s",
        (str(opportunity_id),),
    ) == 0
    as_user(app_conn, USER_F)
    assert scalar(app_conn, "SELECT count(*) FROM business_radar_items WHERE item_kind IN ('relationship', 'pending_introduction')") == 0


def test_radar_has_no_write_surface(super_conn):
    assert scalar(super_conn, "SELECT has_table_privilege('app_user', 'public.business_radar_items', 'INSERT')") is False
    assert scalar(super_conn, "SELECT has_table_privilege('app_user', 'public.business_radar_items', 'UPDATE')") is False
    assert scalar(
        super_conn,
        "SELECT has_function_privilege('app_user', 'public.business_radar_summary()', 'EXECUTE')",
    ) is True
    with super_conn.cursor() as cur:
        cur.execute(
            """
            SELECT COALESCE(proconfig, ARRAY[]::text[]), prosecdef
            FROM pg_proc
            WHERE proname = 'business_radar_summary'
              AND pronamespace = 'public'::regnamespace
            """
        )
        configs, is_definer = cur.fetchone()
    assert is_definer is False
    assert any(item.startswith("search_path=") and item.split("=", 1)[1].strip("\"'") == "" for item in configs)


