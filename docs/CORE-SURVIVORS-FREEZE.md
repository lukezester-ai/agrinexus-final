# CORE SURVIVORS — FROZEN

Approved map for Universal Business Core. Slice 4B (Academy MOVE) is stopped and must not be merged.

## Buckets

1. **KEEP IN NEW PLATFORM** — tenancy, company identity, security, generic AI runtime, capability model, UI shell.
2. **MOVE TO AGRICULTURE** — fields, crops, Furrow, agro market, agri agents, agri UI. Isolate; do not generalize into core.
3. **ARCHIVE FIRST → REMOVE FROM CORE** — Academy, RAG, lectures, demos, old prototypes. Take them out of the core dependency graph first. Physical delete is a later decision after a proven core-only build.

There is no fourth bucket.

## This branch (`extraction/core-survivors`)

Strip only:

- prove KEEP imports
- exclude agriculture / academy / legacy from the core graph
- prove core can build → import → start

After this proof is green, extraction stops and the product starts.

Status: **extraction complete for Academy + agriculture web surface.** Product phase 1 is Business Intents (`migrations/006_business_intents.sql`, `/dashboard/intents`).

**Business Intents v1 FROZEN** after 24/24 RLS tests on a clean PostgreSQL 16 (`scripts/prove_006.ps1`). Opportunities v1 FROZEN (`007_opportunities.sql`). Matches v1 FROZEN (`008_matches.sql`). Matching Engine v1 FROZEN (`009_matching_engine.sql` / `scripts/prove_009.ps1`, 45/45). Qualification / Introduction v1 FROZEN (`010_qualification_introduction.sql` / `scripts/prove_010.ps1`, 49/49). Relationships v1 FROZEN (`011_relationships.sql` / `scripts/prove_011.ps1`, 53/53). Business Radar v1 FROZEN (`012_business_radar.sql` / `scripts/prove_012.ps1`, 56/56). **Radar Home + Match Card EN COMPLETE / FROZEN** after A/C/F browser smoke on the Match Card (`scripts/radar_browser_smoke.py` on Next `:3012`). Score copy is strength + criteria alignment, not deal probability. **First Business Intent Onboarding EN COMPLETE / FROZEN** after authenticated journey E2E (`scripts/prove_onboarding_e2e.py`): ensure org → active confidential intent → waiting empty Radar → matcher → qualify → introduction → relationship, with outsider non-leak. **Localization UX v1 COMPLETE / FROZEN** after BG + AR on the English interaction model (`apps/web/src/lib/product-ux-copy.ts`) and a live A/C/F browser gate (`scripts/radar_browser_smoke.py` on Next `:3012`): Arabic RTL + confidential + outsider, then English funnel regression. English remains the reference implementation. Interaction model stays frozen. **Product Experience / Visual Polish v1 IN REVIEW** — not complete because the stack works. Stop branch development; next evidence is five usability sessions (`docs/PRODUCT-REVIEW-V1.md`, log in `docs/PRODUCT-REVIEW-V1-SESSIONS.md`). Hard bar: **4/5 unassisted**. After session 5: ≥4/5 and no systematic confidentiality/action problem → freeze polish and unlock **Pilot Readiness v1**; else one correction pass and a limited retest. **Pilot Readiness v1 is BLOCKED** until that freeze — do not bring real organizations in parallel.

