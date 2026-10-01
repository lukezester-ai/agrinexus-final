import json
import os
import threading
import time
from decimal import Decimal

import psycopg2
import pytest

from test_integration_gate import ORG_A, ORG_B, USER_A, USER_B, USER_C, USER_D, as_user
from test_observed_result_gate import _dispatch, _error_text, _hold
from test_order_intent_recheck_gate import _bars
from test_post_dispatch_kill_switch_gate import _prepare_in

SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
APP_DSN = os.environ.get("DB_URL_APPUSER")

pytestmark = pytest.mark.skipif(
    not SUPER_DSN or not APP_DSN,
    reason="DB_URL_SUPERUSER and DB_URL_APPUSER are required",
)


def _deny(cur, call, message):
    cur.execute("SAVEPOINT denied")
    with pytest.raises(psycopg2.Error) as denied:
        call()
    assert message in _error_text(denied.value)
    cur.execute("ROLLBACK TO SAVEPOINT denied")


def _audit_count(cur, action):
    cur.execute("SELECT count(*) FROM public.finance_audit_log WHERE action = %s", (action,))
    return cur.fetchone()[0]


def _prepare_orgs(cur):
    cur.execute("TRUNCATE public.organizations CASCADE")
    cur.execute(
        "INSERT INTO public.organizations (id, name, owner_user_id) VALUES (%s, 'Fund A', %s), (%s, 'Fund B', %s)",
        (ORG_A, USER_A, ORG_B, USER_C),
    )
    cur.execute(
        """
        INSERT INTO public.organization_memberships (organization_id, user_id, role)
        VALUES (%s,%s,'owner'),(%s,%s,'member'),(%s,%s,'viewer'),(%s,%s,'owner')
        """,
        (ORG_A, USER_A, ORG_A, USER_B, ORG_A, USER_D, ORG_B, USER_C),
    )


def _instrument(cur, organization_id):
    cur.execute("SELECT public.finance_create_instrument(%s, %s, %s)", (organization_id, "ACME", "Acme"))
    instrument_id = cur.fetchone()[0]
    cur.execute(
        "SELECT public.finance_replace_market_bars(%s, %s::jsonb)",
        (instrument_id, json.dumps(_bars())),
    )
    cur.fetchone()
    return instrument_id


