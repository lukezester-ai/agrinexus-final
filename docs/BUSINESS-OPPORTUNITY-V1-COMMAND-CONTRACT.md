# Business Opportunity v1 Command Contract

## Scope

This slice adds the transactional command boundary for organization-owned,
manually-created opportunities. It does not change matching, Radar, AI, or UI.

## Commands

- `create_business_opportunity_v1`: creates the opportunity, optional private
  brief, matching-index state, and `opportunity.created` audit record in one
  transaction.
- `transition_business_opportunity_v1`: locks the opportunity, validates the
  actor and lifecycle transition, updates it, synchronizes matching-index
  state, and writes `opportunity.status_changed` in one transaction.

Direct client `INSERT`, `UPDATE`, and `DELETE` on opportunities and their
secrets are revoked. Commands are exposed to `app_user` and Supabase
`authenticated`; `anon` and `PUBLIC` have no execute access.

## Authorization matrix

| Actor | Create | Transition own opportunity | Transition any organization opportunity | Fulfill |
| --- | --- | --- | --- | --- |
| viewer / outsider | no | no | no | no |
| member | yes | yes | no | no |
| admin | yes | yes | yes | yes |
| owner | yes | yes | yes | yes |

The actor is always `auth.uid()`. Client-provided ownership is not accepted.

## Lifecycle matrix

Everything not listed is denied.

| From | Allowed targets |
| --- | --- |
| `draft` | `open`, `withdrawn` |
| `open` | `paused`, `pursuing`, `fulfilled`, `withdrawn` |
| `paused` | `open`, `pursuing`, `fulfilled`, `withdrawn` |
| `pursuing` | `paused`, `fulfilled`, `withdrawn` |
| `fulfilled`, `expired`, `withdrawn` | none |

`expired` is process-owned. Only owner/admin may transition to `fulfilled`.

## Audit invariant

Successful commands without an audit record are invalid. Audit failure rolls
back the full command. Create records actor, opportunity, kind, visibility,
source type, lifecycle, and timestamp. Transition records actor, opportunity,
old/new lifecycle, and timestamp.

## Acceptance gate

- equivalent positive and negative coverage under unprivileged `app_user` and
  Supabase `authenticated` roles;
- atomic create with optional secret and audit;
- deny-by-default lifecycle and cross-organization enforcement;
- direct client mutations and anonymous command execution denied;
- matching index present only for eligible `open` opportunities;
- audit failure rolls back create and transition.
