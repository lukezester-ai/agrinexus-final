# Core security/correctness patch

Baseline: 7c093eb04b40812c326e57b1a1f287dd7a5635b9 (verified from agrinexus-final/main).

## Findings verified against this baseline

| Finding | Location/status | Core patch |
| --- | --- | --- |
| Email-only JWT issuance and fallback signing secret | apps/backend/app/main.py; present | Disable issuance (501), reject missing/unsafe configuration (503), require expiration |
| Grain cents presented as dollars | verticals/agriculture/market-data/furrow-market-signals.ts; legacy vertical | Excluded |
| Whole market payload rejected on one provider error | archive/agriculture-web-surface/market-live-desk.ts; archived | Excluded |
| Fabricated fallback market signals | Same archived module | Excluded |
| Agriculture required in core-only build context | apps/backend/Dockerfile; present | Conditional BuildKit mount, no unconditional vertical COPY |

Legacy RAG Docker has the same COPY issue but is explicitly outside this Core patch.
Furrow, archived market code, and the Torch/Whisper/Triton legacy stack remain
cleanup debt, not new Core dependencies. No matcher changes are included.

## Auth compatibility and deployment gate

The tracked mobile client (apps/mobile/lib/api.ts) calls /auth/token; disabling
the unsafe stub intentionally stops that login path. A real identity-verifying
flow is a separate task. No production exposure or use of this FastAPI service
has been demonstrated by this source review. Do not infer it from Vercel web
deployment status.

If exposure of the old endpoint is confirmed, rotate its actual JWT_SECRET
before deployment to invalidate previously issued tokens. No secrets were
rotated in this patch. /auth/me requires a configured secret of at least 32
characters, not the known former default. Core health remains available without it.

Docker requires BuildKit. INSTALL_AGRICULTURE=0 must be tested with the entire
verticals/agriculture directory absent from the build context.

The earlier patch and tests on faa2276 are not evidence for this baseline.

## Validation status

- Python auth/core tests on this worktree: 11/11 passed, including HTTP startup
  and fail-closed authentication checks (TestClient lifespan).
- git diff --check: passed.
- Independent root/web npm ci --ignore-scripts: passed from unchanged lockfiles.
- Root and web typecheck: passed.
- Production web build: exit 0, 70/70 pages generated. Not error-free:
  pre-existing missing AgentsMeta translations (en/bg/ar) were logged, along
  with webpack cache snapshot warnings. No web source changes in this patch.
- Negative Docker build: passed on 2026-09-04, Docker Engine 29.6.1.
  A fresh temporary context contained only apps/backend; no verticals directory.
  Built with INSTALL_AGRICULTURE=0 as agrinexus-core-security-7c093eb.
  Image ID: sha256:8e995fe4d49ac62a6cc6ffe1418ea203bbb1a15cd28b4d5580763b451c997d3e.
- Container auth/core tests: 11/11 passed with --network none and read-only tests mount.
- Real Uvicorn startup/shutdown and HTTP smoke passed with --network none:
  /health 200 with empty capabilities, /runtime/langgraph 200 (core:ping),
  /auth/token 501 without issuing a token, /auth/me 401 without bearer and
  503 with bearer but no configured secret. Agriculture import/package absent.
- officia-db-1 restored to running after disk maintenance. Test containers removed.
- No commit, push, merge, production change, or secret rotation performed.

## Separate baseline security risk

The locked next@15.5.7 emitted a security warning during installation. The
official advisory https://nextjs.org/blog/security-update-2025-12-11 identifies
App Router DoS/source exposure vulnerabilities and lists 15.5.9 as the fix for
that advisory. This is not a claim that 15.5.9 addresses every later advisory.
Dependency remediation needs its own reviewed update; no package versions were
changed here. Do not treat successful compilation as production security approval.

Status: SCOPED LOCAL VALIDATION COMPLETE / READY FOR REVIEW, with the web build
diagnostics and separate baseline security risk above explicitly retained.
This is not whole-product security validation or production approval.
No merge is authorized. Core Markets and matcher work have not started.
