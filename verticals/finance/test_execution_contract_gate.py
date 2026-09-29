import json
import os

import psycopg2
import pytest

from engine.contract import canonical_execution_contract, execution_identity
from test_integration_gate import ORG_A, ORG_B, USER_A, USER_B, USER_C, USER_D, as_user
from test_order_intent_recheck_gate import _bars, _policy, _prepare

SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
APP_DSN = os.environ.get("DB_URL_APPUSER")

pytestmark = pytest.mark.skipif(
    not SUPER_DSN or not APP_DSN,
    reason="DB_URL_SUPERUSER and DB_URL_APPUSER are required",
)

BLOCKED_CALLERS = (
    "finance_compile_strategy_candidate",
    "finance_run_compiled_strategy",
    "finance_apply_paper_book",
    "finance_approve_strategy_result",
    "finance_evaluate_risk_policy",
    "finance_create_risk_policy",
    "finance_replace_risk_policy",
    "finance_create_order_intent",
    "finance_recheck_order_intent",
    "finance_authorize_order_intent",
    "finance_match_order_authorization",
    "finance_gateway_boundary",
)


def _error_text(error: BaseException) -> str:
    return getattr(error, "pgerror", None) or str(error)


def _counts(cur) -> tuple:
    cur.execute(
        """
        SELECT
            (SELECT count(*) FROM public.finance_order_intents),
            (SELECT count(*) FROM public.finance_order_authorizations),
            (SELECT count(*) FROM public.finance_risk_evaluations),
            (SELECT count(*) FROM public.finance_paper_allocations),
            (SELECT count(*) FROM public.finance_execution_contracts)
        """
    )
    return cur.fetchone()


