# Skill Squad website

Standalone bilingual (English/Bulgarian) site for Skill Squad, built with plain HTML, CSS and JavaScript. No build step, no framework, no server code: the folder is the whole application.

- `index.html` — marketing site.
- `workspace.html` — the product: sign in, describe a routine, review the AI draft, save the skill.
- `styles.css` / `workspace.css` — shared design tokens plus workspace styles.
- `app.js` / `workspace.js` — page behaviour. `workspace.js` talks to Supabase directly.
- `site.config.js` — public configuration (contact email, Supabase URL and anon key).

## Preview

Open `index.html` in a browser. The language toggle switches between English and Bulgarian and remembers the visitor's choice.

The workspace needs to be served over HTTP rather than opened as a `file://` path, because Supabase Auth stores the session per origin:

```bash
python -m http.server 8000 --directory skill-squad
```

Then open <http://localhost:8000/workspace.html>.

## Configuration

`site.config.js` holds publishable values only:

- `contactEmail` — public contact address.
- `productUrl` — intentionally empty; the product call to action is the workspace itself.
- `supabaseUrl` — the project URL, without `/rest/v1`.
- `supabaseAnonKey` — the project's anonymous (publishable) key. This is safe to commit: every table is protected by row-level security, and the AI key never reaches the browser.

The anonymous key is read from Supabase → Project Settings → API. Without it the workspace shows a configuration message and stays read-only.

## How a skill is created

1. The visitor signs up or signs in. Supabase Auth issues a JWT held in the browser.
2. `workspace.js` makes sure the user belongs to an organization, creating one on first sign-in.
3. "Draft with AI" posts the free-text description to the `skill-draft` Edge Function, which holds the Mistral key server-side and returns a structured suggestion.
4. The visitor edits the draft and saves. The row is written through `public.create_organization_skill_v1`, never by direct insert, so the audit event is recorded in the same transaction.

A skill is private to its organization and starts as `draft`; it becomes `active` only through `public.transition_organization_skill_v1`.

## Deploy

Serve the repository's `skill-squad/` directory as static files. The Vercel project `skill-squad` already uses that root directory, so a merge on `main` publishes the whole folder, `workspace.html` included.

The Edge Function is deployed separately — see `supabase/README.md`. Until it is deployed, the workspace still saves skills; only the AI draft button reports that drafting is unavailable.

## Content notes

The featured product is **Skill Squad Core**, marked as early access. The page avoids invented client names, results, and unsupported technology/vendor claims.
