# Website Information Architecture v1 — SPEC

Status: **ACCEPTED**. Parent boundary: `92378f8`.

`docs/AGENT-LAYER-INVENTORY-V1.md` is an accepted architectural fact. This document matches that fact. Visual design has not started.

The old agricultural agent layer is not part of the proven UBC public capability architecture.

This gate is not P6 and does not continue the finance execution line.

```
92378f8
   ↓
Website IA Specification   ← this document
   ↓
Visual/UI Gate
   ↓
Implementation
   ↓
Verification
```

Finance stays independently frozen:

```
606e08b → 92378f8 → STOP
```

`606e08b` and `92378f8` are not modified. P5 logic is not modified. P6 does not start. The live boundary stays blocked. No broker, production credential, or network send is introduced.

## Root identity

AGRI NEXUS
Universal Business Core
Business Intelligence & Decision Infrastructure

The primary message must separate the platform from a trading bot and from a broker.

The temporary public name **Core** in `apps/web/src/lib/product-identity.ts` is a working label from the Radar cutover. This specification replaces that label for the public site. It does not change Radar matching, introduction, or relationship behavior.

## Public navigation

HOME
BUSINESS RADAR
FINANCE INTELLIGENCE
AI STRATEGY COPILOT
RISK & GOVERNANCE
EXECUTION SAFETY

## 1. Home

Home shows proven capabilities. It does not show the old agent layer.

```
                    UNIVERSAL BUSINESS CORE
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
    BUSINESS RADAR     FINANCE INTELLIGENCE   AI STRATEGY
          │                   │               COPILOT
          └───────────────────┼───────────────────┘
                              │
                       RISK & GOVERNANCE
                              │
                       EXECUTION SAFETY
                              │
                             STOP
```

Public line: **From business intent to governed decision.**

```
Intent → Intelligence → Strategy → Risk → Human Approval → Safety → STOP
```

Home must not claim that live execution exists.

## What Home must not state as fact

- 18 AI Agents
- 19 agent cards
- autonomous agents
- autopilot
- autonomous trading
- AI-managed farms
- live market forecasting as a proven capability
- broker execution
- live orders

The old Market/Finance chat in `api/chat.ts` is not evidence for Finance Intelligence. Those are different implementations. Finance Intelligence means the frozen `verticals/finance` research and paper path only.

## Old agent layer

The old agricultural agent layer is not part of the proven UBC public capability architecture.

It is not deleted by this specification and it is not advertised. It stays a legacy/prototype layer until a separate architectural decision.

A future agent concept requires its own specification before any public representation:

```
Agent Layer v2
      ↓
Defined roles
      ↓
Capabilities
      ↓
Data access
      ↓
Authorization boundaries
      ↓
Tests
      ↓
Public representation
```

Until that specification exists: **Agent Layer → NOT PUBLIC / NOT CLAIMED.**

## 2. Business Radar

Keeps the proven story:

```
Intent
 → Matching
 → Radar
 → Introduction
 → Relationship
```

Radar functional logic is not changed.

## 3. Finance Intelligence

The public story is:

- market data
- screening
- strategy research
- backtesting
- paper book
- performance measurement

Required sentence: **Research and paper execution — not brokerage.**

## 4. AI Strategy Copilot

```
Human Idea
    ↓
Specification
    ↓
Validation
    ↓
Canonical Strategy
```

Required message: AI translates and validates the investment idea. AI does not make an execution decision on its own.

## 5. Risk & Governance

```
Policy
 ↓
Evaluation
 ↓
Human Approval
 ↓
Audit
```

Risk and governance are a separate control layer, not a marketing label on a trading engine.

## 6. Execution Safety

```
Authorization
 ↓
Safety Controls
 ↓
Dispatch Contract
 ↓
External Result
 ↓
Reconciliation
 ↓
STOP
```

Visible statements, matching what is proven at `92378f8`:

- LIVE EXECUTION: BLOCKED
- No broker connection.
- No production credentials.
- No live order transmission.

An observed external result is not a sent order.

## Legacy cleanup

Redirect is not cleanup. If the old public story remains in the repository and can be found or indexed, it still conflicts with the product.

This specification inventories that story. It does not delete the agricultural agent code and it does not rewrite public pages. Automatic deletion is not part of this gate.

### Public narrative to replace

| Location | Conflict |
|---|---|
| `README.md` | Opens as a farming operating system of specialized agents. |
| `index.html`, `bg/index.html` | AgriNexus Academy home. |
| `academy.html`, `bg/academy.html`, `course.html` | Academy product. |
| `agents.html`, `bg/agents.html` | Agent team running an operation. |
| `platform.html`, `bg/platform.html` | Old AgriNexus platform story. |
| `methodology.html`, `bg/methodology.html` | Forecast and CBOT-style prediction messaging. |
| `market-intelligence.html`, `bg/market-intelligence.html` | Academy chrome plus delayed CBOT ticker. |
| `dashboard.html`, `bg/dashboard.html`, `analytics.html`, `bg/analytics.html` | Academy dashboard and CBOT metrics. |
| `sponsor.html`, `archive.html` | Sponsor messaging. |
| Root analysis articles that link to `/sponsor` | Sponsor path on the old public site. |
| `apps/web/src/app/[locale]/agents/page.tsx` | “team of 18” that “run a farm that almost runs itself.” |
| `apps/web/src/app/[locale]/platform/page.tsx` | Model library feeding 18 agents. |
| `apps/web/src/app/[locale]/sponsors/page.tsx` | Crop, farm, and Academy sponsorship, including named sponsor logos. |
| `apps/web/src/app/[locale]/methodology/page.tsx` | AgriNexus forecast from delayed CBOT, news, weather, and FX. |
| `apps/web/src/components/community/CommunityHub.tsx` | “18 agents” and Academy course link. |
| `apps/web/src/components/home/parts.tsx` | Sponsor block linking to `/sponsors`. |
| `apps/web/src/components/home/TerminalDemo.tsx` | “AgriNexus · 4 agents consulted.” |
| `apps/web/src/components/simple-ask-panel.tsx` | Delayed CBOT placeholder. |
| `apps/mobile/lib/strings.ts` | AgriNexus Academy kicker. |
| `apps/web/next.config.ts` | Redirects `/academy`, `/market`, `/agents`, `/platform`, `/sponsors`, `/methodology`, `/fields`, `/community`, and `/ask` home. The source text remains. |

`docs/PRODUCT-CUTOVER-V1.md` correctly froze the Radar journey and hid those routes from navigation. Hiding is not the same as removing the text.

### Not part of this cleanup

Do not rewrite these as a website content change:

- `verticals/finance/**` and `migrations/001`–`041`
- `verticals/agriculture/**` engine code
- `archive/**`, already off the new product surface
- `fieldlot/**`, a separate surface

## Boundaries of this gate

Allowed:

- information architecture
- navigation structure
- page hierarchy
- messaging and content specification
- legacy-content inventory

Not allowed:

- visual implementation
- CSS redesign
- component refactor
- any change to finance logic
- any change to P5
- starting P6
- any change to the live boundary
- broker, network, or credentials

## Gate position

```
606e08b → 92378f8 → STOP
P6 → STOP
Visual design → NOT STARTED
Agent Layer → NOT PUBLIC / NOT CLAIMED
Agent Layer v2 → NOT STARTED
Website IA v1 → ACCEPTED
```

The next gate is Website Visual/UI Specification only: design concept and structure first. Implementation and verification come after that specification. The Visual/UI gate may not open the finance execution boundary, clean legacy files, or start P6.
