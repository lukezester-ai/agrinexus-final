# Repository Extraction Audit

Status: decision inventory only; no source files moved or deleted.

Baseline: Phase 1B RLS is frozen in commit `869be49` on `staging/security`.

## Decision summary

| Decision | Files | Meaning |
|---|---:|---|
| KEEP | 41 | Retain in platform core with minimal structural change. |
| REFACTOR | 42 | Valuable capability, but must be made domain-neutral or consolidated. |
| VERTICAL | 146 | Move physically under `verticals/agriculture`. |
| REMOVE | 114 | Delete from product tree after archive/history check. |
| **Total** | **343** | Every tracked file has one decision in the CSV manifest. |

## Critical findings

1. `apps/web/run_migration.cjs` contains a hardcoded PostgreSQL/Supabase connection credential. Classify as REMOVE and rotate/revoke the exposed database password before any merge or deployment.
2. The repository contains three overlapping application generations: root static HTML/JS, the `Right here` Vite prototype, and the canonical `apps/web` Next.js app. Keep Next.js as the only web runtime.
3. Agriculture concerns are spread through routes, components, content, server tools, scripts, data, styles, Academy material, and the Fieldlot submodule. Move these together; partial extraction would leave hidden coupling.
4. `apps/web/middleware.ts` and `apps/web/src/middleware.ts` are duplicate middleware entry points. Retain one canonical entry.
5. Root one-off mutation scripts (`fix_*`, `inject_*`, `update_*`) should not survive in core after extraction.

## Extraction order

1. Rotate the exposed database credential and remove `apps/web/run_migration.cjs`.
2. Create `verticals/agriculture` boundaries for domain, UI, content, data, and infrastructure.
3. Move all VERTICAL files in dependency-aware slices; preserve imports with temporary adapters.
4. Refactor shared auth, Supabase, i18n, UI primitives, agent runtime, and AI-provider contracts into core packages.
5. Remove the root static site, Vite prototype, duplicate middleware, and one-off generators only after parity checks.
6. Run web build/typecheck and the frozen 15-test RLS suite after each extraction slice.

## Full file-by-file manifest

See `docs/REPOSITORY-EXTRACTION-AUDIT.csv`. It contains one decision and rationale for each of the 343 tracked files.