def test_dispatch_rereads_the_organization_limit_without_sending():
    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            """
            SELECT p.proname, p.prosrc
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = ANY(%s)
            """,
            (
                [
                    "finance_record_production_dispatch",
                    "finance_set_production_limit",
                    "finance_lock_production_limit",
                    "finance_production_limit_document",
                ],
            ),
        )
        sources = dict(cur.fetchall())
        dispatch_source = sources["finance_record_production_dispatch"]
        assert "finance_lock_production_limit" in dispatch_source
        assert "production limit re-check denied" in dispatch_source
        assert "production kill switch is engaged" in dispatch_source
        assert "finance_assert_production_kill_switch_clear" not in dispatch_source
        assert "finance_lock_production_limit" in sources["finance_set_production_limit"]
        for source in sources.values():
            for forbidden in ("broker", "urllib", "http", "credential", "endpoint", "live_order", "sent = TRUE", "live_permitted = TRUE"):
                assert forbidden not in source
        _prepare_orgs(cur)

    member = psycopg2.connect(APP_DSN)
    member.autocommit = False
    try:
        as_user(member, USER_B)
        with member.cursor() as cur:
            instrument_id = _instrument(cur, ORG_A)
            open_contract = _hold(cur, instrument_id, "Open")[1]
            kept_contract = _hold(cur, instrument_id, "Kept")[1]
            strict_contract = _hold(cur, instrument_id, "Strict")[1]
            loose_contract = _hold(cur, instrument_id, "Loose")[1]
            invalid_contract = _hold(cur, instrument_id, "Invalid")[1]
            payload_contract = _hold(cur, instrument_id, "Payload")[1]
            switch_contract = _hold(cur, instrument_id, "Switch")[1]

            cur.execute("SAVEPOINT direct_insert")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    """
                    INSERT INTO public.finance_production_limit_documents (organization_id, document, created_by)
                    VALUES (%s, '{}'::jsonb, %s)
                    """,
                    (ORG_A, USER_B),
                )
            cur.execute("ROLLBACK TO SAVEPOINT direct_insert")

            open_id = _dispatch(cur, open_contract)
            cur.execute(
                "SELECT admitted, sent, live_permitted FROM public.finance_production_dispatches WHERE id = %s",
                (open_id,),
            )
            assert cur.fetchone() == (False, False, False)
            cur.execute(
                """
                SELECT order_limit, exposure_limit, decision, admitted
                FROM public.finance_production_safety_controls WHERE contract_id = %s
                """,
                (open_contract,),
            )
            assert cur.fetchone() == (Decimal("1"), Decimal("10000"), "held", False)

            with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as admin_cur:
                admin_cur.execute(
                    """
                    INSERT INTO public.finance_production_limit_documents (organization_id, document, created_by)
                    VALUES (%s, '{"order_limit": -1, "exposure_limit": 10000}'::jsonb, %s)
                    """,
                    (ORG_A, USER_B),
                )
            _deny(cur, lambda: _dispatch(cur, invalid_contract), "production limit re-check denied")
            with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as admin_cur:
                admin_cur.execute(
                    "DELETE FROM public.finance_production_limit_documents WHERE organization_id = %s",
                    (ORG_A,),
                )

            cur.execute(
                "SELECT public.finance_set_production_limit(%s, %s::jsonb)",
                (ORG_A, json.dumps({"order_limit": 2, "exposure_limit": 100000})),
            )
            cur.fetchone()
            assert _dispatch(cur, loose_contract) is not None
            cur.execute(
                """
                SELECT order_limit, exposure_limit
                FROM public.finance_production_safety_controls WHERE contract_id = %s
                """,
                (loose_contract,),
            )
            assert cur.fetchone() == (Decimal("1"), Decimal("10000"))

            kept_id = _dispatch(cur, kept_contract)
            cur.execute(
                "SELECT public.finance_set_production_limit(%s, %s::jsonb)",
                (ORG_A, json.dumps({"order_limit": 0, "exposure_limit": 0})),
            )
            cur.fetchone()
            assert _dispatch(cur, kept_contract) == kept_id
            recorded_before = _audit_count(cur, "production_dispatch.recorded")
            _deny(cur, lambda: _dispatch(cur, strict_contract), "production limit re-check denied")
            assert _audit_count(cur, "production_dispatch.recorded") == recorded_before
            cur.execute(
                "SELECT count(*) FROM public.finance_production_dispatches WHERE contract_id = %s",
                (strict_contract,),
            )
            assert cur.fetchone()[0] == 0
            cur.execute(
                "SELECT count(*) FROM public.finance_production_external_results WHERE contract_id = %s",
                (strict_contract,),
            )
            assert cur.fetchone()[0] == 0
            cur.execute(
                "SELECT count(*) FROM public.finance_observed_production_results WHERE contract_id = %s",
                (strict_contract,),
            )
            assert cur.fetchone()[0] == 0
            cur.execute(
                """
                SELECT order_limit, exposure_limit, decision, admitted
                FROM public.finance_production_safety_controls WHERE contract_id = %s
                """,
                (strict_contract,),
            )
            assert cur.fetchone() == (Decimal("1"), Decimal("10000"), "held", False)

            as_user(member, USER_C)
            cur.execute("SELECT count(*) FROM public.finance_production_limit_documents")
            assert cur.fetchone()[0] == 0
            _deny(
                cur,
                lambda: cur.execute(
                    "SELECT public.finance_set_production_limit(%s, %s::jsonb)",
                    (ORG_A, json.dumps({"order_limit": 1, "exposure_limit": 10000})),
                ),
                "not an organization writer",
            )
            other_instrument = _instrument(cur, ORG_B)
            other_contract = _prepare_in(cur, other_instrument, "Other", ORG_B)
            other_id = _dispatch(cur, other_contract)
            cur.execute(
                """
                SELECT admitted, sent, live_permitted, organization_id
                FROM public.finance_production_dispatches WHERE id = %s
                """,
                (other_id,),
            )
            admitted, sent, live_permitted, organization_id = cur.fetchone()
            assert (admitted, sent, live_permitted) == (False, False, False)
            assert str(organization_id) == ORG_B

            as_user(member, USER_B)
            cur.execute(
                "SELECT public.finance_set_production_limit(%s, %s::jsonb)",
                (ORG_A, json.dumps({"exposure_limit": 10000, "order_limit": 1})),
            )
            cur.fetchone()

            _deny(
                cur,
                lambda: cur.execute(
                    "SELECT public.finance_record_production_dispatch(%s, %s::jsonb)",
                    (payload_contract, json.dumps({"order_limit": 0, "exposure_limit": 0})),
                ),
                "production dispatch is invalid",
            )
            as_user(member, USER_D)
            _deny(
                cur,
                lambda: cur.execute(
                    "SELECT public.finance_set_production_limit(%s, %s::jsonb)",
                    (ORG_A, json.dumps({"order_limit": 1, "exposure_limit": 10000})),
                ),
                "not an organization writer",
            )
            as_user(member, USER_B)
            cur.execute(
                "SELECT public.finance_engage_production_kill_switch(%s, '{}'::jsonb)",
                (switch_contract,),
            )
            cur.fetchone()
            _deny(cur, lambda: _dispatch(cur, switch_contract), "production kill switch is engaged")
            cur.execute(
                "SELECT count(*) FROM public.finance_production_dispatches WHERE contract_id = %s",
                (switch_contract,),
            )
            assert cur.fetchone()[0] == 0
        member.commit()
    finally:
        member.close()


