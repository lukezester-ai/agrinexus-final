"""Checks for a database migrated with 001-005 only.

Schema phase: no B2B relations, FORCE RLS, app_user is not superuser and not BYPASSRLS,
and auth.uid() is the Supabase function.
Behavior phase: expects the core suite seed and checks RBAC, deny-by-default,
and that anon/authenticated cannot cross the tenant boundary.
Does not call POST /auth/token. A GoTrue session is proved by assert_supabase_session.py.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

import psycopg2
from psycopg2 import errors

SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
APP_DSN = os.environ.get("DB_URL_APPUSER")

CORE_TABLES = (
    "organizations",
    "organization_memberships",
    "organization_private_data",
    "organization_audit_log",
    "organization_verifications",
)
B2B_RELATIONS = (
    "business_intents",
    "business_intent_secrets",
    "business_intent_match_index",
    "business_opportunities",
    "business_opportunity_secrets",
    "business_opportunity_match_index",
    "business_matches",
    "business_match_introductions",
    "business_match_events",
    "business_relationships",
    "business_relationship_events",
    "matching_jobs",
    "business_radar_items",
)

USER_A = "11111111-1111-1111-1111-111111111111"
USER_B = "22222222-2222-2222-2222-222222222222"
USER_E = "55555555-5555-5555-5555-555555555555"
ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"


def fail(message: str) -> None:
    print(f"FAIL {message}", file=sys.stderr)
    raise SystemExit(1)


def ok(message: str) -> None:
    print(f"PASS {message}")


def connect(dsn: str):
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    return conn


def require_dsns() -> None:
    if not SUPER_DSN or not APP_DSN:
        fail("DB_URL_SUPERUSER and DB_URL_APPUSER are required")
    if SUPER_DSN == APP_DSN:
        fail("superuser and app_user DSNs must differ")


def phase_schema() -> None:
    require_dsns()
    with connect(SUPER_DSN) as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT c.relname
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r'
            ORDER BY 1
            """
        )
        tables = [row[0] for row in cur.fetchall()]
        if tables != sorted(CORE_TABLES):
            fail(f"public tables are {tables}, expected only {sorted(CORE_TABLES)}")
        ok("public relations are exactly the five core tables")

        for name in B2B_RELATIONS:
            cur.execute("SELECT to_regclass(%s)", (f"public.{name}",))
            if cur.fetchone()[0] is not None:
                fail(f"{name} exists; 006-013 leaked into this database")
        ok("no 006-013 relations")

        cur.execute(
            """
            SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r'
            ORDER BY 1
            """
        )
        for name, enabled, forced in cur.fetchall():
            if not enabled or not forced:
                fail(f"{name} relrowsecurity={enabled} relforcerowsecurity={forced}")
        ok("ENABLE and FORCE ROW LEVEL SECURITY on every core table")

        cur.execute(
            """
            SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
            FROM pg_roles
            WHERE rolname = 'app_user'
            """
        )
        row = cur.fetchone()
        if row is None:
            fail("role app_user is missing")
        name, is_super, bypass, createdb, createrole = row
        if name != "app_user" or is_super or bypass or createdb or createrole:
            fail(f"app_user privileges are {row}")
        ok("app_user is NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE")

        cur.execute(
            """
            SELECT tablename, tableowner
            FROM pg_tables
            WHERE schemaname = 'public'
            ORDER BY 1
            """
        )
        for table, owner in cur.fetchall():
            if owner == "app_user":
                fail(f"app_user owns {table}")
        ok("app_user does not own the core tables")

        cur.execute(
            """
            SELECT p.prosrc
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'auth' AND p.proname = 'uid'
            """
        )
        sources = [row[0] for row in cur.fetchall()]
        if len(sources) != 1:
            fail(f"expected one auth.uid(), found {len(sources)}")
        source = sources[0]
        if "request.jwt.claims.sub" in source:
            fail("auth.uid() is the local test helper, not the Supabase function")
        if "request.jwt.claim.sub" not in source:
            fail("auth.uid() does not read request.jwt.claim.sub")
        ok("auth.uid() is the Supabase function")

    with connect(APP_DSN) as conn, conn.cursor() as cur:
        cur.execute("SELECT current_user, session_user")
        current, session = cur.fetchone()
        if current != "app_user" or session != "app_user":
            fail(f"current_user={current} session_user={session}")
        cur.execute(
            """
            SELECT rolsuper, rolbypassrls
            FROM pg_roles
            WHERE rolname = current_user
            """
        )
        is_super, bypass = cur.fetchone()
        if is_super or bypass:
            fail("connected app role can bypass RLS")
        ok("session_user and current_user are app_user, without BYPASSRLS")


