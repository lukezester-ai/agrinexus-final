"""Seed and prove Business Radar UI v1 against 001-012.

Commands:
  python scripts/prove_radar_e2e.py seed
  python scripts/prove_radar_e2e.py roles
  python scripts/prove_radar_e2e.py verify
"""

from __future__ import annotations

import json
import os
import sys
import uuid

import psycopg2
import psycopg2.extras
from psycopg2 import errors

SUPER_DSN = os.environ.get("DB_URL_SUPERUSER") or os.environ.get("DB_URL_SUPERUSER")
APP_DSN = os.environ.get("DB_URL_APPUSER") or os.environ.get("DB_URL_APPUSER")

USER_A = uuid.UUID("11111111-1111-1111-1111-111111111111")
USER_B = uuid.UUID("22222222-2222-2222-2222-222222222222")
USER_C = uuid.UUID("33333333-3333-3333-3333-333333333333")
USER_D = uuid.UUID("44444444-4444-4444-4444-444444444444")
USER_E = uuid.UUID("55555555-5555-5555-5555-555555555555")
USER_F = uuid.UUID("66666666-6666-6666-6666-666666666666")
ORG_A = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
ORG_B = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")

INTENT_HEADLINE = "UBC E2E intent buy confidential"
OPP_TITLE = "UBC E2E opportunity sell confidential"


def require_dsn() -> None:
    if not SUPER_DSN or not APP_DSN:
        raise SystemExit("DB_URL_SUPERUSER and DB_URL_APPUSER are required")


def as_user(conn, user_id) -> None:
    with conn.cursor() as cur:
        cur.execute("SELECT set_config('request.jwt.claims.sub', %s, true)", (str(user_id),))


def fetchall(conn, sql, params=()):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql, params)
        return list(cur.fetchall())


def scalar(conn, sql, params=()):
    with conn.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        return row[0] if row else None


