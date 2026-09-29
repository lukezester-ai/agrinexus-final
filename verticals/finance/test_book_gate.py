import json
import os
from datetime import datetime, timedelta, timezone

import psycopg2
import pytest

from domain.strategies import V1_LONG_RULE, V2_LONG_RULE
from engine.book import run_spec_book
from engine.fixture import fixture_closes
from engine.test_book import ALWAYS_LONG, LOSS_RULE

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
            "SELECT set_config('request.jwt.claim.sub', %s, true), set_config('request.jwt.claims', %s, true)",
            (user_id, claims),
        )
        cur.fetchone()


def _bars() -> list[dict]:
    start = datetime(2024, 1, 1, tzinfo=timezone.utc)
    bars = []
    for index, close in enumerate(fixture_closes()):
        price = format(close, "f")
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
    return bars


def _allow_evaluation(cur, book_id):
    cur.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = 'finance_evaluate_risk_policy'
        )
        """
    )
    if not cur.fetchone()[0]:
        return None
    cur.execute(
        """
        SELECT books.organization_id, strategies.name, instruments.symbol
        FROM public.finance_spec_books books
        JOIN public.finance_strategies strategies ON strategies.id = books.strategy_id
        JOIN public.finance_instruments instruments ON instruments.id = strategies.instrument_id
        WHERE books.id = %s
        """,
        (book_id,),
    )
    org_id, name, symbol = cur.fetchone()
    document = {
        "max_risk_per_position": 1,
        "max_exposure": 1000000,
        "max_drawdown": 1,
        "max_concurrent_positions": 1,
        "allowed_instruments": [symbol],
        "allowed_strategies": [name],
        "forbidden_actions": [],
    }
    cur.execute(
        "SELECT public.finance_create_risk_policy(%s, %s::jsonb)",
        (org_id, json.dumps(document)),
    )
    policy_id = cur.fetchone()[0]
    cur.execute("SELECT public.finance_evaluate_risk_policy(%s, %s)", (policy_id, book_id))
    evaluation_id = cur.fetchone()[0]
    cur.execute(
        "SELECT accepted FROM public.finance_risk_evaluations WHERE id = %s",
        (evaluation_id,),
    )
    assert cur.fetchone()[0] is True
    return evaluation_id


def _approve_book(cur, book_id) -> None:
    cur.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = 'finance_approve_strategy_result'
        )
        """
    )
    if cur.fetchone()[0]:
        _allow_evaluation(cur, book_id)
        cur.execute("SELECT public.finance_approve_strategy_result(%s)", (book_id,))
        cur.fetchone()


def _assert_book(cur, book_id, expected) -> None:
    cur.execute(
        """
        SELECT trade_index, entry_bar, exit_bar, entry_price, exit_price, quantity, pnl
        FROM public.finance_trade_ledger
        WHERE book_id = %s
        ORDER BY trade_index
        """,
        (book_id,),
    )
    assert cur.fetchall() == [
        (trade.trade_index, trade.entry_bar, trade.exit_bar, trade.entry_price, trade.exit_price, trade.quantity, trade.pnl)
        for trade in expected.ledger
    ]
    cur.execute(
        """
        SELECT trade_count, win_count, loss_count, win_rate, avg_trade, gross_profit, gross_loss,
               profit_factor, closed_pnl, paper_pnl, ending_equity, total_return, max_drawdown,
               peak_equity, max_drawdown_bars
        FROM public.finance_performance_stats
        WHERE book_id = %s
        """,
        (book_id,),
    )
    stats = expected.stats
    assert cur.fetchone() == (
        stats.trade_count,
        stats.win_count,
        stats.loss_count,
        stats.win_rate,
        stats.avg_trade,
        stats.gross_profit,
        stats.gross_loss,
        stats.profit_factor,
        stats.closed_pnl,
        stats.paper_pnl,
        stats.ending_equity,
        stats.total_return,
        stats.max_drawdown,
        stats.peak_equity,
        stats.max_drawdown_bars,
    )
    cur.execute(
        """
        SELECT bar_index, equity, peak, drawdown
        FROM public.finance_drawdown_points
        WHERE book_id = %s
        ORDER BY bar_index
        """,
        (book_id,),
    )
    assert cur.fetchall() == [(point.bar_index, point.equity, point.peak, point.drawdown) for point in expected.drawdown]
    cur.execute(
        """
        SELECT ending_cash, ending_quantity, avg_price, mark_price, market_value, cash_weight, position_weight, result_digest
        FROM public.finance_spec_books
        WHERE id = %s
        """,
        (book_id,),
    )
    allocation = expected.allocation
    assert cur.fetchone() == (
        allocation.cash,
        allocation.quantity,
        allocation.avg_price,
        allocation.mark_price,
        allocation.market_value,
        allocation.cash_weight,
        allocation.position_weight,
        expected.digest,
    )