def as_user(conn, user_id: str) -> None:
    sub = str(user_id)
    claims = json.dumps({"sub": sub, "role": "authenticated", "aud": "authenticated"})
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                set_config('request.jwt.claims.sub', %s, true),
                set_config('request.jwt.claim.sub', %s, true),
                set_config('request.jwt.claims', %s, true)
            """,
            (sub, sub, claims),
        )
        cur.fetchone()


def same_user(value, expected: str) -> bool:
    return value is not None and str(value) == expected


def phase_client_roles() -> None:
    for role in ("anon", "authenticated"):
        conn = psycopg2.connect(SUPER_DSN)
        conn.autocommit = False
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT count(*) FROM public.organizations")
                if cur.fetchone()[0] < 2:
                    fail("client role check needs the seeded organizations")
                cur.execute(f"SET LOCAL ROLE {role}")
                cur.execute(
                    "SELECT set_config('request.jwt.claim.sub', %s, true)",
                    (USER_A,),
                )
                cur.execute("SELECT count(*) FROM public.organizations")
                seen = cur.fetchone()[0]
                if seen != 0:
                    fail(f"{role} read {seen} organizations with user A's claim")
                cur.execute(
                    "UPDATE public.organizations SET name = 'bypass' WHERE id = %s",
                    (ORG_A,),
                )
                if cur.rowcount != 0:
                    fail(f"{role} updated organization A")
            ok(f"{role} cannot read or modify organizations")
        except errors.InsufficientPrivilege:
            ok(f"{role} has no privilege on organizations")
        finally:
            conn.rollback()
            conn.close()


def phase_behavior() -> None:
    require_dsns()
    phase_client_roles()
    anon = psycopg2.connect(APP_DSN)
    anon.autocommit = False
    try:
        with anon.cursor() as cur:
            cur.execute("SELECT current_user, session_user")
            current, session = cur.fetchone()
            if current != "app_user" or session != "app_user":
                fail(f"behavior session is {current}/{session}")
            cur.execute("SELECT auth.uid()")
            uid = cur.fetchone()[0]
            if uid is not None:
                fail(f"fresh session produced auth.uid()={uid}")
            cur.execute("SELECT count(*) FROM organizations")
            if cur.fetchone()[0] != 0:
                fail("missing auth.uid() can read organizations")
            try:
                cur.execute(
                    "INSERT INTO organization_private_data (organization_id, created_by, label) VALUES (%s,%s,'anon')",
                    (ORG_A, USER_A),
                )
                fail("anonymous insert was accepted")
            except errors.InsufficientPrivilege:
                anon.rollback()
        ok("deny-by-default when auth.uid() is null")
    finally:
        anon.close()

    conn = psycopg2.connect(APP_DSN)
    conn.autocommit = False
    try:
        as_user(conn, USER_E)
        with conn.cursor() as cur:
            cur.execute("SELECT auth.uid()")
            if not same_user(cur.fetchone()[0], USER_E):
                fail("admin claim did not become auth.uid()")
            cur.execute(
                "INSERT INTO organization_private_data (organization_id, created_by, label) VALUES (%s,%s,'admin row')",
                (ORG_A, USER_E),
            )
            cur.execute(
                "SELECT count(*) FROM organization_private_data WHERE label = 'admin row'"
            )
            if cur.fetchone()[0] != 1:
                fail("admin could not read the row just written")
        conn.commit()
        ok("admin can write inside organization A")

        as_user(conn, USER_B)
        with conn.cursor() as cur:
            cur.execute("UPDATE organizations SET name = 'hijack' WHERE id = %s", (ORG_A,))
            if cur.rowcount != 0:
                fail("member updated the organization")
        conn.rollback()
        ok("member cannot update the organization row")

        as_user(conn, USER_A)
        with conn.cursor() as cur:
            cur.execute("SELECT name FROM organizations WHERE id = %s", (ORG_A,))
            if cur.fetchone()[0] != "Farm A":
                fail("organization A name changed before the owner update")
            cur.execute("UPDATE organizations SET name = 'Org A renamed' WHERE id = %s", (ORG_A,))
            if cur.rowcount != 1:
                fail(f"owner update rowcount={cur.rowcount}")
            cur.execute("SELECT count(*) FROM organizations WHERE id = %s", (ORG_B,))
            if cur.fetchone()[0] != 0:
                fail("owner of A can read organization B")
            cur.execute("UPDATE organizations SET name = 'cross' WHERE id = %s", (ORG_B,))
            if cur.rowcount != 0:
                fail("owner of A modified organization B")
        conn.commit()
        ok("owner updates organization A and cannot read or modify organization B")
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--phase", choices=("schema", "behavior"), required=True)
    args = parser.parse_args()
    if args.phase == "schema":
        phase_schema()
    else:
        phase_behavior()


if __name__ == "__main__":
    main()
