# Website Visual/UI v1 — SPEC

Status: **ACCEPTED**. Parent: `docs/WEBSITE-IA-V1.md` (**ACCEPTED**). Boundary: `92378f8`.

This document does not implement pages, CSS, or components. It does not delete legacy files. It does not change `606e08b` or `92378f8`. P6 does not start. Agent Layer v2 does not start.

```
606e08b → 92378f8 → STOP
Website IA v1 → ACCEPTED
Website Visual/UI v1 → ACCEPTED
Visual Implementation → NOT STARTED
```

## Concept

The public site is a business intelligence control room for a governed decision. It is not an agricultural AI site, not a trading terminal, not an “18 AI agents” site, not an autonomous or autopilot product, and not a broker.

No robots, glowing brains, agent cards, farm photography, crop icons, or broker chrome.

Identity, on every public page:

AGRI NEXUS
Universal Business Core
Business Intelligence & Decision Infrastructure

Public line: **From business intent to governed decision.**

## Visual language

- Field: graphite / near-black.
- Type: white and silver. One clear sans for interface labels. Short lines. No decorative scripts.
- Green: a thin origin accent for AGRI NEXUS only. Not a farm palette.
- Amber: important state only. STOP and LIVE EXECUTION: BLOCKED use amber. Amber is not a decoration.
- Structure: hairline grid, orthogonal connectors, data-flow lines.
- Space: a wide empty field and minimal visual noise. No scene, no mascot, no 3D object as the hero.
- Motion: only along a real step in the chain. A line may travel from one proven stage to the next. Nothing loops for atmosphere.

## Chrome

Six equal destinations. No seventh item for agents.

HOME
BUSINESS RADAR
FINANCE INTELLIGENCE
AI STRATEGY COPILOT
RISK & GOVERNANCE
EXECUTION SAFETY

The word Core, as the temporary product mark, is not the public name. Radar matching, introduction, and relationship behavior stay as they are. This specification styles the public explanation. It does not redesign the signed-in Radar product.

## Home structure

Order on the page:

1. Identity and the public line.
2. One system diagram. This is the home composition. The six names remain equal in the navigation. The diagram shows sequence, not six competing heroes.

```
                 AGRI NEXUS
          UNIVERSAL BUSINESS CORE
       From business intent
        to governed decision
                 ┌───────┐
                 │ INTENT│
                 └───┬───┘
                     ↓
          ┌────────────────────┐
          │ BUSINESS INTELLIGENCE│
          └─────────┬──────────┘
                    ↓
        ┌───────────┴───────────┐
        ↓                       ↓
 BUSINESS RADAR        FINANCE INTELLIGENCE
        │                       │
        └───────────┬───────────┘
                    ↓
             AI STRATEGY COPILOT
                    ↓
             RISK & GOVERNANCE
                    ↓
             EXECUTION SAFETY
                    ↓
                  STOP
```

3. Under STOP, one visible state: **LIVE EXECUTION: BLOCKED**.
4. Each node links to its page. INTENT and BUSINESS INTELLIGENCE are stages on the diagram, not extra navigation items.

The diagram must not include an agent count, an autonomy ladder, or a forecast.

## Page structure

Each direction page uses the same frame:

1. Identity line, smaller than on Home.
2. Direction name.
3. One chain, exactly as in the accepted IA.
4. One boundary sentence.
5. No second product, no agent roster, no execution button.

### Business Radar

```
Intent → Matching → Radar → Introduction → Relationship
```

Boundary: a match is criteria alignment. It is not a closed deal. Confidential identity stays hidden until both sides agree to an introduction.

### Finance Intelligence

```
Market data → Screening → Strategy research → Backtesting → Paper book
```

Performance figures, where shown, belong to the paper book. They are not a live trading result.

Boundary: **Research and paper execution — not brokerage.**

The old Market/Finance chat is not a source for this page.

### AI Strategy Copilot

```
Human idea → Specification → Validation → Canonical strategy
```

Boundary: AI translates and validates the investment idea. AI does not decide execution.

### Risk & Governance

```
Policy → Evaluation → Human approval → Audit
```

Boundary: this is a control layer. It is not a label on a trading engine.

### Execution Safety

```
Authorization → Safety controls → Dispatch contract → External result → Reconciliation → STOP
```

Boundary, visible together:

- LIVE EXECUTION: BLOCKED
- No broker connection.
- No production credentials.
- No live order transmission.

An observed external result is not a sent order.

## Reading and motion

The diagram reads top to bottom in the document order above. On a narrow viewport the same stages stack in that order. Connectors remain visible. Nodes do not become a card grid of agents.

Type contrast must stay readable on the dark field. STOP and BLOCKED must be text, not color alone.

If motion is implemented later, it may trace the connectors once. It may not imply that a stage is running live, and it may not animate a send.

## Out of scope

- Page implementation, CSS, and component edits
- Deleting or rewriting legacy Academy, farm, CBOT, sponsor, or agent files
- Any change under `verticals/finance/**` or `migrations/**`
- P6
- Agent Layer v2
- A public claim of 18 or 19 agents, autopilot, autonomous trading, AI-managed farms, live forecasting, broker execution, or live orders

## Next

Visual Implementation is a separate gate. It has not started.

When it starts, its order is: read the real `apps/web` structure, write a component and page plan, implement, verify responsive behavior, run typecheck/test/build, diff audit, freeze, commit, stop.

Through that gate and until then:

- `606e08b` stays frozen
- `92378f8` stays frozen
- P6 stays stopped
- Legacy cleanup stays not started
- Agent Layer v2 stays not started
