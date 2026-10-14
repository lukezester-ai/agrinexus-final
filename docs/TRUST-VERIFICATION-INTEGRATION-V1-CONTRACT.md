# Trust/Verification Integration v1 Contract

## Scope

Trust v1 uses the existing `organization_verifications` evidence records and
`organization_audit_log`. It adds controlled request/review commands and a
deterministic matching eligibility rule. It does not add ratings, reputation
scores, AI decisions, or UI changes.

## State model

`pending` is created by an authorized organization member. A trusted reviewer
may apply these deny-by-default transitions:

| Current | Allowed target |
| --- | --- |
| `pending` | `approved`, `rejected` |
| `approved` | `suspended`, `revoked` |
| `suspended` | `approved`, `revoked` |
| `rejected` | none |
| `revoked` | none |

Anything not listed is rejected. A new request is allowed only when no record
exists or the latest record is `rejected`. Suspended/revoked organizations must
be reinstated through the trusted review command, not by creating a new pending
record.

## Authorization matrix

| Operation | Organization member | Organization writer | `service_role` |
| --- | ---: | ---: | ---: |
| Read own organization records | yes | yes | yes |
| Request verification | no | yes | yes |
| Direct insert/update/delete | no | no | no (use commands) |
| Review/change verification state | no | no | yes |

The review command requires an explicit reviewer UUID for audit attribution.
Both commands write their audit record in the same database transaction; an
audit failure rolls back the verification change.

## Matching and visibility policy

Organizations whose current verification state is `suspended` or `revoked`
are ineligible. Their intent/opportunity index rows are hidden from the matcher,
and existing matches involving them are hidden from authenticated match reads.
No existing match row is deleted or rewritten.

Organizations with no verification record, or with `pending`, `approved`, or
`rejected` state, preserve the v1 matching behavior.

## Data safety and rollback

- Migration is additive except for replacing explicit RLS policies and grants.
- Existing verification and match rows are retained.
- Re-running the deterministic matcher is idempotent for its v1 key.
- Before production apply, count current states and affected candidate matches.
- Rollback restores the previous match-index/read policies and command grants;
  it does not delete evidence, audit events, or matches.
- Production rollout requires privilege checks, a controlled matcher run, and
  verification that suspended/revoked parties produce no visible/new matches.
