# Business Intent v1 — Command Contract

Status: implemented; local validation and hosted schema/grant validation complete; hosted JWT E2E pending
Baseline: `main@c3dd927b896812fbde42c21c66389dc521c3ce01`
Branch: `feature/business-intent-engine-v1`

## Scope

This contract completes the smallest universal business flow:

`Organization → Intent → Authorization → Persistence → Visibility → Status → Audit`

It does not add matching, AI, Markets, agriculture, opportunities, or a new UI architecture. It preserves the existing `business_intents` model and RLS semantics unless this contract explicitly narrows a write capability.

## Decisions

1. Intent writes go through database RPC commands. The browser must not insert, update, or delete intent rows directly.
2. Authorization is checked inside each command using the verified JWT subject (`auth.uid()`) and organization membership.
3. Intent, optional secret, and audit event are committed in one database transaction.
4. Lifecycle changes are commands, not arbitrary row updates.
5. Every successful command writes an audit event in the same transaction.
6. `created_by` and `organization_id` remain immutable.
7. Deletion is not a v1 user operation. Withdrawal preserves history.
8. Supabase `authenticated` is the canonical production caller role. The local `app_user` role must exercise the same command and read policies in integration tests; it is not a substitute for production-role validation.

## Existing lifecycle vocabulary

The existing enum is retained:

- `draft`
- `active`
- `paused`
- `matched`
- `introducing`
- `fulfilled`
- `expired`
- `withdrawn`

No enum rename to `closed` or `cancelled` is included in v1. `fulfilled` is the successful terminal state and `withdrawn` is the organization-initiated terminal state.

## Lifecycle ownership

| Lifecycle | Owner in v1 | Meaning |
|---|---|---|
| `draft` | Organization user | Saved but not externally visible or matchable. |
| `active` | Organization user | Published under the selected visibility policy. |
| `paused` | Organization user | Temporarily inactive. |
| `fulfilled` | Organization owner/admin | Business need completed; terminal. |
| `withdrawn` | Organization user | Intentionally removed from active use; terminal. |
| `expired` | Future `intent_lifecycle_worker` | Reached expiry; terminal for user commands. |
| `matched` | Future `intent_lifecycle_worker` | Reserved; not directly settable by v1 user commands. |
| `introducing` | Future `intent_lifecycle_worker` | Reserved; not directly settable by v1 user commands. |

## Allowed organization-user transitions

| From | To | Owner/Admin | Creating Member | Other Member | Viewer |
|---|---|---:|---:|---:|---:|
| `draft` | `active` | Allow | Allow | Deny | Deny |
| `draft` | `withdrawn` | Allow | Allow | Deny | Deny |
| `active` | `paused` | Allow | Allow | Deny | Deny |
| `active` | `fulfilled` | Allow | Deny | Deny | Deny |
| `active` | `withdrawn` | Allow | Allow | Deny | Deny |
| `paused` | `active` | Allow | Allow | Deny | Deny |
| `paused` | `fulfilled` | Allow | Deny | Deny | Deny |
| `paused` | `withdrawn` | Allow | Allow | Deny | Deny |

All transitions not listed above are denied. Repeating the current state is denied as a no-op, not reported as a successful transition.

`matched`, `introducing`, and `expired` are not accepted as targets of the user-facing transition command. No actor is authorized to set them through the v1 command boundary. A future slice may introduce a dedicated NOLOGIN database role named `intent_lifecycle_worker` and narrowly scoped process commands. That authority must be proven by privilege tests showing that `authenticated`, `app_user`, `anon`, and `PUBLIC` cannot execute those commands or set those states directly. The role and process commands are not created in this slice.

## Authorization matrix

| Operation | Owner | Admin | Member | Viewer | Other organization | Unauthenticated |
|---|---:|---:|---:|---:|---:|---:|
| Create intent in organization | Allow | Allow | Allow | Deny | Deny | Deny |
| Create intent with `created_by` other than caller | Deny | Deny | Deny | Deny | Deny | Deny |
| Read own-organization intent | Allow | Allow | Allow | Allow | Deny unless visibility policy allows |
| Read active, unexpired `network`/`public` intent | Allow | Allow | Allow | Allow | Allow | Not in v1 |
| Read `private`/`confidential` intent from another organization | Deny | Deny | Deny | Deny | Deny | Deny |
| Change status of any organization intent | Allow | Allow | Only if creator | Deny | Deny | Deny |
| Mark intent fulfilled | Allow | Allow | Deny | Deny | Deny | Deny |
| Update identity fields | Deny | Deny | Deny | Deny | Deny | Deny |
| Hard-delete intent | Deny | Deny | Deny | Deny | Deny | Deny |
| Read intent secret | Allow | Allow | Allow | Allow | Deny | Deny |

The v1 contract intentionally narrows the existing broad update policy: ordinary members cannot mutate another member's intent, while owner/admin retain organization-wide control.

## Command boundary

### `create_business_intent_v1`

Conceptual input:

