# Organization Skill v1 Contract

## Purpose

An organization skill is a private, reusable internal playbook. A signed-in member
writes what they want in plain language on `/dashboard/skills/new`, the platform
proposes a structured playbook, and the member reviews it before it is stored.

The playbook is a document for a human operator. It is not a Business Intent, it
has no visibility token, it is never indexed for matching, and it is never
executed automatically.

## Boundary

1. A skill belongs to exactly one organization. No skill row is readable by
   another organization — there is no `network`/`public` branch and no match
   index, unlike `business_intents`.
2. Insert is not available to the client at all: `INSERT` is revoked from
   `app_user` and from `authenticated`. Rows are created only through
   `create_organization_skill_v1`, so the audit event is always written in the
   same transaction as the row.
3. `viewer` may read but not author. The write check is enforced twice: the
   assistant route returns `403`, and the command raises `42501`.
4. Only the explicit text the user typed is sent to Mistral. Existing skills,
   private data, memberships, matches, and trust evidence are not sent.
5. Langfuse telemetry is disabled for this operation so the user's free text is
   not copied to an additional observability provider.
6. The model may suggest only `name`, `description`, `whenToUse`, `steps`, and
   `guardrails`. It cannot set status, ownership, or any lifecycle field.
7. Server validation rejects malformed JSON, unknown or missing fields, oversized
   text, and more than 8 steps or 6 guardrails.
8. The user must explicitly apply the suggestion and must still separately save
   through `create_organization_skill_v1`. The manual form remains fully
   available when the assistant fails or is unconfigured.
9. The AI has no Supabase service-role credential and cannot call transition,
   matcher, trust, or audit commands.
10. Status changes go through `transition_organization_skill_v1`, which is
    `draft → active | archived` and `active → archived`. A member may only
    transition a skill they created; owner and admin may transition any skill of
    their organization.

## Storage

- `public.organization_skills` — `id`, `organization_id`, `created_by`, `name`,
  `description`, `when_to_use`, `steps` (jsonb array of `{title, detail}`),
  `guardrails` (text[]), `status`, `source_text`, `created_at`, `updated_at`.
- RLS is enabled and forced. Select requires membership; update and delete
  require write access. `organization_id` and `created_by` become immutable after
  insert.
- `jsonb` is untrusted on read and is normalised in
  `apps/web/src/lib/skills.ts` before rendering.

## Failure behavior

- Unauthenticated: `401`.
- Not an organization member, or `viewer`: `403`.
- Invalid input: `400`.
- Mistral unavailable or unconfigured: `502`/`503`.
- Invalid model output: `502`; no partial suggestion is returned.

The manual skill workflow remains fully available when AI assistance fails.
