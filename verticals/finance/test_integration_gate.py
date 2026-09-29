import hashlib
import json
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import psycopg2
import pytest

from domain.screeners import ScreenerSeries
from domain.strategies import V2_LONG_RULE
from engine.book import run_spec_book
from engine.dsl import execute_spec
from engine.fixture import fixture_closes
from engine.snapshot import market_snapshot
from engine.test_book import ALWAYS_LONG
from engine.test_screener import PRICE_RULE
from test_book_gate import _assert_book

SUPER_DSN = os.environ.get("DB_URL_SUPERUSER")
APP_DSN = os.environ.get("DB_URL_APPUSER")

USER_A = "11111111-1111-1111-1111-111111111111"
USER_B = "22222222-2222-2222-2222-222222222222"
USER_C = "33333333-3333-3333-3333-333333333333"
USER_D = "44444444-4444-4444-4444-444444444444"
ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
START = datetime(2024, 1, 1, tzinfo=timezone.utc)
ABOVE_100 = {
    "version": 1,
    "where": {"all": [{"op": "gt", "left": {"close": True}, "right": {"value": 100}}]},
}

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


def _bars(closes: list[Decimal], volume: str) -> list[dict]:
    bars = []
    for index, close in enumerate(closes):
        price = format(close, "f")
        bars.append(
            {
                "bar_index": index,
                "bar_time": (START + timedelta(days=index)).isoformat(),
                "open": price,
                "high": price,
                "low": price,
                "close": price,
                "volume": volume,
            }
        )
    return bars


def _series(symbol: str, closes: list[Decimal], volume: str) -> ScreenerSeries:
    return ScreenerSeries("NONE", symbol, tuple(closes), tuple(Decimal(volume) for _ in closes))


def _strategy_digest(closes: list[Decimal], spec: dict) -> str:
    lines = [
        f"{signal.bar_index}|{str(signal.entry_on).lower()}|{str(signal.exit_on).lower()}|{signal.position}"
        for signal in execute_spec(closes, spec)
    ]
    return hashlib.md5("\n".join(lines).encode("utf-8")).hexdigest()


def _paper_digest(book) -> str:
    allocation = book.allocation
    stats = book.stats
    payload = "|".join(
        [
            "P",
            format(allocation.cash, "f"),
            format(allocation.quantity, "f"),
            format(allocation.avg_price, "f"),
            format(allocation.mark_price, "f"),
            format(allocation.market_value, "f"),
            format(allocation.cash_weight, "f"),
            format(allocation.position_weight, "f"),
            format(stats.ending_equity, "f"),
            format(stats.paper_pnl, "f"),
            format(stats.max_drawdown, "f"),
        ]
    )
    return hashlib.md5(payload.encode("utf-8")).hexdigest()


def _link(cur, link_id):
    cur.execute(
        """
        SELECT book_id, cutoff_bar, snapshot_digest, strategy_digest, book_digest, paper_digest
        FROM public.finance_snapshot_strategy_runs
        WHERE id = %s
        """,
        (link_id,),
    )
    return cur.fetchone()


