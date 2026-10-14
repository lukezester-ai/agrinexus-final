"""Scan the active Core product graph for leftover Agri/Academy product language.

Does not scan archive/, verticals/, or redirected marketing pages that are not
imported by the live journey.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web"

SURFACE = [
    WEB / "src" / "app" / "[locale]" / "page.tsx",
    WEB / "src" / "app" / "[locale]" / "layout.tsx",
    WEB / "src" / "app" / "[locale]" / "login",
    WEB / "src" / "app" / "[locale]" / "privacy",
    WEB / "src" / "app" / "[locale]" / "dashboard",
    WEB / "src" / "app" / "[locale]" / "dev" / "radar-smoke",
    WEB / "src" / "app" / "[locale]" / "onboarding",
    WEB / "src" / "components" / "Nav.tsx",
    WEB / "src" / "components" / "Footer.tsx",
    WEB / "src" / "components" / "site-nav.tsx",
    WEB / "src" / "components" / "MarketingChrome.tsx",
    WEB / "src" / "components" / "Hero.tsx",
    WEB / "src" / "components" / "CTA.tsx",
    WEB / "src" / "components" / "ProtectedRoute.tsx",
    WEB / "src" / "components" / "language-switcher.tsx",
    WEB / "src" / "components" / "Dashboard",
    WEB / "src" / "components" / "chat" / "CoreChat.tsx",
    WEB / "src" / "lib" / "product-ux-copy.ts",
    WEB / "src" / "lib" / "product-identity.ts",
    WEB / "src" / "lib" / "business-intents.ts",
    WEB / "src" / "lib" / "business-opportunities.ts",
    WEB / "src" / "lib" / "business-radar.ts",
    WEB / "src" / "lib" / "ensure-organization.ts",
    WEB / "src" / "lib" / "core-chat.ts",
    WEB / "src" / "lib" / "radar-e2e.ts",
    WEB / "messages" / "en.json",
    WEB / "messages" / "bg.json",
    WEB / "next.config.ts",
]

# Product-facing leftovers. Table name farm_profiles is leftover storage, not copy.
FORBIDDEN = re.compile(
    r"AgriNexus|/academy|Furrow|\bCBOT\b|\bwheat\b|\bhectare\b|Farm A|Farm B|farm profile|Академия|пшениц",
    re.I,
)
ALLOW_LINE = re.compile(r"farm_profiles|agrinexus\.io")


def files_under(path: Path) -> list[Path]:
    if path.is_file():
        return [path]
    if not path.exists():
        return []
    out = []
    for p in path.rglob("*"):
        if p.suffix in {".ts", ".tsx", ".json"}:
            out.append(p)
    return out


def main() -> int:
    hits: list[str] = []
    scanned = 0
    for root in SURFACE:
        for path in files_under(root):
            scanned += 1
            text = path.read_text(encoding="utf-8")
            for i, line in enumerate(text.splitlines(), 1):
                if ALLOW_LINE.search(line):
                    continue
                if FORBIDDEN.search(line):
                    rel = path.relative_to(ROOT)
                    hits.append(f"{rel}:{i}:{line.strip()[:160]}")
    print(f"scanned {scanned} files in active product graph")
    if hits:
        print("LEGACY LEAKS:")
        for h in hits:
            print(f"  {h}")
        return 1
    print("cutover graph scan ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
