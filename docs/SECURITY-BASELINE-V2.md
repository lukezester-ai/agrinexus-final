# Universal Business Core — Security Baseline v2

Status: **validated for the root UBC/API dependency graph**  
Baseline: `main` at `d800f235a68b6138f0f37b2849ce69a540d6276e`  
Assessment date: 2026-09-05

## Validated controls

- Authentication fails closed: the placeholder token endpoint does not issue JWTs, and JWT verification rejects missing, weak, or invalid configuration.
- PostgreSQL tenant isolation, RBAC/RLS, audit, verification, and `created_by` protection have a validated integration baseline.
- The backend supports a core-only container build and startup without the agriculture vertical.
- `main` is protected by an active repository ruleset: pull requests are required, `root-typecheck` and `fieldlot` are required and strict, force pushes and branch deletion are blocked, and there are no bypass actors.
- Next.js was updated from `15.5.7` to `15.5.25` as a separate remediation slice.
- Runtime-reachable `ws` was updated from `8.20.1` to `8.21.3`.
- Build/supply-chain `tar` was updated from `7.5.15` to `7.5.22`.
- The type-only `@vercel/node` production dependency and its builder graph were removed. API handlers use a minimal local structural contract, while `@types/node` is declared directly as a development dependency.

## Required release gates

Every change to `main` must pass:

1. Pull-request review and final scope verification.
2. `root-typecheck`.
3. The real `fieldlot` CI job.
4. Vercel Preview for web-impacting changes.
5. Post-merge production deployment and smoke verification proportionate to the change.

## Root UBC/API dependency result

The production-only root audit at this baseline reports:

- Critical: **0**
- High: **0**
- Moderate: **3**

The three entries represent one residual issue propagated through the versions locked at this baseline:

- `@langchain/langgraph@1.3.2`
- `@langchain/langgraph-checkpoint@1.0.2`
- `uuid@10.0.0`

## Accepted residual risk: LangGraph / UUID

Advisory: [GHSA-w5hq-g745-h8pq / CVE-2026-41907](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

Advisory condition: affected UUID v3/v5/v6 calls must receive a caller-provided output buffer with invalid bounds or offset. The patched 11.x release is `11.1.1`.

Observed runtime paths:

- `@langchain/langgraph@1.3.2` calls `uuid.v4()` without a buffer.
- `@langchain/langgraph-checkpoint@1.0.2` calls `uuid.v5(name, namespace)` without an output buffer.
- `@langchain/langgraph-checkpoint@1.0.2` calls `uuid.v6({ clockseq })` without an output buffer.
- UBC application code does not import or call `uuid` directly.

Conclusion: the dependency is runtime-reachable, but the vulnerable invocation pattern is not reachable through the current UBC code path. A LangGraph upgrade from `1.3.2` to the current newer line would change the graph/checkpoint runtime and is not justified solely to eliminate this non-reachable moderate finding before the Business Intent Engine milestone.

Re-open this decision if application code begins calling UUID v3/v5/v6 directly, passes output buffers, accepts UUID generation parameters from untrusted input, or upgrades LangGraph for functional reasons.

## Residual risk outside the root baseline

This document does **not** claim that every historical workspace is vulnerability-free. The web application retains separately tracked dependency findings, including the PostCSS/Next.js issue whose available remediation requires a Next.js 16 compatibility decision. Mobile/Expo and legacy workspaces remain separate audit scopes. They must not be represented as covered by the root `0 critical / 0 high` result.

## Security phase decision

Core Security Baseline v2 is closed for the root Universal Business Core/API scope. Functional work may proceed through the protected PR process. The first approved product slice is Business Intent Engine v1:

`organization → create business intent → visibility → status → search/list → audit trail`

Matching and AI-assisted intent structuring remain later, separate slices.
