"""Authenticated First Business Intent onboarding journey against 001-012.

Mirrors: ensure org → create active confidential intent → waiting Radar →
matcher discovers opportunity → qualify → introduction → relationship.
Also proves the empty waiting case and confidential non-leak.

  python scripts/prove_onboarding_e2e.py
"""

from __future__ import annotations

import os
import uuid

import psycopg2
import psycopg2.extras
from psycopg2 import errors

SUPER_DSN = os.environ.get("DB_URL_SUPERUSER") or os.environ.get("DB_URL_SUPERUSER")
APP_DSN = os.environ.get("DB_URL_APPUSER") or os.environ.get("DB_URL_APPUSER")

USER_G = uuid.UUID("77777777-7777-7777-7777-777777777777")
USER_H = uuid.UUID("88888888-8888-8888-8888-888888888888")
USER_F = uuid.UUID("66666666-6666-6666-6666-666666666666")
ORG_G = uuid.UUID("ccccccc1-cccc-cccc-cccc-cccccccccccc")
ORG_H = uuid.UUID("ddddddd1-dddd-dddd-dddd-dddddddddddd")

INTENT_TEXT = "Need food-grade steel coils for Q4 packing lines"
OPP_TITLE = "Food-grade steel coils available for EU buyers"


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


def radar(conn, user_id):
    as_user(conn, user_id)
    summary = fetchall(conn, "SELECT * FROM public.business_radar_summary()")[0]
    items = fetchall(conn, "SELECT * FROM public.business_radar_items ORDER BY updated_at DESC")
    return summary, items


def fail(msg: str) -> None:
    raise SystemExit(msg)


