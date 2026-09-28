import json
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import psycopg2
import pytest

from domain.strategies import V1_LONG_RULE
from engine.backtest import run_long_rule
from engine.fixture import fixture_closes
from engine.indicators import indicator_frame

SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
APP_DSN = os.environ.get("DB_URL_APPUSER")

USER_A = "11111111-1111-1111-1111-111111111111"
USER_B = "22222222-2222-2222-2222-222222222222"
USER_C = "33333333-3333-3333-3333-333333333333"
USER_D = "44444444-4444-4444-4444-444444444444"
ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

pytestmark = pytest.mark.skipif(
    not SUPER_DSN or not APP_DSN,
    reason="DB_URL_SUPERUSER and DB_URL_APPUSER are required",
)


def as_user(conn, user_id: str) -> None:
    claims = json.dumps({"sub": user_id, "role": "authenticated", "aud": "authenticated"})
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                set_config('request.jwt.claim.sub', %s, true),
                set_config('request.jwt.claims', %s, true)
            """,
            (user_id, claims),
        )
        cur.fetchone()


def test_boundaries_and_deterministic_paper_flow():
    closes = fixture_closes()
    expected_fills, expected = run_long_rule(closes)
    expected_point = indicator_frame(closes)[49]
    start = datetime(2024, 1, 1, tzinfo=timezone.utc)
    bars = []
    for index, close in enumerate(closes):
        price = str(close)
        bars.append(
            {
                "bar_index": index,
                "bar_time": (start + timedelta(days=index)).isoformat(),
                "open": price,
                "high": price,
                "low": price,
                "close": price,
                "volume": "1000",
            }
        )

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
        cur.execute(
            """
            SELECT c.relname
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r'
              AND (c.relname LIKE 'business_%%' OR c.relname = 'matching_jobs')
            """
        )
        assert cur.fetchall() == []
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
            cur.execute("SELECT current_user")
            assert cur.fetchone()[0] == "app_user"
            cur.execute(
                "SELECT public.finance_create_instrument(%s, %s, %s)",
                (ORG_A, "ACME", "Acme"),
            )
            instrument_id = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_replace_market_bars(%s, %s::jsonb)",
                (instrument_id, json.dumps(bars)),
            )
            assert cur.fetchone()[0] == len(bars)
            cur.execute(
                "SELECT public.finance_create_strategy(%s, %s, %s::jsonb)",
                (instrument_id, "SMA RSI long", json.dumps(V1_LONG_RULE)),
            )
            strategy_id = cur.fetchone()[0]
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "UPDATE public.finance_strategies SET lifecycle = 'backtested' WHERE id = %s",
                    (strategy_id,),
                )
            member.rollback()
        as_user(member, USER_B)
        with member.cursor() as cur:
            cur.execute(
                "SELECT public.finance_create_instrument(%s, %s, %s)",
                (ORG_A, "ACME", "Acme"),
            )
            instrument_id = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_replace_market_bars(%s, %s::jsonb)",
                (instrument_id, json.dumps(bars)),
            )
            cur.fetchone()
            cur.execute(
                "SELECT public.finance_create_strategy(%s, %s, %s::jsonb)",
                (instrument_id, "SMA RSI long", json.dumps(V1_LONG_RULE)),
            )
            strategy_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_validate_strategy(%s)", (strategy_id,))
            cur.execute("SELECT public.finance_run_backtest(%s)", (strategy_id,))
            backtest_id = cur.fetchone()[0]
            cur.execute(
                """
                SELECT sma_fast, sma_slow, rsi, signal
                FROM public.finance_indicator_points
                WHERE backtest_id = %s AND bar_index = 49
                """,
                (backtest_id,),
            )
            sma_fast, sma_slow, rsi_value, signal = cur.fetchone()
            assert Decimal(sma_fast) == expected_point.sma_fast
            assert Decimal(sma_slow) == expected_point.sma_slow
            assert Decimal(rsi_value) == expected_point.rsi
            assert signal is True
            cur.execute(
                """
                SELECT trade_count, closed_pnl, paper_pnl, ending_equity, total_return, max_drawdown
                FROM public.finance_risk_metrics WHERE backtest_id = %s
                """,
                (backtest_id,),
            )
            row = cur.fetchone()
            assert row[0] == expected.trade_count
            assert Decimal(row[1]) == expected.closed_pnl
            assert Decimal(row[2]) == expected.paper_pnl
            assert Decimal(row[3]) == expected.ending_equity
            assert Decimal(row[4]) == expected.total_return
            assert Decimal(row[5]) == expected.max_drawdown
            cur.execute(
                "SELECT bar_index, side, price, pnl FROM public.finance_backtest_trades WHERE backtest_id = %s ORDER BY bar_index",
                (backtest_id,),
            )
            stored = [(index, side, Decimal(price), None if pnl is None else Decimal(pnl)) for index, side, price, pnl in cur.fetchall()]
            assert stored == [(fill.bar_index, fill.side, fill.price, fill.pnl) for fill in expected_fills]
            cur.execute(
                "SELECT public.finance_open_paper_portfolio(%s, %s, %s)",
                (ORG_A, "Paper", 100000),
            )
            portfolio_id = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_post_paper_from_backtest(%s, %s)",
                (portfolio_id, backtest_id),
            )
            assert Decimal(cur.fetchone()[0]) == expected.paper_pnl
            cur.execute("SELECT cash FROM public.finance_paper_portfolios WHERE id = %s", (portfolio_id,))
            assert Decimal(cur.fetchone()[0]) == expected.ending_equity
            cur.execute(
                "SELECT count(*) FROM public.finance_audit_log WHERE organization_id = %s AND actor_user_id = %s",
                (ORG_A, USER_B),
            )
            assert cur.fetchone()[0] >= 5
            cur.execute("SELECT lifecycle FROM public.finance_strategies WHERE id = %s", (strategy_id,))
            assert cur.fetchone()[0] == "backtested"
        member.commit()
    finally:
        member.close()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_strategies")
            assert cur.fetchone()[0] == 0
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "SELECT public.finance_create_instrument(%s, %s, %s)",
                    (ORG_A, "NOPE", "Nope"),
                )
        outsider.rollback()
    finally:
        outsider.close()

    viewer = psycopg2.connect(APP_DSN)
    viewer.autocommit = False
    try:
        as_user(viewer, USER_D)
        with viewer.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_strategies")
            assert cur.fetchone()[0] == 1
            with pytest.raises(psycopg2.Error):
                cur.execute("SELECT public.finance_validate_strategy(%s)", (strategy_id,))
        viewer.rollback()
    finally:
        viewer.close()
