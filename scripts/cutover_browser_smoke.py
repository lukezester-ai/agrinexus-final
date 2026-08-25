"""Authenticated cutover smoke: public IA + Radar funnel without Agri product language.

Requires Next on RADAR_SMOKE_BASE and a seeded radar DB (prove_radar_e2e.py seed).
"""

from __future__ import annotations

import os
import re
import sys
import time
import urllib.request

from playwright.sync_api import TimeoutError as PlaywrightTimeout
from playwright.sync_api import sync_playwright

BASE = os.environ.get("RADAR_SMOKE_BASE", "http://127.0.0.1:3012")
SECRET = os.environ.get("RADAR_E2E_SECRET", "radar-e2e-local")
FORBIDDEN = re.compile(
    r"AgriNexus|\bAcademy\b|\bFurrow\b|\bCBOT\b|\bwheat\b|\bcrop\b|\bhectare\b|Farm A|Farm B|farm profile",
    re.I,
)


def smoke_url(role: str) -> str:
    return f"{BASE}/en/dev/radar-smoke?role={role}&secret={SECRET}"


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
    raise SystemExit(f"did not serve {url}: {last}")


def assert_clean(label: str, text: str) -> None:
    m = FORBIDDEN.search(text)
    if m:
        raise AssertionError(f"{label}: leftover product language {m.group(0)!r}")


def open_role(page, role: str) -> None:
    page.goto(smoke_url(role), wait_until="load")
    page.locator('[data-testid="business-radar-board"]').wait_for()


def click_rpc(page, testid: str) -> None:
    btn = page.locator(f'[data-testid="{testid}"]').first
    btn.wait_for(state="visible")
    with page.expect_response(
        lambda r: "/api/e2e/radar-action" in r.url and r.request.method == "POST",
        timeout=90000,
    ):
        btn.click()
    page.locator('[data-testid="business-radar-board"]').wait_for(timeout=30000)


def main() -> None:
    wait_http(f"{BASE}/")
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()

        page.goto(f"{BASE}/", wait_until="load")
        assert "Business Intent" in page.inner_text("body")
        assert page.get_by_role("link", name="Open Radar").count() >= 1
        assert page.get_by_role("link", name="Academy").count() == 0
        assert_clean("home", page.inner_text("body"))
        print("home: matching IA, no Academy nav")

        page.goto(f"{BASE}/academy", wait_until="load")
        assert "/academy" not in page.url
        assert_clean("academy-redirect", page.inner_text("body"))
        print("academy: redirects off the old surface")

        page.goto(f"{BASE}/login", wait_until="load")
        assert "Radar" in page.inner_text("body")
        assert_clean("login", page.inner_text("body"))
        print("login: Continue to Radar")

        page.goto(f"{BASE}/dashboard", wait_until="load")
        body = page.inner_text("body")
        assert "Radar" in body or "Continue to Radar" in body or "Sign in" in body
        assert_clean("dashboard-unauth", body)
        print("dashboard unauth: login/radar, no Agri chrome")

        page.goto(f"{BASE}/dashboard/onboarding", wait_until="load")
        assert_clean("onboarding-unauth", page.inner_text("body"))
        print("onboarding unauth: no farm profile chrome")

        open_role(page, "A")
        page.locator('[data-testid="radar-item-candidate_match"]').wait_for()
        assert_clean("radar-A-match", page.locator('[data-testid="business-radar-board"]').inner_text())
        assert page.locator('[data-testid="radar-confidential"]').count() >= 1
        click_rpc(page, "radar-action-qualify")
        page.locator('[data-testid="radar-item-qualified_match"]').wait_for(timeout=45000)
        assert_clean("radar-A-qualified", page.locator('[data-testid="business-radar-board"]').inner_text())
        print("A: match card → qualify")

        open_role(page, "A")
        page.locator('[data-testid="radar-action-request"]').wait_for()
        click_rpc(page, "radar-action-request")
        open_role(page, "A")
        assert_clean("radar-A-intro", page.locator('[data-testid="business-radar-board"]').inner_text())
        print("A: request introduction")

        open_role(page, "C")
        page.locator('[data-testid="radar-action-accept"]').first.wait_for(timeout=15000)
        click_rpc(page, "radar-action-accept")
        page.locator('[data-testid="radar-item-relationship"]').wait_for(timeout=15000)
        rel = page.locator('[data-testid="radar-item-relationship"]').inner_text()
        assert "Northbridge Trading" in rel and "Atlas Distribution" in rel
        assert_clean("radar-C-relationship", rel)
        print("C: accept → relationship Org A / Org B")

        browser.close()
    print("cutover browser smoke ok")


if __name__ == "__main__":
    try:
        main()
    except PlaywrightTimeout as exc:
        raise SystemExit(f"timeout: {exc}") from exc