def test_spec_book_matches_python_and_posts_paper():
    closes = fixture_closes()
    expected = run_spec_book(closes, V2_LONG_RULE)
    expected_loss = run_spec_book(closes, LOSS_RULE)
    expected_open = run_spec_book(closes, ALWAYS_LONG)
    bars = _bars()
    strategy_id = None
    open_book = None
    portfolio_id = None

    with psycopg2.connect(SUPER_DSN) as admin, admin.cursor() as cur:
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
                (instrument_id, json.dumps(bars)),
            )
            cur.fetchone()
            cur.execute(
                "SELECT public.finance_create_strategy(%s, %s, %s::jsonb)",
                (instrument_id, "DSL long", json.dumps(V2_LONG_RULE)),
            )
            strategy_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_validate_strategy(%s)", (strategy_id,))
            cur.execute("SAVEPOINT before_execute")
            with pytest.raises(psycopg2.Error):
                cur.execute("SELECT public.finance_run_spec_backtest(%s)", (strategy_id,))
            cur.execute("ROLLBACK TO SAVEPOINT before_execute")
            cur.execute("SELECT public.finance_execute_strategy(%s)", (strategy_id,))
            cur.fetchone()
            cur.execute("SELECT public.finance_run_spec_backtest(%s)", (strategy_id,))
            book_id = cur.fetchone()[0]
            _assert_book(cur, book_id, expected)
            cur.execute("SELECT public.finance_run_spec_backtest(%s)", (strategy_id,))
            rerun_id = cur.fetchone()[0]
            _assert_book(cur, rerun_id, expected)
            cur.execute("SAVEPOINT ledger_update")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "UPDATE public.finance_trade_ledger SET pnl = 0 WHERE book_id = %s",
                    (rerun_id,),
                )
            cur.execute("ROLLBACK TO SAVEPOINT ledger_update")

            cur.execute(
                "SELECT public.finance_create_strategy(%s, %s, %s::jsonb)",
                (instrument_id, "Loss", json.dumps(LOSS_RULE)),
            )
            loss_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_validate_strategy(%s)", (loss_id,))
            cur.execute("SELECT public.finance_execute_strategy(%s)", (loss_id,))
            cur.fetchone()
            cur.execute("SELECT public.finance_run_spec_backtest(%s)", (loss_id,))
            _assert_book(cur, cur.fetchone()[0], expected_loss)

            cur.execute(
                "SELECT public.finance_create_strategy(%s, %s, %s::jsonb)",
                (instrument_id, "Open", json.dumps(ALWAYS_LONG)),
            )
            open_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_validate_strategy(%s)", (open_id,))
            cur.execute("SELECT public.finance_execute_strategy(%s)", (open_id,))
            cur.fetchone()
            cur.execute("SELECT public.finance_run_spec_backtest(%s)", (open_id,))
            open_book = cur.fetchone()[0]
            _assert_book(cur, open_book, expected_open)

            cur.execute(
                "SELECT public.finance_open_paper_portfolio(%s, %s, %s)",
                (ORG_A, "Open book", 100000),
            )
            portfolio_id = cur.fetchone()[0]
            _approve_book(cur, open_book)
            cur.execute("SELECT public.finance_apply_paper_book(%s, %s)", (portfolio_id, open_book))
            assert cur.fetchone()[0] == expected_open.stats.paper_pnl
            cur.execute(
                """
                SELECT quantity, avg_price
                FROM public.finance_paper_positions
                WHERE portfolio_id = %s
                """,
                (portfolio_id,),
            )
            assert cur.fetchone() == (expected_open.allocation.quantity, expected_open.allocation.avg_price)
            cur.execute(
                """
                SELECT cash, quantity, cash_weight, position_weight, equity
                FROM public.finance_paper_allocations
                WHERE portfolio_id = %s
                """,
                (portfolio_id,),
            )
            assert cur.fetchone() == (
                expected_open.allocation.cash,
                expected_open.allocation.quantity,
                expected_open.allocation.cash_weight,
                expected_open.allocation.position_weight,
                expected_open.allocation.equity,
            )
            cur.execute("SELECT cash FROM public.finance_paper_portfolios WHERE id = %s", (portfolio_id,))
            assert cur.fetchone()[0] == expected_open.allocation.cash
            cur.execute("SAVEPOINT apply_again")
            with pytest.raises(psycopg2.Error):
                cur.execute("SELECT public.finance_apply_paper_book(%s, %s)", (portfolio_id, open_book))
            cur.execute("ROLLBACK TO SAVEPOINT apply_again")
            cur.execute("SAVEPOINT rebook_applied")
            with pytest.raises(psycopg2.Error):
                cur.execute("SELECT public.finance_run_spec_backtest(%s)", (open_id,))
            cur.execute("ROLLBACK TO SAVEPOINT rebook_applied")

            cur.execute(
                "SELECT public.finance_create_strategy(%s, %s, %s::jsonb)",
                (instrument_id, "V1", json.dumps(V1_LONG_RULE)),
            )
            v1_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_validate_strategy(%s)", (v1_id,))
            cur.execute("SAVEPOINT v1_book")
            with pytest.raises(psycopg2.Error):
                cur.execute("SELECT public.finance_run_spec_backtest(%s)", (v1_id,))
            cur.execute("ROLLBACK TO SAVEPOINT v1_book")
        member.commit()
    finally:
        member.close()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_trade_ledger")
            assert cur.fetchone()[0] == 0
            cur.execute("SELECT count(*) FROM public.finance_paper_allocations")
            assert cur.fetchone()[0] == 0
        outsider.rollback()
    finally:
        outsider.close()

    viewer = psycopg2.connect(APP_DSN)
    viewer.autocommit = False
    try:
        as_user(viewer, USER_D)
        with viewer.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_spec_books")
            assert cur.fetchone()[0] == 3
            with pytest.raises(psycopg2.Error):
                cur.execute("SELECT public.finance_run_spec_backtest(%s)", (strategy_id,))
            with pytest.raises(psycopg2.Error):
                cur.execute("SELECT public.finance_apply_paper_book(%s, %s)", (portfolio_id, open_book))
        viewer.rollback()
    finally:
        viewer.close()
