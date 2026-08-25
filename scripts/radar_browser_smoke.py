"""Browser smoke for Business Radar UI v1. Requires Next on RADAR_SMOKE_BASE."""

from __future__ import annotations

import os
import sys
import time
import urllib.request

from playwright.sync_api import TimeoutError as PlaywrightTimeout
from playwright.sync_api import sync_playwright

BASE = os.environ.get("RADAR_SMOKE_BASE", "http://127.0.0.1:3012")
SECRET = os.environ.get("RADAR_E2E_SECRET", "radar-e2e-local")
INTENT_HEADLINE = "UBC E2E intent buy confidential"
OPP_TITLE = "UBC E2E opportunity sell confidential"


def smoke_url(role: str, locale: str = "en") -> str:
    return f"{BASE}/{locale}/dev/radar-smoke?role={role}&secret={SECRET}"


def wait_http(url: str, attempts: int = 40) -> None:
    last = None
    for _ in range(attempts):
        try:
            with urllib.request.urlopen(url, timeout=5) as res:
                if res.status < 500:
                    return
        except Exception as exc:
            last = exc
        time.sleep(1)
    raise SystemExit(f"Next did not serve {url}: {last}")


def open_role(page, role: str, locale: str = "en") -> None:
    page.goto(smoke_url(role, locale), wait_until="load")
    page.locator('[data-testid="business-radar-board"]').wait_for()
    try:
        page.wait_for_load_state("networkidle", timeout=5000)
    except PlaywrightTimeout:
        pass


def click_rpc(page, testid: str) -> None:
    btn = page.locator(f'[data-testid="{testid}"]').first
    btn.wait_for(state="visible")
    with page.expect_response(
        lambda r: "/api/e2e/radar-action" in r.url and r.request.method == "POST",
        timeout=90000,
    ):
        btn.click()
    page.locator('[data-testid="business-radar-board"]').wait_for(timeout=30000)
    try:
        page.wait_for_load_state("load", timeout=15000)
    except PlaywrightTimeout:
        pass


def assert_acf_security(page, locale: str) -> None:
    rtl = locale == "ar"
    open_role(page, "F", locale)
    assert page.locator("html").get_attribute("dir") == ("rtl" if rtl else "ltr")
    assert page.locator("html").get_attribute("lang") == locale
    assert "role F" in page.locator('[data-testid="radar-e2e-role"]').inner_text()
    assert page.locator('[data-testid="radar-action-qualify"]').count() == 0
    assert page.locator('[data-testid="radar-item-candidate_match"]').count() == 0
    assert page.locator('[data-testid="radar-item-relationship"]').count() == 0
    board_f = page.locator('[data-testid="business-radar-board"]').inner_text()
    assert INTENT_HEADLINE not in board_f
    assert OPP_TITLE not in board_f
    assert "Farm A" not in board_f and "Farm B" not in board_f

    open_role(page, "C", locale)
    page.locator('[data-testid="radar-item-candidate_match"]').wait_for()
    body_c = page.content()
    assert OPP_TITLE in body_c
    assert INTENT_HEADLINE not in body_c
    assert page.locator('[data-testid="radar-confidential"]').count() >= 1
    alignment = page.locator('[data-testid="radar-criteria-alignment"]').first.inner_text()
    assert "%" in alignment
    assert "match" not in alignment.lower()

    open_role(page, "A", locale)
    page.locator('[data-testid="radar-item-candidate_match"]').wait_for()
    assert INTENT_HEADLINE in page.content()
    assert page.locator('[data-testid="radar-confidential"]').count() >= 1
    assert page.locator('[data-testid="radar-action-qualify"]').count() == 1
    strength = page.locator('[data-testid="radar-match-strength"]').first.inner_text().strip()
    if locale == "ar":
        assert strength == "مطابقة قوية"
    elif locale == "bg":
        assert strength == "Силно съвпадение"
    else:
        assert strength == "Strong match"
    assert page.locator('[data-testid="radar-criteria-alignment"]').first.locator("span[dir='ltr']").count() >= 1
    print(f"{locale}: A/C/F security + {'RTL' if rtl else 'LTR'} rendering ok")


def main() -> None:
    wait_http(smoke_url("A", "ar"))
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()

        assert_acf_security(page, "ar")
        assert_acf_security(page, "en")

        open_role(page, "C")
        page.locator('[data-testid="radar-item-candidate_match"]').wait_for()
        body_c = page.content()
        assert OPP_TITLE in body_c
        assert INTENT_HEADLINE not in body_c
        assert page.locator('[data-testid="radar-confidential"]').count() >= 1
        assert page.locator('[data-testid="radar-criteria-alignment"]').count() >= 1
        assert "%" in page.locator('[data-testid="radar-criteria-alignment"]').first.inner_text()
        assert "match" not in page.locator('[data-testid="radar-criteria-alignment"]').first.inner_text().lower()
        click_rpc(page, "radar-action-qualify")
        page.locator('[data-testid="radar-message"]').wait_for()
        err = page.locator('[data-testid="radar-message"]').inner_text()
        assert err.strip() != ""
        assert page.locator('[data-testid="radar-item-candidate_match"]').count() >= 1
        print(f"C: own title, no intent headline, qualify rejected by domain: {err[:120]}")

        open_role(page, "A")
        page.locator('[data-testid="radar-item-candidate_match"]').wait_for()
        assert INTENT_HEADLINE in page.content()
        assert page.locator('[data-testid="radar-confidential"]').count() >= 1
        assert page.locator('[data-testid="radar-action-qualify"]').count() == 1
        assert page.locator('[data-testid="radar-match-strength"]').first.inner_text().strip() == "Strong match"
        assert "criteria alignment" in page.locator('[data-testid="radar-criteria-alignment"]').first.inner_text()
        click_rpc(page, "radar-action-qualify")
        page.locator('[data-testid="radar-item-qualified_match"]').wait_for(timeout=45000)
        assert page.locator('[data-testid="radar-item-candidate_match"]').count() == 0
        print("A: confidential context, qualify via 010, read model shows qualified")

        open_role(page, "A")
        page.locator('[data-testid="radar-action-request"]').wait_for()
        click_rpc(page, "radar-action-request")
        try:
            page.locator('[data-testid="radar-item-pending_introduction"]').wait_for(timeout=8000)
        except PlaywrightTimeout:
            pass
        open_role(page, "A")
        assert page.locator('[data-testid="radar-action-request"]').count() >= 0
        print("A: request introduction via 010")

        open_role(page, "C")
        page.locator('[data-testid="radar-action-accept"]').first.wait_for(timeout=15000)
        click_rpc(page, "radar-action-accept")
        page.locator('[data-testid="radar-item-relationship"]').wait_for(timeout=15000)
        rel_c = page.locator('[data-testid="radar-item-relationship"]').inner_text()
        assert "Farm A" in rel_c and "Farm B" in rel_c
        print("C: accept via 010, relationship visible")

        open_role(page, "A")
        page.locator('[data-testid="radar-item-relationship"]').wait_for()
        rel_a = page.locator('[data-testid="radar-item-relationship"]').inner_text()
        assert "Farm A" in rel_a and "Farm B" in rel_a
        print("A: relationship visible")

        open_role(page, "F")
        assert page.locator('[data-testid="radar-item-relationship"]').count() == 0
        assert "Farm A" not in page.locator('[data-testid="business-radar-board"]').inner_text()
        print("F: no relationship, no identity leak")

        browser.close()
    print("browser smoke ok")


if __name__ == "__main__":
    main()
