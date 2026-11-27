# Supabase functions

Edge Functions used by the static `skill-squad/` site. The site holds no credentials; these functions do.

## `skill-draft`

Turns one plain-language description into a structured skill suggestion (`name`, `description`, `when_to_use`, `steps`, `guardrails`).

- Authenticates the caller with the `Authorization: Bearer <access_token>` header before doing any work.
- Calls Mistral with `MISTRAL_API_KEY` from the function environment; the key is never returned to the browser.
- Validates and trims the model output against the same limits as `public.organization_skills` before responding.
- Writes nothing to the database. The browser saves the reviewed draft through `public.create_organization_skill_v1`.

Environment variables:

| Variable | Source | Required |
| --- | --- | --- |
| `SUPABASE_URL` | injected by the platform | yes |
| `SUPABASE_ANON_KEY` | injected by the platform | yes |
| `MISTRAL_API_KEY` | secret you set | yes |
| `MISTRAL_SKILL_MODEL` | secret you set | no, defaults to `mistral-small-latest` |

### Deploy

```bash
supabase link --project-ref ebheqenmcphbwqbpopov
supabase secrets set MISTRAL_API_KEY=... MISTRAL_SKILL_MODEL=mistral-small-latest
supabase functions deploy skill-draft
```

Keep the default JWT verification on: the function also checks the token itself, so an unsigned request is rejected twice rather than once.

### Test

```bash
curl -i -X POST "https://ebheqenmcphbwqbpopov.supabase.co/functions/v1/skill-draft" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sourceText":"When a new supplier writes, check the offer and list what is missing.","locale":"bg"}'
```

A signed-out request must return `401 {"error":"authentication_required"}` and no suggestion.

### Known limits

- There is no per-user rate limit yet. Add one before the endpoint is promoted publicly, or the Mistral quota is the only ceiling.
- Responses are not cached; identical descriptions cost one call each.
