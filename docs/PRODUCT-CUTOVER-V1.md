# Product Cutover / Rebrand v1

Status: **COMPLETE / FROZEN** on `product/cutover-v1`.

Proven: public IA, active-graph scan (`scripts/scan_cutover_web.py`), and authenticated Radar journey after a neutral B2B reseed. Relationship shows **Northbridge Trading · Atlas Distribution**. Product chrome does not present AgriNexus, Academy, farm, crop, CBOT, or Furrow.

Do not redesign this surface. Usability 4/5 stays blocked until this freeze is committed, pushed, CI-green, and production-smoked.

Working product name: **Core** (`apps/web/src/lib/product-identity.ts`). Final brand is not chosen.

## Product surface (frozen filter)

**Core is a business decision desk, not a social network.**

Every product surface must help a business user understand an opportunity, evaluate relevance, control confidentiality, or take the next business action. Social engagement mechanics are out of scope.

This is the filter for every future UX decision. If a feature starts to look like a feed, profile vanity, follows, likes, comments, or social activity without a direct business purpose — it does not belong in Core.

Every screen must lead to a decision:

What do I need? → What did the system find? → Why is it relevant? → What is safe to reveal? → What action should I take?

- **Radar** is a business inbox.
- **Match Card** is a decision card.
- **Confidential** is disclosure control.
- **Introduction** is the result of a mutual business decision.

Visual Polish may improve density and readability. It must not turn the product into a LinkedIn or Facebook model.

## Public structure

HOME → What are you looking for? → Business Intent → Matching → Business Radar → Introduction → Relationship

`/dashboard` is Radar. Onboarding is **Create your first Business Intent**, not a farm profile.

Legacy Academy, markets, fields, agents, sponsors, methodology, community, and public `/ask` are not linked and redirect home. Code remains in `archive/` and `verticals/` — it does not live in the new product surface.

## Sequence

Validated core is versioned on `extraction/core-survivors`. This freeze is cutover only. Next: commit → push → PR → CI → production smoke, then unlock `docs/PRODUCT-REVIEW-V1.md`.