```text
organization_id
kind
headline
public_summary
industry
target_markets
visibility
initial_lifecycle: draft | active
expires_at: optional
private_brief: optional
```

The command never accepts `created_by`; it derives the actor from `auth.uid()`.

Transactional invariants:

1. caller is authenticated;
2. caller has owner/admin/member membership in the target organization;
3. all field and expiry constraints pass;
4. intent row is inserted;
5. optional secret row is inserted;
6. `intent.created` audit event is inserted;
7. all three operations commit or all roll back.

The audit event records the intent ID, initial lifecycle, visibility, kind, and actor. It must not copy `private_brief` or other confidential free text.

### `transition_business_intent_v1`

Conceptual input:

```text
intent_id
target_lifecycle
```

Transactional invariants:

1. caller is authenticated;
2. the intent is locked for update;
3. caller role and ownership satisfy the authorization matrix;
4. current-to-target transition exists in the lifecycle matrix;
5. identity fields cannot change;
6. lifecycle is updated;
7. `intent.status_changed` audit event is inserted with `from` and `to`;
8. update and audit commit or roll back together.

The command returns the updated intent row or a minimal stable response containing `id`, `lifecycle`, and `updated_at`.

## Database privileges and RLS

The intended privilege model is:

- `authenticated` and test role `app_user` receive the required read privileges under RLS;
- direct `INSERT`, `UPDATE`, and `DELETE` on `business_intents` are revoked from client roles;
- direct mutation of `business_intent_secrets` is revoked from client roles;
- client roles receive `EXECUTE` only on the v1 command functions;
- RPC functions use a fixed empty `search_path`, schema-qualified objects, and explicit authorization checks;
- command execution must not be granted to `anon` or `PUBLIC`;
- existing matcher/service access remains unchanged and outside this slice.

`app_user` is a semantic test double for `authenticated`, not an assumed production mapping. The migration must apply identical read predicates and identical RPC execute grants to both roles. The focused suite must run the same create, transition, visibility, and denial cases once as `app_user` and once as `authenticated`. A separate Supabase E2E must then prove the hosted JWT/Data API path. Passing only the `app_user` run is insufficient.

If production uses a deliberate custom JWT role instead of Supabase `authenticated`, that configuration must be shown and tested before implementation. Repository evidence currently supports `authenticated` as the standard web-session role and `app_user` as the direct PostgreSQL test role.

## Read contract

Existing RLS visibility semantics are preserved:

- every organization member, including viewer, can read the organization's intents;
- outsiders cannot read `private` or `confidential` intents;
- outsiders can read only active, unexpired `network` or `public` intents.

Before exposing cross-organization results through UI, define a public-safe projection or explicit column allow-list. `private_brief` always remains in the separate secret table and is never part of an external read.

## Audit contract

Audit events use the existing `organization_audit_log` table:

| Command | `action` | `subject_type` | Required details |
|---|---|---|---|
| Create | `intent.created` | `business_intent` | `kind`, `visibility`, `lifecycle` |
| Transition | `intent.status_changed` | `business_intent` | `from`, `to` |

For every successful command:

- exactly one corresponding audit event exists;
- `actor_user_id = auth.uid()`;
- `organization_id` and `subject_id` match the changed intent;
- `created_at` is database-generated at the time of the command;
- a failed command writes no success audit event;
- confidential descriptions and secrets are excluded from audit details.

## Focused acceptance tests

### Create

1. owner, admin, and member can create for their organization;
2. viewer, outsider, and unauthenticated caller are denied;
3. caller cannot spoof actor or organization;
4. intent plus secret plus audit commit atomically;
5. forced secret/audit failure leaves no intent row;
6. direct table mutation is denied.

### Visibility

1. organization viewer can read own-organization private intent;
2. outsider cannot read private or confidential intent;
3. outsider can read active, unexpired network/public intent;
4. draft, paused, expired, or withdrawn intent is not externally visible;
5. secret is never externally visible.

### Lifecycle

1. every listed transition succeeds for an allowed role;
2. every unlisted transition is rejected;
3. member can transition only an intent they created;
4. only owner/admin can mark fulfilled;
5. viewer and outsider cannot transition;
6. user cannot target `matched`, `introducing`, or `expired`;
7. direct lifecycle update is denied;
8. success writes exactly one audit event; failure writes none.

### Production-role proof

Run at least one authenticated Supabase end-to-end scenario, not only a direct PostgreSQL `app_user` connection:

`sign in → create RPC → read under RLS → allowed transition RPC → audit read → cross-org denial`

The test must record the effective PostgreSQL role/JWT role and prove that it matches the grants and policies deployed in production.

## Definition of done

Business Intent Engine v1 is complete only when:

- the lifecycle and authorization matrices are enforced in the database;
- create and transition commands are atomic;
- audit is an invariant;
- direct client mutation is unavailable;
- existing visibility protections remain green;
- direct PostgreSQL integration tests pass under `app_user`;
- authenticated Supabase E2E passes under the real production role mapping;
- core-only build/start remains green without agriculture.

Until then, the existing Business Intent foundation remains reusable but the product milestone is open.