def seed() -> None:
    require_dsn()
    with psycopg2.connect(SUPER_DSN) as super_conn:
        super_conn.autocommit = True
        with super_conn.cursor() as cur:
            cur.execute(
                """
                TRUNCATE organization_audit_log, organization_verifications, organization_private_data,
                         organization_memberships, organizations CASCADE
                """
            )
            cur.execute(
                "INSERT INTO organizations (id, name, owner_user_id) VALUES (%s, 'Northbridge Trading', %s), (%s, 'Atlas Distribution', %s)",
                (str(ORG_A), str(USER_A), str(ORG_B), str(USER_C)),
            )
            cur.execute(
                """
                INSERT INTO organization_memberships (organization_id, user_id, role)
                VALUES (%s,%s,'owner'),(%s,%s,'admin'),(%s,%s,'member'),(%s,%s,'viewer'),(%s,%s,'owner')
                """,
                (
                    str(ORG_A),
                    str(USER_A),
                    str(ORG_A),
                    str(USER_E),
                    str(ORG_A),
                    str(USER_B),
                    str(ORG_A),
                    str(USER_D),
                    str(ORG_B),
                    str(USER_C),
                ),
            )

    app = psycopg2.connect(APP_DSN)
    app.autocommit = False
    try:
        as_user(app, USER_A)
        with app.cursor() as cur:
            cur.execute(
                """
                INSERT INTO business_intents (
                    organization_id, created_by, kind, headline, public_summary,
                    industry, target_markets, visibility, lifecycle
                ) VALUES (
                    %s, %s, 'buy', %s, 'Public-safe intent summary',
                    'manufacturing', ARRAY['BG'], 'confidential', 'active'
                )
                """,
                (str(ORG_A), str(USER_A), INTENT_HEADLINE),
            )
        app.commit()

        as_user(app, USER_C)
        with app.cursor() as cur:
            cur.execute(
                """
                INSERT INTO business_opportunities (
                    organization_id, created_by, source_type, source_ref,
                    title, summary, industry, target_markets, visibility, lifecycle, facets, provenance
                ) VALUES (
                    %s, %s, 'manual', 'ui',
                    %s, 'Public-safe opportunity summary',
                    'manufacturing', ARRAY['BG'], 'confidential', 'open',
                    %s, '{}'::jsonb
                )
                """,
                (
                    str(ORG_B),
                    str(USER_C),
                    OPP_TITLE,
                    psycopg2.extras.Json({"kind": "sell"}),
                ),
            )
        app.commit()

        as_user(app, USER_A)
        try:
            with app.cursor() as cur:
                cur.execute("SELECT public.run_matching_engine_v1()")
            raise SystemExit("app_user must not execute the matcher")
        except errors.InsufficientPrivilege:
            app.rollback()

        as_user(app, USER_C)
        try:
            with app.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO business_intents (
                        organization_id, created_by, kind, headline, industry, visibility, lifecycle
                    ) VALUES (%s, %s, 'buy', 'spoof', 'manufacturing', 'confidential', 'active')
                    """,
                    (str(ORG_A), str(USER_C)),
                )
            raise SystemExit("opportunity writer must not insert into the intent org")
        except errors.InsufficientPrivilege:
            app.rollback()
    finally:
        app.close()

    with psycopg2.connect(SUPER_DSN) as super_conn:
        super_conn.autocommit = True
        with super_conn.cursor() as cur:
            cur.execute("SET ROLE intent_matcher")
            cur.execute("SELECT public.run_matching_engine_v1()")
            written = cur.fetchone()[0]
            cur.execute("RESET ROLE")
        if int(written) < 1:
            raise SystemExit(f"matcher wrote {written} rows")

    print("seed ok")


def radar_for(user_id):
    conn = psycopg2.connect(APP_DSN)
    conn.autocommit = False
    try:
        as_user(conn, user_id)
        summary = fetchall(conn, "SELECT * FROM public.business_radar_summary()")[0]
        items = fetchall(conn, "SELECT * FROM public.business_radar_items ORDER BY updated_at DESC")
        conn.rollback()
        return summary, items
    finally:
        conn.close()


def assert_roles() -> None:
    require_dsn()
    summary_a, items_a = radar_for(USER_A)
    summary_c, items_c = radar_for(USER_C)
    summary_f, items_f = radar_for(USER_F)
    _, items_d = radar_for(USER_D)

    cand_a = [i for i in items_a if i["item_kind"] == "candidate_match"]
    cand_c = [i for i in items_c if i["item_kind"] == "candidate_match"]
    cand_f = [i for i in items_f if i["item_kind"] == "candidate_match"]
    cand_d = [i for i in items_d if i["item_kind"] == "candidate_match"]

    if int(summary_a["candidate_matches"]) < 1 or not cand_a:
        raise SystemExit(f"intent writer should see candidate matches: {dict(summary_a)}")
    if INTENT_HEADLINE not in (cand_a[0].get("safe_title") or ""):
        raise SystemExit(f"intent writer should see own headline, got {cand_a[0].get('safe_title')}")
    if int(summary_c["candidate_matches"]) < 1 or not cand_c:
        raise SystemExit(f"opportunity writer should see candidate matches: {dict(summary_c)}")
    if OPP_TITLE not in (cand_c[0].get("safe_title") or ""):
        raise SystemExit(f"opportunity writer should see own title, got {cand_c[0].get('safe_title')}")
    if INTENT_HEADLINE in (cand_c[0].get("safe_title") or ""):
        raise SystemExit("opportunity writer must not see confidential intent headline")
    if cand_f or int(summary_f["candidate_matches"]) != 0:
        raise SystemExit(f"outsider should not see candidates: {items_f}")
    if not cand_d:
        raise SystemExit("viewer should see org A candidates")

    match_id = cand_a[0]["item_id"]
    app = psycopg2.connect(APP_DSN)
    app.autocommit = False
    try:
        as_user(app, USER_C)
        try:
            with app.cursor() as cur:
                cur.execute("SELECT public.qualify_business_match(%s)", (match_id,))
            raise SystemExit("opportunity writer must not qualify")
        except Exception:
            app.rollback()
        as_user(app, USER_D)
        try:
            with app.cursor() as cur:
                cur.execute("SELECT public.qualify_business_match(%s)", (match_id,))
            raise SystemExit("viewer must not qualify")
        except Exception:
            app.rollback()
        as_user(app, USER_F)
        try:
            with app.cursor() as cur:
                cur.execute("SELECT public.qualify_business_match(%s)", (match_id,))
            raise SystemExit("outsider must not qualify")
        except Exception:
            app.rollback()
    finally:
        app.close()

    print(
        json.dumps(
            {
                "match_id": str(match_id),
                "intent_writer_title": cand_a[0].get("safe_title"),
                "opportunity_writer_title": cand_c[0].get("safe_title"),
                "outsider_candidates": len(cand_f),
            },
            indent=2,
        )
    )
    print("roles ok")


def verify() -> None:
    require_dsn()
    _, items_a = radar_for(USER_A)
    _, items_c = radar_for(USER_C)
    _, items_f = radar_for(USER_F)
    rel_a = [i for i in items_a if i["item_kind"] == "relationship"]
    rel_c = [i for i in items_c if i["item_kind"] == "relationship"]
    rel_f = [i for i in items_f if i["item_kind"] == "relationship"]
    if not rel_a or not rel_c:
        raise SystemExit("relationship missing from radar after accept")
    names_a = " ".join(filter(None, [rel_a[0].get("organization_a_name"), rel_a[0].get("organization_b_name")]))
    if "Northbridge Trading" not in names_a or "Atlas Distribution" not in names_a:
        raise SystemExit(f"relationship should show both org names, got {names_a}")
    if rel_f:
        raise SystemExit("outsider must not see the relationship")
    print("verify ok")


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "seed"
    if cmd == "seed":
        seed()
        return
    if cmd == "roles":
        assert_roles()
        return
    if cmd == "verify":
        verify()
        return
    raise SystemExit(f"unknown command {cmd}")


if __name__ == "__main__":
    main()
