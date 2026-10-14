# Product Experience / Visual Polish v1 — usability gate

Status: **BLOCKED** on production smoke of **Product Cutover / Rebrand v1** (`docs/PRODUCT-CUTOVER-V1.md` is FROZEN). Do not run the five sessions until the cutover PR is CI-green and production-smoked.

**Pilot Readiness v1 stays BLOCKED.** Do not onboard real organizations in parallel.

## Session discipline

Do **not** explain the platform during the session. Give the scenario below and observe.

If a facilitator has to explain Radar, Strong match, or Confidential, **that explanation is already a finding**. Record it. Do not coach the participant onto the “correct” story.

## Scenario (same for every participant)

> Log in. You have a new business opportunity. Show me what you think the system found, why it is offering it to you, what Confidential means, and what you would do.

Do not prompt with labels such as Match Card, Qualify, or Request introduction.

## Watch for (pass / fail)

1. **Opportunity in 10–15 seconds** — they can point to what was found without wandering the page.
2. **Reasons in their own words** — industry, markets, or compatible intent; they do not invent a scoring story.
3. **Strength is not a deal** — Strong match / criteria alignment is not treated as a guaranteed transaction.
4. **Next action without hints** — they find Qualify or Request introduction as the safe next step.
5. **Confidentiality (required)** — they know information is hidden, *why* it is hidden, and *what must happen* before identity is shown (both sides agree to an introduction). A pretty confidential panel they cannot explain is a fail on this item.

## Ask (not “Do you like it?”)

- What do you think the system found?
- Why do you think it is a fit?
- What happens if you press Request introduction?
- What information do you think the other party can see right now?

## Log (one row per session)

Fill `docs/PRODUCT-REVIEW-V1-SESSIONS.md`. For each participant record only:

| Field | Value |
| --- | --- |
| Pass without help | yes / no |
| Time to understand the opportunity | seconds (or “not understood”) |
| Strong match understood | yes / no / coached (coached = fail) |
| Confidential understood | yes / no / coached (why hidden + what unlocks it) |
| Next action chosen | what they did or said they would do |
| Findings | Critical / Friction / Cosmetic, one line each |

## Classify findings

| Class | Meaning | Action |
| --- | --- | --- |
| **Critical** | Blocks understanding or action, or creates a wrong sense of confidentiality | Must fix |
| **Friction** | They reach the goal, but hesitate or struggle to understand | Fix before pilot |
| **Cosmetic** | Personal preference with no effect on the task | Does **not** block pilot |

## Decision after session 5 (data only)

Do not start a redesign. Count unassisted passes and recurring problems.

**≥4/5** unassisted **and** no systematic confidentiality or next-action problem → **Product Experience / Visual Polish v1 — COMPLETE / FROZEN** → unlock **Pilot Readiness v1**.

**<4/5** **or** a repeating Critical / Friction problem → **one** correction pass (observed issues only) → limited retest. Cosmetic does not trigger a pass.

Hard bar: **4 of 5** without help. Do not relax this because the stack tests are green.

## After freeze

**Pilot Readiness v1:** real organizations → real Business Intents → real Opportunities → watch the first introductions.

PostgreSQL tests and browser smoke cannot prove whether people find matches valuable enough to request an introduction.
