---
name: core-design
description: >-
  Applies the Core ledger design in DESIGN.md when building or changing UI in
  apps/web, the finance desk, or Core mobile screens (intent, radar,
  introduction). Use when the user mentions design, visual polish, Core chrome,
  typography, color, layout, match cards, or frontend-design. FieldLot and the
  legacy marketing site stay on their own documents.
---

# Core design

`DESIGN.md` at the repo root is the brief for Core. Read it before writing or restyling UI. Where it specifies a look, follow it. The generic defaults in `.cursor/skills/frontend-design/SKILL.md` do not override it.

## Where it applies

- `apps/web` public pages, dashboard, and finance desk.
- `apps/mobile` only when the screen is Core: intent, radar, introduction.

Do not restyle from this brief:

- `styles/agri-market-*.css` and root marketing HTML — `docs/DESIGN-SYSTEM.md`
- `fieldlot/` — `docs/AGRO-MODERNISM-DESIGN-SYSTEM.md`

## Before writing UI

1. Read `DESIGN.md`. Use its tokens, type roles, and component order.
2. Map colors onto existing Tailwind keys (`paper`, `ink`, `forest.700`, `harvest.700`, `harvest.50`, `semantic.alert`). Do not invent a parallel palette in a component.
3. Keep glossary strings in `apps/web/src/lib/product-ux-copy.ts`. Do not rewrite them to sound warmer.
4. Leave the public shell (`#141618`, mint, “AGRI NEXUS”) alone while Product Experience / Visual Polish v1 is blocked (`docs/PRODUCT-REVIEW-V1.md`). New screens still use the ledger tokens.

## Non-negotiables

- One memorable object: the empty rule where the other party’s name would sit. Harvest marks that rule and the live-execution STOP. Forest is the single forward action.
- IBM Plex Serif for the page title and match strength. IBM Plex Sans for UI, including Bulgarian. IBM Plex Sans Arabic only under `html[dir="rtl"]`.
- One left-aligned column. No aurora, glass, gradient wordmark, all-caps kickers, or arrows on buttons.
- Copy: plain verbs, sentence case, one job per line. The button verb and the resulting state use the same word.