def test_limit_write_blocks_dispatch_until_the_stricter_document_commits():
    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        _prepare_orgs(cur)

    member = psycopg2.connect(APP_DSN)
    member.autocommit = False
    try:
        as_user(member, USER_B)
        with member.cursor() as cur:
            instrument_id = _instrument(cur, ORG_A)
            contract_id = _hold(cur, instrument_id, "Race")[1]
        member.commit()
    finally:
        member.close()

    holder = psycopg2.connect(APP_DSN)
    holder.autocommit = False
    ready = threading.Event()
    done = threading.Event()
    result = {}
    try:
        as_user(holder, USER_B)
        with holder.cursor() as cur:
            cur.execute("SELECT public.finance_lock_production_limit(%s)", (ORG_A,))

        def run_dispatch():
            conn = psycopg2.connect(APP_DSN)
            conn.autocommit = False
            try:
                as_user(conn, USER_B)
                with conn.cursor() as cur:
                    cur.execute("SET statement_timeout = '15s'")
                    cur.execute("SELECT pg_backend_pid()")
                    result["pid"] = cur.fetchone()[0]
                    ready.set()
                    cur.execute(
                        "SELECT public.finance_record_production_dispatch(%s, '{}'::jsonb)",
                        (contract_id,),
                    )
                    result["id"] = cur.fetchone()[0]
                conn.commit()
            except Exception as exc:
                result["error"] = _error_text(exc)
                conn.rollback()
            finally:
                done.set()
                conn.close()

        worker = threading.Thread(target=run_dispatch)
        worker.start()
        assert ready.wait(5)
        waiting = False
        deadline = time.time() + 5
        with psycopg2.connect(SUPER_DSN) as watcher, watcher.cursor() as cur:
            while time.time() < deadline:
                cur.execute(
                    "SELECT wait_event_type, wait_event FROM pg_stat_activity WHERE pid = %s",
                    (result["pid"],),
                )
                state = cur.fetchone()
                if state == ("Lock", "advisory"):
                    waiting = True
                    break
                time.sleep(0.05)
        assert waiting
        with holder.cursor() as cur:
            cur.execute(
                "SELECT public.finance_set_production_limit(%s, %s::jsonb)",
                (ORG_A, json.dumps({"order_limit": 0, "exposure_limit": 0})),
            )
            cur.fetchone()
        holder.commit()
        assert done.wait(10)
        worker.join(5)
    finally:
        if not done.is_set():
            pid = result.get("pid")
            if pid is not None:
                with psycopg2.connect(SUPER_DSN) as watcher, watcher.cursor() as cur:
                    cur.execute("SELECT pg_cancel_backend(%s)", (pid,))
            holder.rollback()
        holder.close()

    assert "production limit re-check denied" in result.get("error", "")
    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            "SELECT count(*) FROM public.finance_production_dispatches WHERE contract_id = %s",
            (contract_id,),
        )
        assert cur.fetchone()[0] == 0
