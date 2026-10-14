# Product Cutover / Rebrand v1

Status: **COMPLETE / FROZEN** on `product/cutover-v1`.

Proven: public IA, active-graph scan (`scripts/scan_cutover_web.py`), and authenticated Radar journey after a neutral B2B reseed. Relationship shows **Northbridge Trading · Atlas Distribution**. Product chrome does not present AgriNexus, Academy, farm, crop, CBOT, or Furrow.

Do not redesign this surface. Usability 4/5 stays blocked until this freeze is committed, pushed, CI-green, and production-smoked.

Working product name: **Core** (`apps/web/src/lib/product-identity.ts`). Final brand is not chosen.

## Public structure

HOME → What are you looking for? → Business Intent → Matching → Business Radar → Introduction → Relationship

`/dashboard` is Radar. Onboarding is **Create your first Business Intent**, not a farm profile.

Legacy Academy, markets, fields, agents, sponsors, methodology, community, and public `/ask` are not linked and redirect home. Code remains in `archive/` and `verticals/` — it does not live in the new product surface.

## Sequence

Validated core is versioned on `extraction/core-survivors`. This freeze is cutover only. Next: commit → push → PR → CI → production smoke, then unlock `docs/PRODUCT-REVIEW-V1.md`.