def main() -> None:
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
                "INSERT INTO organizations (id, name, owner_user_id) VALUES (%s, 'Pack Co', %s), (%s, 'Coil Co', %s)",
                (str(ORG_G), str(USER_G), str(ORG_H), str(USER_H)),
            )
            cur.execute(
                """
                INSERT INTO organization_memberships (organization_id, user_id, role)
                VALUES (%s,%s,'owner'),(%s,%s,'owner')
                """,
                (str(ORG_G), str(USER_G), str(ORG_H), str(USER_H)),
            )

    app = psycopg2.connect(APP_DSN)
    app.autocommit = False
    try:
        as_user(app, USER_G)
        with app.cursor() as cur:
            cur.execute(
                """
                INSERT INTO business_intents (
                    organization_id, created_by, kind, headline, public_summary,
                    industry, target_markets, visibility, lifecycle
                ) VALUES (
                    %s, %s, 'buy', %s, %s,
                    'manufacturing', ARRAY['BG'], 'confidential', 'active'
                )
                RETURNING id
                """,
                (str(ORG_G), str(USER_G), INTENT_TEXT, INTENT_TEXT),
            )
            intent_id = cur.fetchone()[0]
        app.commit()
        print("onboarding: active confidential intent created")

        summary_g, items_g = radar(app, USER_G)
        app.rollback()
        if int(summary_g["candidate_matches"]) != 0 or any(
            i["item_kind"] == "candidate_match" for i in items_g
        ):
            fail(f"new intent must wait with empty radar, got {dict(summary_g)}")
        print("waiting: active intent, no matches yet")
    finally:
        app.close()

    app = psycopg2.connect(APP_DSN)
    app.autocommit = False
    try:
        as_user(app, USER_G)
        own = fetchall(app, "SELECT id, headline, visibility, lifecycle FROM business_intents")
        if len(own) != 1 or own[0]["headline"] != INTENT_TEXT or own[0]["visibility"] != "confidential":
            fail(f"owner should read own confidential intent, got {own}")
        app.rollback()

        as_user(app, USER_F)
        leaked = fetchall(app, "SELECT headline FROM business_intents")
        if leaked:
            fail(f"outsider leaked intents: {leaked}")
        summary_f, items_f = radar(app, USER_F)
        app.rollback()
        if int(summary_f["candidate_matches"]) != 0 or items_f:
            fail(f"outsider radar must be empty before match, got {items_f}")
        print("waiting + confidential: outsider sees no intent identity")

        as_user(app, USER_H)
        leaked_h = fetchall(app, "SELECT headline FROM business_intents")
        if any(INTENT_TEXT in str(row.get("headline")) for row in leaked_h):
            fail("counterpart must not read confidential intent headline before introduction")
        app.rollback()
    finally:
        app.close()

    app = psycopg2.connect(APP_DSN)
    app.autocommit = False
    try:
        as_user(app, USER_H)
        with app.cursor() as cur:
            cur.execute(
                """
                INSERT INTO business_opportunities (
                    organization_id, created_by, source_type, source_ref,
                    title, summary, industry, target_markets, visibility, lifecycle, facets, provenance
                ) VALUES (
                    %s, %s, 'manual', 'onboarding-e2e',
                    %s, 'Public-safe coil supply summary',
                    'manufacturing', ARRAY['BG'], 'confidential', 'open',
                    %s, '{}'::jsonb
                )
                """,
                (str(ORG_H), str(USER_H), OPP_TITLE, psycopg2.extras.Json({"kind": "sell"})),
            )
        app.commit()
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
            fail(f"matcher wrote {written} rows")
    print("matcher discovered a candidate")

    app = psycopg2.connect(APP_DSN)
    app.autocommit = False
    try:
        summary_g, items_g = radar(app, USER_G)
        app.rollback()
        cand_g = [i for i in items_g if i["item_kind"] == "candidate_match"]
        if not cand_g:
            fail(f"intent owner should see a candidate after matcher: {dict(summary_g)}")
        if INTENT_TEXT not in (cand_g[0].get("safe_title") or ""):
            fail(f"intent owner should see own description, got {cand_g[0].get('safe_title')}")
        if OPP_TITLE in (cand_g[0].get("safe_title") or "") or "Coil Co" in str(cand_g[0]):
            fail("intent owner must not see counterpart identity on confidential candidate")

        summary_h, items_h = radar(app, USER_H)
        app.rollback()
        cand_h = [i for i in items_h if i["item_kind"] == "candidate_match"]
        if not cand_h:
            fail("opportunity owner should see a candidate")
        if OPP_TITLE not in (cand_h[0].get("safe_title") or ""):
            fail(f"opportunity owner should see own title, got {cand_h[0].get('safe_title')}")
        if INTENT_TEXT in (cand_h[0].get("safe_title") or "") or "Pack Co" in str(cand_h[0]):
            fail("opportunity owner must not see confidential intent identity")

        summary_f, items_f = radar(app, USER_F)
        app.rollback()
        if any(i["item_kind"] == "candidate_match" for i in items_f) or int(summary_f["candidate_matches"]):
            fail("outsider must not see the candidate")

        match_id = cand_g[0]["item_id"]

        as_user(app, USER_H)
        try:
            with app.cursor() as cur:
                cur.execute("SELECT public.qualify_business_match(%s)", (str(match_id),))
            fail("opportunity owner must not qualify")
        except Exception:
            app.rollback()

        as_user(app, USER_G)
        with app.cursor() as cur:
            cur.execute("SELECT public.qualify_business_match(%s)", (str(match_id),))
        app.commit()
        _, items_g = radar(app, USER_G)
        app.rollback()
        if not any(i["item_kind"] == "qualified_match" for i in items_g):
            fail("radar should show qualified after qualify")

        as_user(app, USER_G)
        with app.cursor() as cur:
            cur.execute("SELECT public.request_business_match_introduction(%s, %s)", (str(match_id), ""))
        app.commit()

        as_user(app, USER_H)
        with app.cursor() as cur:
            cur.execute(
                "SELECT public.respond_business_match_introduction(%s, %s, %s)",
                (str(match_id), True, ""),
            )
        app.commit()

        _, items_g = radar(app, USER_G)
        app.rollback()
        _, items_h = radar(app, USER_H)
        app.rollback()
        _, items_f = radar(app, USER_F)
        app.rollback()
        rel_g = [i for i in items_g if i["item_kind"] == "relationship"]
        rel_h = [i for i in items_h if i["item_kind"] == "relationship"]
        rel_f = [i for i in items_f if i["item_kind"] == "relationship"]
        if not rel_g or not rel_h:
            fail("relationship missing from radar after accept")
        names = " ".join(
            filter(None, [rel_g[0].get("organization_a_name"), rel_g[0].get("organization_b_name")])
        )
        if "Pack Co" not in names or "Coil Co" not in names:
            fail(f"relationship should reveal both orgs, got {names}")
        if rel_f or "Pack Co" in str(items_f) or "Coil Co" in str(items_f):
            fail("outsider must not see relationship identity")
        print("funnel: qualify -> introduction -> relationship")
        print("onboarding e2e ok")
    finally:
        app.close()


if __name__ == "__main__":
    main()