def test_execution_contract_binds_one_authorization_and_does_not_send():
    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            """
            SELECT count(*)
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname ~* 'broker|execution_gateway|live_order'
            """
        )
        assert cur.fetchone()[0] == 0
        cur.execute(
            """
            SELECT count(*)
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name ~* 'broker|execution_gateway|live_order'
            """
        )
        assert cur.fetchone()[0] == 0
        cur.execute(
            """
            SELECT p.proname
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.prosrc LIKE '%finance_gateway_boundary%'
              AND p.proname <> 'finance_gateway_boundary'
            """
        )
        assert cur.fetchall() == [("finance_create_execution_contract",)]
        cur.execute(
            """
            SELECT p.proname, p.prosrc
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = ANY(%s)
            """,
            (["finance_create_execution_contract", *BLOCKED_CALLERS],),
        )
        sources = dict(cur.fetchall())
        contract_source = sources["finance_create_execution_contract"]
        assert "finance_gateway_boundary" in contract_source
        assert "finance_match_order_authorization" not in contract_source
        for name in (
            "finance_apply_paper_book",
            "finance_paper_allocations",
            "finance_create_order_intent",
            "finance_evaluate_risk_policy",
            "finance_authorize_order_intent",
            "metrics_from_equity",
            "peak",
            "broker",
            "live_order",
            "execution_gateway",
            "http",
            "dblink",
        ):
            assert name not in contract_source
        for name in BLOCKED_CALLERS:
            assert "finance_create_execution_contract" not in sources[name]
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

    member = psycopg2.connect(APP_DSN)
    member.autocommit = False
    try:
        as_user(member, USER_B)
        with member.cursor() as cur:
            cur.execute("SELECT public.finance_create_instrument(%s, %s, %s)", (ORG_A, "ACME", "Acme"))
            instrument_id = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_replace_market_bars(%s, %s::jsonb)",
                (instrument_id, json.dumps(_bars())),
            )
            cur.fetchone()
            policy_id, intent_id, intent_digest = _prepare(cur, instrument_id, "Open")
            cur.execute("SAVEPOINT missing_authorization")
            with pytest.raises(psycopg2.Error) as missing:
                cur.execute(
                    "SELECT public.finance_create_execution_contract(%s, %s::jsonb)",
                    (intent_id, "{}"),
                )
            assert "order authorization not found" in _error_text(missing.value)
            cur.execute("ROLLBACK TO SAVEPOINT missing_authorization")
            cur.execute(
                "SELECT public.finance_authorize_order_intent(%s, %s::jsonb)",
                (intent_id, "{}"),
            )
            authorization_id = cur.fetchone()[0]
            cur.execute(
                """
                SELECT authorization_digest, intent_id::text, intent_digest, evaluation_digest
                FROM public.finance_order_authorizations
                WHERE id = %s
                """,
                (authorization_id,),
            )
            authorization_digest, linked_intent, stored_intent_digest, evaluation_digest = cur.fetchone()
            assert stored_intent_digest == intent_digest
            cur.execute(
                """
                SELECT intent->>'instrument', intent->>'side', intent->>'quantity'
                FROM public.finance_order_intents
                WHERE id = %s
                """,
                (intent_id,),
            )
            instrument_text, side_text, quantity_text = cur.fetchone()
            for payload in (
                None,
                [],
                {"instrument": "OTHER"},
                {"side": "short"},
                {"quantity": "9.000000"},
                {"price": "1"},
                {"venue": "NYSE"},
                {"broker": "desk"},
                {"order": {}},
            ):
                cur.execute("SAVEPOINT rejected_contract")
                with pytest.raises(psycopg2.Error) as rejected:
                    cur.execute(
                        "SELECT public.finance_create_execution_contract(%s, %s::jsonb)",
                        (authorization_id, json.dumps(payload)),
                    )
                assert "execution contract is invalid" in _error_text(rejected.value)
                cur.execute("ROLLBACK TO SAVEPOINT rejected_contract")

            cur.execute(
                "SELECT public.finance_replace_risk_policy(%s, %s::jsonb)",
                (policy_id, json.dumps(_policy("Open", max_drawdown=0.5))),
            )
            cur.fetchone()
            cur.execute("SAVEPOINT stale_policy")
            with pytest.raises(psycopg2.Error) as stale_policy:
                cur.execute(
                    "SELECT public.finance_create_execution_contract(%s, %s::jsonb)",
                    (authorization_id, "{}"),
                )
            assert "order intent does not match" in _error_text(stale_policy.value)
            cur.execute("ROLLBACK TO SAVEPOINT stale_policy")
            cur.execute("SELECT count(*) FROM public.finance_execution_contracts")
            assert cur.fetchone()[0] == 0
            cur.execute(
                "SELECT public.finance_replace_risk_policy(%s, %s::jsonb)",
                (policy_id, json.dumps(_policy("Open"))),
            )
            cur.fetchone()
            before = _counts(cur)
            cur.execute(
                """
                SELECT count(*)
                FROM public.finance_audit_log
                WHERE action = 'gateway_boundary.admitted' AND subject_id = %s
                """,
                (authorization_id,),
            )
            gateway_before = cur.fetchone()[0]

            cur.execute(
                "SELECT public.finance_create_execution_contract(%s, %s::jsonb)",
                (authorization_id, "{}"),
            )
            contract_id = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_create_execution_contract(%s, %s::jsonb)",
                (authorization_id, "{}"),
            )
            assert cur.fetchone()[0] == contract_id
            after = _counts(cur)
            assert after[:4] == before[:4]
            assert after[4] == before[4] + 1
            expected = canonical_execution_contract(
                str(authorization_id),
                authorization_digest,
                linked_intent,
                intent_digest,
                evaluation_digest,
                instrument_text,
                side_text,
                quantity_text,
            )
            identity = execution_identity(expected)
            cur.execute(
                """
                SELECT organization_id, authorization_id::text, intent_id::text, execution_identity,
                       contract, created_by
                FROM public.finance_execution_contracts
                WHERE id = %s
                """,
                (contract_id,),
            )
            row = cur.fetchone()
            assert row[:4] == (ORG_A, str(authorization_id), str(intent_id), identity)
            assert row[4] == expected
            assert row[5] == USER_B
            assert "price" not in row[4]
            assert "venue" not in row[4]
            cur.execute(
                """
                SELECT count(*), max(details->>'execution_identity'), max(details->>'instrument'),
                       max(details->>'side'), max(details->>'quantity')
                FROM public.finance_audit_log
                WHERE action = 'execution_contract.created' AND subject_id = %s
                """,
                (contract_id,),
            )
            assert cur.fetchone() == (1, identity, instrument_text, side_text, quantity_text)
            cur.execute(
                """
                SELECT count(*)
                FROM public.finance_audit_log
                WHERE action = 'gateway_boundary.admitted' AND subject_id = %s
                """,
                (authorization_id,),
            )
            assert cur.fetchone()[0] == gateway_before + 2

            cur.execute("SAVEPOINT direct_update")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "UPDATE public.finance_execution_contracts SET execution_identity = %s WHERE id = %s",
                    ("0" * 32, contract_id),
                )
            cur.execute("ROLLBACK TO SAVEPOINT direct_update")
            cur.execute("SAVEPOINT viewer_contract")
            as_user(member, USER_D)
            with pytest.raises(psycopg2.Error) as viewer_denied:
                cur.execute(
                    "SELECT public.finance_create_execution_contract(%s, %s::jsonb)",
                    (authorization_id, "{}"),
                )
            assert "not an organization writer" in _error_text(viewer_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT viewer_contract")
            cur.execute("SAVEPOINT outsider_contract")
            as_user(member, USER_C)
            with pytest.raises(psycopg2.Error) as outsider_denied:
                cur.execute(
                    "SELECT public.finance_create_execution_contract(%s, %s::jsonb)",
                    (authorization_id, "{}"),
                )
            assert "not an organization writer" in _error_text(outsider_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT outsider_contract")
        member.commit()
    finally:
        member.close()

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute("SAVEPOINT immutable_contract")
        with pytest.raises(psycopg2.Error) as immutable:
            cur.execute(
                "UPDATE public.finance_execution_contracts SET execution_identity = %s WHERE id = %s",
                ("0" * 32, contract_id),
            )
        assert "execution contract is immutable" in _error_text(immutable.value)
        cur.execute("ROLLBACK TO SAVEPOINT immutable_contract")
        cur.execute(
            "UPDATE public.finance_order_intents SET intent_digest = %s WHERE id = %s",
            ("f" * 32, intent_id),
        )
        admin.commit()

    checker = psycopg2.connect(APP_DSN)
    checker.autocommit = False
    try:
        as_user(checker, USER_B)
        with checker.cursor() as cur:
            cur.execute("SAVEPOINT stale_intent")
            with pytest.raises(psycopg2.Error) as stale_intent:
                cur.execute(
                    "SELECT public.finance_create_execution_contract(%s, %s::jsonb)",
                    (authorization_id, "{}"),
                )
            assert "order authorization does not match" in _error_text(stale_intent.value)
            cur.execute("ROLLBACK TO SAVEPOINT stale_intent")
            cur.execute(
                "SELECT execution_identity, contract->>'instrument' FROM public.finance_execution_contracts WHERE id = %s",
                (contract_id,),
            )
            assert cur.fetchone() == (identity, instrument_text)
        checker.commit()
    finally:
        checker.close()

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            "UPDATE public.finance_order_intents SET intent_digest = %s WHERE id = %s",
            (intent_digest, intent_id),
        )
        cur.execute(
            """
            UPDATE public.finance_order_intents
            SET intent = jsonb_set(intent, '{instrument}', to_jsonb(%s::text))
            WHERE id = %s
            """,
            ("OTHER", intent_id),
        )
        admin.commit()

    checker = psycopg2.connect(APP_DSN)
    checker.autocommit = False
    try:
        as_user(checker, USER_B)
        with checker.cursor() as cur:
            cur.execute("SAVEPOINT changed_instrument")
            with pytest.raises(psycopg2.Error) as changed:
                cur.execute(
                    "SELECT public.finance_create_execution_contract(%s, %s::jsonb)",
                    (authorization_id, "{}"),
                )
            assert "execution contract does not match" in _error_text(changed.value)
            cur.execute("ROLLBACK TO SAVEPOINT changed_instrument")
            cur.execute(
                "SELECT contract->>'instrument', execution_identity FROM public.finance_execution_contracts WHERE id = %s",
                (contract_id,),
            )
            assert cur.fetchone() == (instrument_text, identity)
        checker.commit()
    finally:
        checker.close()

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            """
            UPDATE public.finance_order_intents
            SET intent = jsonb_set(intent, '{instrument}', to_jsonb(%s::text))
            WHERE id = %s
            """,
            (instrument_text, intent_id),
        )
        admin.commit()

    restored = psycopg2.connect(APP_DSN)
    restored.autocommit = False
    try:
        as_user(restored, USER_B)
        with restored.cursor() as cur:
            cur.execute(
                "SELECT public.finance_create_execution_contract(%s, %s::jsonb)",
                (authorization_id, "{}"),
            )
            assert cur.fetchone()[0] == contract_id
            cur.execute("SELECT count(*) FROM public.finance_execution_contracts")
            assert cur.fetchone()[0] == 1
            cur.execute("SELECT count(*) FROM public.finance_paper_allocations")
            assert cur.fetchone()[0] == 0
        restored.commit()
    finally:
        restored.close()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_execution_contracts")
            assert cur.fetchone()[0] == 0
        outsider.commit()
    finally:
        outsider.close()
