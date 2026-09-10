# AI-assisted Intent v1 Contract

## Purpose

AI-assisted Intent v1 turns user-authored free text into a reviewable draft for
the existing Business Intent Engine. It does not create, activate, update, or
persist an intent.

## Boundary

1. The endpoint requires a valid Supabase user and membership in the selected
   organization.
2. Only the explicit assistant text is sent to Mistral. Existing intent records,
   private briefs, organization data, matches, and trust evidence are not sent.
3. Langfuse telemetry is disabled for this operation so the business description
   is not copied to an additional observability provider.
4. The model may suggest only `kind`, `headline`, `publicSummary`, `industry`, and
   `targetMarkets`.
5. Server validation rejects unknown enum values, malformed JSON, oversized text,
   and invalid market tokens.
6. The user must explicitly apply the suggestion and must still separately save
   or activate through `create_business_intent_v1`.
7. The AI has no Supabase service-role credential and cannot call lifecycle,
   matcher, trust, or audit commands.

## Failure behavior

- Unauthenticated: `401`.
- Not an organization member: `403`.
- Invalid input: `400`.
- Mistral unavailable or unconfigured: `502`/`503`.
- Invalid model output: `502`; no partial suggestion is returned.

The manual intent workflow remains fully available when AI assistance fails.
