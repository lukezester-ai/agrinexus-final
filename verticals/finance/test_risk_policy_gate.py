import json
import os

import psycopg2
import pytest

from engine.policy import policy_digest, validate_risk_policy
from test_integration_gate import ORG_A, ORG_B, USER_A, USER_B, USER_C, USER_D, as_user

SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
APP_DSN = os.environ.get("DB_URL_APPUSER")
USER_ADMIN = "55555555-5555-5555-5555-555555555555"

pytestmark = pytest.mark.skipif(
    not SUPER_DSN or not APP_DSN,
    reason="DB_URL_SUPERUSER and DB_URL_APPUSER are required",
)


def _document(**overrides) -> dict:
    document = {
        "max_risk_per_position": 0.25,
        "max_exposure": 1,
        "max_drawdown": 0.2,
        "max_concurrent_positions": 2,
        "allowed_instruments": ["BETA", "ACME"],
        "allowed_strategies": ["long-v2"],
        "forbidden_actions": [],
    }
    document.update(overrides)
    return document


def _error_text(error: BaseException) -> str:
    return getattr(error, "pgerror", None) or str(error)


def test_risk_policy_is_a_canonical_document_without_evaluation():
    canonical = validate_risk_policy(_document())
    changed = validate_risk_policy(_document(max_drawdown=0.3))
    digest = policy_digest(canonical)
    changed_digest = policy_digest(changed)
    assert digest != changed_digest

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            """
            SELECT count(*)
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname ~* 'broker|execution_gateway|live_order|copilot|openai'
            """
        )
        assert cur.fetchone()[0] == 0
        cur.execute(
            """
            SELECT p.prosrc
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname IN ('finance_create_risk_policy', 'finance_replace_risk_policy')
            """
        )
        for (source,) in cur.fetchall():
            for name in (
                "finance_apply_paper_book",
                "finance_approve_strategy_result",
                "finance_run_spec_backtest",
                "finance_run_snapshot_strategy",
                "finance_execute_strategy",
                "finance_compile_strategy_candidate",
            ):
                assert name not in source
        cur.execute("TRUNCATE public.organizations CASCADE")
        cur.execute(
            "INSERT INTO public.organizations (id, name, owner_user_id) VALUES (%s, 'Fund A', %s), (%s, 'Fund B', %s)",
            (ORG_A, USER_A, ORG_B, USER_C),
        )
        cur.execute(
            """
            INSERT INTO public.organization_memberships (organization_id, user_id, role)
            VALUES (%s,%s,'owner'),(%s,%s,'admin'),(%s,%s,'member'),(%s,%s,'viewer'),(%s,%s,'owner')
            """,
            (ORG_A, USER_A, ORG_A, USER_ADMIN, ORG_A, USER_B, ORG_A, USER_D, ORG_B, USER_C),
        )

    member = psycopg2.connect(APP_DSN)
    member.autocommit = False
    try:
        as_user(member, USER_B)
        with member.cursor() as cur:
            cur.execute("SAVEPOINT unknown_org_field")
            with pytest.raises(psycopg2.Error) as rejected:
                cur.execute(
                    "SELECT public.finance_create_risk_policy(%s, %s::jsonb)",
                    (ORG_A, json.dumps(_document(organization_id=ORG_A))),
                )
            assert "risk policy is invalid" in _error_text(rejected.value)
            cur.execute("ROLLBACK TO SAVEPOINT unknown_org_field")
            for payload in (
                _document(broker="live"),
                _document(live=True),
                _document(forbidden_actions=["broker"]),
                _document(forbidden_actions=["live"]),
            ):
                cur.execute("SAVEPOINT refused_command")
                with pytest.raises(psycopg2.Error) as refused:
                    cur.execute(
                        "SELECT public.finance_create_risk_policy(%s, %s::jsonb)",
                        (ORG_A, json.dumps(payload)),
                    )
                assert "risk policy is invalid" in _error_text(refused.value)
                cur.execute("ROLLBACK TO SAVEPOINT refused_command")
            missing = _document()
            del missing["max_exposure"]
            cur.execute("SAVEPOINT missing_field")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "SELECT public.finance_create_risk_policy(%s, %s::jsonb)",
                    (ORG_A, json.dumps(missing)),
                )
            cur.execute("ROLLBACK TO SAVEPOINT missing_field")
            cur.execute("SELECT count(*) FROM public.finance_risk_policies")
            assert cur.fetchone()[0] == 0

            cur.execute(
                "SELECT public.finance_create_risk_policy(%s, %s::jsonb)",
                (ORG_A, json.dumps(_document(allowed_instruments=["BETA", "ACME"]))),
            )
            policy_id = cur.fetchone()[0]
            cur.execute(
                """
                SELECT organization_id, policy_digest, created_by,
                       policy->>'max_risk_per_position', policy->>'max_exposure',
                       policy->>'max_drawdown', policy->>'max_concurrent_positions',
                       policy->'allowed_instruments', policy->'allowed_strategies',
                       policy->'forbidden_actions'
                FROM public.finance_risk_policies
                WHERE id = %s
                """,
                (policy_id,),
            )
            row = cur.fetchone()
            assert row[0] == ORG_A
            assert row[1] == digest
            assert row[2] == USER_B
            assert row[3:] == (
                json.dumps(canonical["max_risk_per_position"]),
                json.dumps(canonical["max_exposure"]),
                json.dumps(canonical["max_drawdown"]),
                json.dumps(canonical["max_concurrent_positions"]),
                canonical["allowed_instruments"],
                canonical["allowed_strategies"],
                canonical["forbidden_actions"],
            )
            cur.execute(
                """
                SELECT actor_user_id, details
                FROM public.finance_audit_log
                WHERE action = 'risk_policy.created' AND subject_id = %s
                """,
                (policy_id,),
            )
            actor, details = cur.fetchone()
            assert actor == USER_B
            parsed = json.loads(details) if isinstance(details, str) else details
            assert parsed["policy_digest"] == digest

            cur.execute("SAVEPOINT direct_update")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "UPDATE public.finance_risk_policies SET policy_digest = %s WHERE id = %s",
                    ("0" * 32, policy_id),
                )
            cur.execute("ROLLBACK TO SAVEPOINT direct_update")

            cur.execute(
                "SELECT public.finance_replace_risk_policy(%s, %s::jsonb)",
                (policy_id, json.dumps(_document(max_drawdown=0.3))),
            )
            assert cur.fetchone()[0] == policy_id
            cur.execute(
                "SELECT organization_id, policy_digest FROM public.finance_risk_policies WHERE id = %s",
                (policy_id,),
            )
            assert cur.fetchone() == (ORG_A, changed_digest)
            cur.execute(
                """
                SELECT actor_user_id, details->>'policy_digest'
                FROM public.finance_audit_log
                WHERE action = 'risk_policy.replaced' AND subject_id = %s
                """,
                (policy_id,),
            )
            assert cur.fetchone() == (USER_B, changed_digest)

            cur.execute("SAVEPOINT viewer_create")
            as_user(member, USER_D)
            with pytest.raises(psycopg2.Error) as viewer_denied:
                cur.execute(
                    "SELECT public.finance_create_risk_policy(%s, %s::jsonb)",
                    (ORG_A, json.dumps(_document())),
                )
            assert "not an organization writer" in _error_text(viewer_denied.value)
            cur.execute("ROLLBACK TO SAVEPOINT viewer_create")
            cur.execute("SAVEPOINT viewer_replace")
            as_user(member, USER_D)
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "SELECT public.finance_replace_risk_policy(%s, %s::jsonb)",
                    (policy_id, json.dumps(_document())),
                )
            cur.execute("ROLLBACK TO SAVEPOINT viewer_replace")

            as_user(member, USER_A)
            cur.execute(
                "SELECT public.finance_create_risk_policy(%s, %s::jsonb)",
                (ORG_A, json.dumps(_document())),
            )
            owner_policy = cur.fetchone()[0]
            as_user(member, USER_ADMIN)
            cur.execute(
                "SELECT public.finance_create_risk_policy(%s, %s::jsonb)",
                (ORG_A, json.dumps(_document())),
            )
            admin_policy = cur.fetchone()[0]
            cur.execute(
                "SELECT policy_digest FROM public.finance_risk_policies WHERE id IN (%s, %s) ORDER BY id",
                (owner_policy, admin_policy),
            )
            assert {row[0] for row in cur.fetchall()} == {digest}

            cur.execute("SAVEPOINT outsider_create")
            as_user(member, USER_C)
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "SELECT public.finance_create_risk_policy(%s, %s::jsonb)",
                    (ORG_A, json.dumps(_document())),
                )
            cur.execute("ROLLBACK TO SAVEPOINT outsider_create")
        member.commit()
    finally:
        member.close()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_risk_policies")
            assert cur.fetchone()[0] == 0
            cur.execute("SAVEPOINT outsider_replace")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "SELECT public.finance_replace_risk_policy(%s, %s::jsonb)",
                    (policy_id, json.dumps(_document())),
                )
            cur.execute("ROLLBACK TO SAVEPOINT outsider_replace")
        outsider.commit()
    finally:
        outsider.close()