def test_snapshot_feeds_the_existing_strategy_engine():
    closes = fixture_closes()
    flat = [Decimal("50")] * len(closes)
    later = closes + [closes[-1] + Decimal("0.20")]
    expected = run_spec_book(closes, V2_LONG_RULE)
    opened = run_spec_book(closes, ALWAYS_LONG)
    prefix = run_spec_book(closes[:41], V2_LONG_RULE)
    unbound = run_spec_book(later, V2_LONG_RULE)
    full = market_snapshot(
        [_series("BETA", flat, "10"), _series("ACME", closes, "1000")],
        PRICE_RULE,
    )
    strategy_digest = _strategy_digest(closes, V2_LONG_RULE)
    paper_digest = _paper_digest(expected)
    prefix_strategy_digest = _strategy_digest(closes[:41], V2_LONG_RULE)
    prefix_paper_digest = _paper_digest(prefix)

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
            cur.execute("SELECT public.finance_create_instrument(%s, %s, %s)", (ORG_A, "BETA", "Beta"))
            beta_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_create_instrument(%s, %s, %s)", (ORG_A, "ACME", "Acme"))
            acme_id = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_replace_market_bars(%s, %s::jsonb)",
                (beta_id, json.dumps(_bars(flat, "10"))),
            )
            cur.fetchone()
            cur.execute(
                "SELECT public.finance_replace_market_bars(%s, %s::jsonb)",
                (acme_id, json.dumps(_bars(closes, "1000"))),
            )
            cur.fetchone()
            cur.execute(
                "SELECT public.finance_create_screener(%s, %s, %s::jsonb)",
                (ORG_A, "Liquid rise", json.dumps(PRICE_RULE)),
            )
            screener_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_capture_snapshot(%s, NULL)", (screener_id,))
            snapshot_id = cur.fetchone()[0]
            cur.execute("SELECT result_digest FROM public.finance_market_snapshots WHERE id = %s", (snapshot_id,))
            assert cur.fetchone()[0] == full.digest

            cur.execute(
                "SELECT public.finance_create_strategy(%s, %s, %s::jsonb)",
                (acme_id, "DSL long", json.dumps(V2_LONG_RULE)),
            )
            strategy_id = cur.fetchone()[0]
            cur.execute("SAVEPOINT draft_run")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "SELECT public.finance_run_snapshot_strategy(%s, %s)",
                    (snapshot_id, strategy_id),
                )
            cur.execute("ROLLBACK TO SAVEPOINT draft_run")
            cur.execute("SELECT public.finance_validate_strategy(%s)", (strategy_id,))
            cur.fetchone()

            cur.execute(
                "SELECT public.finance_create_strategy(%s, %s, %s::jsonb)",
                (beta_id, "Beta long", json.dumps(V2_LONG_RULE)),
            )
            beta_strategy = cur.fetchone()[0]
            cur.execute("SELECT public.finance_validate_strategy(%s)", (beta_strategy,))
            cur.fetchone()
            cur.execute("SAVEPOINT beta_run")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "SELECT public.finance_run_snapshot_strategy(%s, %s)",
                    (snapshot_id, beta_strategy),
                )
            cur.execute("ROLLBACK TO SAVEPOINT beta_run")

            cur.execute(
                "SELECT public.finance_run_snapshot_strategy(%s, %s)",
                (snapshot_id, strategy_id),
            )
            link_id = cur.fetchone()[0]
            book_id, cutoff_bar, snapshot_digest, stored_strategy, stored_book, stored_paper = _link(cur, link_id)
            assert cutoff_bar == len(closes) - 1
            assert snapshot_digest == full.digest
            assert stored_strategy == strategy_digest
            assert stored_book == expected.digest
            assert stored_paper == paper_digest
            _assert_book(cur, book_id, expected)

            cur.execute(
                "SELECT public.finance_run_snapshot_strategy(%s, %s)",
                (snapshot_id, strategy_id),
            )
            again = _link(cur, cur.fetchone()[0])
            assert again[1:] == (cutoff_bar, snapshot_digest, stored_strategy, stored_book, stored_paper)
            _assert_book(cur, again[0], expected)

            cur.execute(
                "SELECT public.finance_replace_market_bars(%s, %s::jsonb)",
                (acme_id, json.dumps(_bars(later, "1000"))),
            )
            cur.fetchone()
            cur.execute("SELECT result_digest FROM public.finance_market_snapshots WHERE id = %s", (snapshot_id,))
            assert cur.fetchone()[0] == full.digest
            cur.execute(
                """
                SELECT bar_index FROM public.finance_snapshot_states
                WHERE snapshot_id = %s AND instrument_id = %s
                """,
                (snapshot_id, acme_id),
            )
            assert cur.fetchone()[0] == len(closes) - 1
            cur.execute(
                "SELECT public.finance_run_snapshot_strategy(%s, %s)",
                (snapshot_id, strategy_id),
            )
            held = _link(cur, cur.fetchone()[0])
            assert held[1:] == (cutoff_bar, snapshot_digest, stored_strategy, stored_book, stored_paper)
            _assert_book(cur, held[0], expected)
            cur.execute(
                "SELECT count(*), max(bar_index) FROM public.finance_market_bars WHERE instrument_id = %s",
                (acme_id,),
            )
            assert cur.fetchone() == (len(later), len(later) - 1)
            cur.execute("SELECT bar_count FROM public.finance_spec_runs WHERE strategy_id = %s", (strategy_id,))
            assert cur.fetchone()[0] == len(closes)

            cur.execute(
                "SELECT public.finance_create_strategy(%s, %s, %s::jsonb)",
                (acme_id, "Unbound", json.dumps(V2_LONG_RULE)),
            )
            unbound_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_validate_strategy(%s)", (unbound_id,))
            cur.fetchone()
            cur.execute("SELECT public.finance_execute_strategy(%s)", (unbound_id,))
            cur.fetchone()
            cur.execute("SELECT public.finance_run_spec_backtest(%s)", (unbound_id,))
            unbound_book = cur.fetchone()[0]
            _assert_book(cur, unbound_book, unbound)
            assert unbound.digest != expected.digest

            cur.execute(
                "SELECT public.finance_create_strategy(%s, %s, %s::jsonb)",
                (acme_id, "Open", json.dumps(ALWAYS_LONG)),
            )
            open_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_validate_strategy(%s)", (open_id,))
            cur.fetchone()
            cur.execute(
                "SELECT public.finance_run_snapshot_strategy(%s, %s)",
                (snapshot_id, open_id),
            )
            open_book = _link(cur, cur.fetchone()[0])[0]
            _assert_book(cur, open_book, opened)
            cur.execute(
                "SELECT public.finance_open_paper_portfolio(%s, %s, %s)",
                (ORG_A, "Open book", 100000),
            )
            open_portfolio = cur.fetchone()[0]
            cur.execute("SELECT public.finance_apply_paper_book(%s, %s)", (open_portfolio, open_book))
            assert cur.fetchone()[0] == opened.stats.paper_pnl
            cur.execute(
                "SELECT quantity, avg_price FROM public.finance_paper_positions WHERE portfolio_id = %s",
                (open_portfolio,),
            )
            assert cur.fetchone() == (opened.allocation.quantity, opened.allocation.avg_price)

            cur.execute(
                "SELECT public.finance_open_paper_portfolio(%s, %s, %s)",
                (ORG_A, "Closed book", 100000),
            )
            portfolio_id = cur.fetchone()[0]
            cur.execute("SELECT public.finance_apply_paper_book(%s, %s)", (portfolio_id, held[0]))
            assert cur.fetchone()[0] == expected.stats.paper_pnl
            cur.execute(
                "SELECT count(*) FROM public.finance_paper_positions WHERE portfolio_id = %s",
                (portfolio_id,),
            )
            assert cur.fetchone()[0] == 0
            cur.execute(
                "SELECT count(*) FROM public.finance_paper_trades WHERE portfolio_id = %s",
                (portfolio_id,),
            )
            assert cur.fetchone()[0] == 0
            cur.execute(
                """
                SELECT cash, quantity, cash_weight, position_weight, equity
                FROM public.finance_paper_allocations
                WHERE portfolio_id = %s
                """,
                (portfolio_id,),
            )
            assert cur.fetchone() == (
                expected.allocation.cash,
                expected.allocation.quantity,
                expected.allocation.cash_weight,
                expected.allocation.position_weight,
                expected.allocation.equity,
            )
            cur.execute("SAVEPOINT rerun_applied")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "SELECT public.finance_run_snapshot_strategy(%s, %s)",
                    (snapshot_id, strategy_id),
                )
            cur.execute("ROLLBACK TO SAVEPOINT rerun_applied")
            cur.execute("SAVEPOINT link_update")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "UPDATE public.finance_snapshot_strategy_runs SET book_digest = %s WHERE id = %s",
                    ("0" * 32, link_id),
                )
            cur.execute("ROLLBACK TO SAVEPOINT link_update")

            cur.execute(
                "SELECT public.finance_create_screener(%s, %s, %s::jsonb)",
                (ORG_A, "Above 100", json.dumps(ABOVE_100)),
            )
            prefix_screener = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_capture_snapshot(%s, %s)",
                (prefix_screener, START + timedelta(days=40)),
            )
            prefix_snapshot = cur.fetchone()[0]
            cur.execute(
                "SELECT public.finance_create_strategy(%s, %s, %s::jsonb)",
                (acme_id, "Prefix long", json.dumps(V2_LONG_RULE)),
            )
            prefix_strategy = cur.fetchone()[0]
            cur.execute("SELECT public.finance_validate_strategy(%s)", (prefix_strategy,))
            cur.fetchone()
            cur.execute(
                "SELECT public.finance_run_snapshot_strategy(%s, %s)",
                (prefix_snapshot, prefix_strategy),
            )
            prefix_link = _link(cur, cur.fetchone()[0])
            assert prefix_link[1] == 40
            assert prefix_link[3] == prefix_strategy_digest
            assert prefix_link[4] == prefix.digest
            assert prefix_link[5] == prefix_paper_digest
            _assert_book(cur, prefix_link[0], prefix)
            cur.execute(
                "SELECT count(*) FROM public.finance_market_bars WHERE instrument_id = %s",
                (acme_id,),
            )
            assert cur.fetchone()[0] == len(later)
            cur.execute(
                "SELECT public.finance_run_snapshot_strategy(%s, %s)",
                (prefix_snapshot, prefix_strategy),
            )
            prefix_again = _link(cur, cur.fetchone()[0])
            assert prefix_again[1:] == prefix_link[1:]
            cur.execute("SELECT result_digest FROM public.finance_spec_books WHERE strategy_id = %s", (strategy_id,))
            assert cur.fetchone()[0] == expected.digest
        member.commit()
    finally:
        member.close()

    viewer = psycopg2.connect(APP_DSN)
    viewer.autocommit = False
    try:
        as_user(viewer, USER_D)
        with viewer.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_snapshot_strategy_runs")
            assert cur.fetchone()[0] > 0
            cur.execute("SELECT count(*) FROM public.finance_trade_ledger")
            assert cur.fetchone()[0] > 0
            cur.execute("SAVEPOINT viewer_run")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "SELECT public.finance_run_snapshot_strategy(%s, %s)",
                    (snapshot_id, strategy_id),
                )
            cur.execute("ROLLBACK TO SAVEPOINT viewer_run")
        viewer.commit()
    finally:
        viewer.close()

    outsider = psycopg2.connect(APP_DSN)
    outsider.autocommit = False
    try:
        as_user(outsider, USER_C)
        with outsider.cursor() as cur:
            cur.execute("SELECT count(*) FROM public.finance_snapshot_strategy_runs")
            assert cur.fetchone()[0] == 0
            cur.execute("SELECT count(*) FROM public.finance_spec_books")
            assert cur.fetchone()[0] == 0
            cur.execute("SELECT count(*) FROM public.finance_paper_allocations")
            assert cur.fetchone()[0] == 0
            cur.execute("SAVEPOINT outsider_run")
            with pytest.raises(psycopg2.Error):
                cur.execute(
                    "SELECT public.finance_run_snapshot_strategy(%s, %s)",
                    (snapshot_id, strategy_id),
                )
            cur.execute("ROLLBACK TO SAVEPOINT outsider_run")
        outsider.commit()
    finally:
        outsider.close()
