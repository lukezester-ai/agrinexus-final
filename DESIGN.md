# Design

Direction for the working product in `apps/web`. The working name is **Core**. The final brand is not chosen (`apps/web/src/lib/product-identity.ts`). Until it is, product chrome says Core. It does not grow a second wordmark.

This is a build document. A designer can lay out from it. An engineer can token from it. It does not authorize a visual rewrite while Product Experience / Visual Polish v1 is blocked (`docs/PRODUCT-REVIEW-V1.md`). Information architecture in `docs/PRODUCT-CUTOVER-V1.md` stays frozen.

## The product

Core is a business decision desk. It is not a social network, not a farm dashboard, and not a broker.

A person states a Business Intent (buy, sell, or partner). The system looks for a compatible opportunity. Radar shows what it found, why it fits, what stays hidden, and the next safe action. Identity stays unnamed until both sides agree to an introduction. A relationship is the result of that mutual decision. Finance, the strategy copilot, and risk governance sit on the same idea: a person can study a path, and a person must approve the risky step. Live execution is blocked. Nothing is sent to a broker. Production transmission is no.

The public path is a real sequence, so it may look like one:

Intent → Business Intelligence → Business Radar and Finance Intelligence → AI Strategy Copilot → Risk & Governance → Execution Safety → STOP

The authenticated path is narrower: create an intent, read Radar, qualify, request an introduction, accept or decline, see the relationship. Settings sit beside that, not above it.

Locales are English (the reference copy), Bulgarian, and Arabic. Arabic is right-to-left. Glossary terms are fixed in `apps/web/src/lib/product-ux-copy.ts`. Do not invent parallel names for Intent, Opportunity, Match, Introduction, Relationship, Confidential, or Strong match.

Two other stacks live in this repo and are not Core:

- **Legacy marketing HTML** (`styles/agri-market-shared.css`, `docs/DESIGN-SYSTEM.md`) — Academy, agents, market pages, the five color families, the ticker. Not linked from the current public shell.
- **FieldLot** (`docs/AGRO-MODERNISM-DESIGN-SYSTEM.md`, `fieldlot/public/styles/PALETTE.md`) — Bulgarian B2B listings, parchment “yellow pages,” DM Sans, forest `#003625`. A different product. Do not import its parchment, pill buttons, or gold card bars into Core.

Agriculture, Academy, Furrow, crop, and CBOT language stays out of Core chrome. The dashboard still reads `farm_profiles` for a display name. That is storage residue, not a visual theme.

## Direction

**A ledger that refuses to fill in a name.**

The memorable object is the empty rule where the other party’s name would sit. Harvest color marks that withheld line and the STOP at the end of the execution path. Everything else is quiet paper, true black ink, and one forest green for the action that moves the decision forward.

Spend the boldness there. Do not spend it on a gradient word, a drifting background, a terminal that pretends to be a market floor, or a grid of identical cards.

The page opens on the decision, not on a slogan. On the public home, the first readable line is “From business intent to governed decision.” The chain follows, and the chain ends in STOP with `LIVE EXECUTION: BLOCKED` and `Production transmission: NO`. On Radar, the first card answers four questions in order: what we found, why it fits, what’s hidden, what to do next. A person should point at the opportunity within ten to fifteen seconds without a tour (`docs/PRODUCT-REVIEW-V1.md`).

### What this replaces

The repo currently shows three unfinished looks. This document picks one.

| Surface today | Problem | Use instead |
| --- | --- | --- |
| Public shell, `#141618`, mint `#8fbf9a`, tracked capitals, “AGRI NEXUS” | A second brand. Reads as a generic dark terminal. Cutover already said product chrome does not present AgriNexus. | Ledger paper, Core wordmark, the same column as Radar. |
| Dashboard paper `#f6f3ec`, forest buttons, harvest confidential panels | Closest to the product. Uppercase kickers, a gradient “C”, and aurora in `globals.css` are leftover decoration. | Keep the paper and the two hues. Remove the decoration. |
| Marketing HTML: Inter, five families, terracotta, gold, ticker | Right for the archived agriculture site. Wrong for Core. | Leave it in `styles/`. Do not retoken `apps/web` from it. |

## Color

Six colors. They already exist in `apps/web/tailwind.config.ts` or one step away from the dashboard background. Do not add a seventh accent.

| Name | Hex | Job |
| --- | --- | --- |
| Ledger | `#F6F3EC` | Page background. This is the dashboard ground today. Token `paper` (`#F8F6F1`) is close; new screens use Ledger so work surfaces match. |
| Ink | `#0A0A0A` | Text, the Core mark, icons. True black, already `ink`. |
| Forest | `#1F4D2C` | The one forward action. Already `forest.700`. Hover `#0E2818` (`forest.900`). |
| Harvest | `#8A6A2F` | Confidential, waiting, and STOP. Already `harvest.700`. Panel fill `harvest.50` `#FAEDD1`. The public stop gold `#E2B657` is retired; it shouted on black and has no token. |
| Rule | `#E7E1D6` | Hairlines, card edges, the vertical chain. Ink at 8% is allowed when a token is inconvenient; do not invent a gray scale. |
| Alert | `#A85050` | Errors only. Already `semantic.alert`. Fill `#FBF4F4`. |

Forest-500 `#5A9968` is the live dot if a status must pulse. It is not a second brand green, and it is not a link color. Links are ink, underlined.

Success inside a relationship row may use forest text on `forest.50` `#F0F5F0`. Warning that is not confidential uses `earth.600` `#B87A3D` as text, not as a fill. Info `#3A6580` is unused until a screen has a genuine informational state. Do not paint cards with it “for variety.”

Retired on Core surfaces: aurora washes, grain overlay, glass blur, `grad-text`, the brand gradient on the mark, terracotta `#CC4E36` from the marketing CSS, FieldLot parchment `#F0DBA8`.

Contrast: ink on ledger, white on forest, and harvest-700 on harvest-50 all clear body text. Harvest-500 `#C4A86A` fails as small text. Use it only as a rule or a 2px bar, never as a label.

## Type

Two families for Latin and Cyrillic, one sibling for Arabic. The reason is the product’s three locales, not a moodboard.

- **IBM Plex Serif** — page title, and the strength line on a match card (“Strong match”, “Good match”, “Possible match”).
- **IBM Plex Sans** — everything else, including Bulgarian. Use tabular figures for percents, prices, and counts.
- **IBM Plex Sans Arabic** — Arabic UI. Set it only under `html[dir="rtl"]`. Do not fall through to Georgia for Arabic.

Plex Serif is not Fraunces and not the marketing Times price. Plex Sans is not Inter. System stacks in `apps/web/src/app/globals.css` stay as the fallback when the webfont is blocked: `system-ui` / `Segoe UI` for sans, Georgia for serif, and the existing Arabic stack (`Segoe UI`, Tahoma, `Noto Naskh Arabic`) if Plex Arabic fails to load.

Do not load a monospace face for labels. JetBrains Mono belongs to the legacy ticker. Finance digits use Plex Sans tabular figures.

| Role | Face | Size | Weight | Line height | Tracking |
| --- | --- | --- | --- | --- | --- |
| Display | Serif | 40px, 32px under 720px | 500 | 1.15 | −0.02em |
| Card strength | Serif | 26px | 500 | 1.1 | −0.02em |
| Section title | Sans | 15px | 600 | 1.3 | 0 |
| Body | Sans | 16px | 400 | 1.5 | 0 |
| UI / card body | Sans | 14px | 400 | 1.45 | 0 |
| Meta | Sans | 13px | 500 | 1.35 | 0 |

Measure: 66 characters for prose. The work column is already `max-w-[720px]` in `journey-ui.ts`. Keep it. Public pages use the same column, left aligned. Do not center the chain.

Sentence case. The match-card labels “What we found”, “Why it fits”, “What’s hidden”, and “What to do next” are structure, set in meta style, not in small capitals. The single exception is the interlock string `LIVE EXECUTION: BLOCKED`. It stays in that exact English form, in sans 14px medium, harvest-700, until copy localizes it on purpose. Do not soften it into a paragraph.

Do not italicize one word of a headline. Do not put a middle dot between facts; the journey fact row already separates with gap. The glossary does not use “A · B · C”.

## Layout

Left aligned. One column for the decision. A rail only on the authenticated desk, and only from the `md` breakpoint up, as the sidebar already does (220px).

```
Public home and direction pages

Ledger
┌──────────────────────────────────────────────┐
│ Core                                         │
│ Home   Radar   Finance   Copilot   Risk   …  │
│                                              │
│ From business intent to governed decision.   │
│                                              │
│ Intent                                       │
│ │                                            │
│ Business Radar                          open │
│ Finance Intelligence                    open │
│ │                                            │
│ …                                            │
│ │                                            │
│ STOP                                         │
│ ┌──────────────────────────────────────────┐ │
│ │ LIVE EXECUTION: BLOCKED                  │ │
│ │ Production transmission: NO              │ │
│ └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘

Radar (authenticated)

┌────────┬─────────────────────────────────────┐
│ Core   │ Business Radar                      │
│        │ When a compatible opportunity…      │
│ Radar  │                                     │
│ Intents│ ┌ What we found                     │
│ Opps   │ │ Title or “Business opportunity”   │
│ Start  │ │                                   │
│        │ │ Why it fits                       │
│        │ │ Strong match                      │
│ Settings│ │ 72% criteria alignment            │
│        │ │ industry alignment                │
│        │ │                                   │
│        │ │ What’s hidden                     │
│        │ │ ────────────────  (empty rule)    │
│        │ │ Confidential. The other party…    │
│        │ │                                   │
│        │ │ What to do next                   │
│        │ │ [Qualify]                         │
│        │ └                                   │
└────────┴─────────────────────────────────────┘
```

The vertical rule on the public chain is justified because the content is a sequence. Do not number the steps 01, 02, 03. The names are the numbers.

Radar stacks primary items first: candidate match, pending introduction, qualified match. Relationships and open opportunities sit in a second, quieter group. One card is in focus. Do not tile matches into a gallery.

Spacing is a 4px grid. Page padding 16px on small screens, 32px from `md`. Inside a card, 20px. Between the four card parts, a rule and 16px, not a new card. Touch targets are at least 44px. The journey actions already use `min-h-11`.

Radius has jobs:

| Radius | Use |
| --- | --- |
| 0 | Chain, definition lists, the STOP band. These are documents. |
| 4px | The Core mark. |
| 12px | Buttons, inputs, the confidential inset, error alerts. |
| 16px | The match card and the finance step panel. |

Do not round everything to the same pill. Pill buttons belong to FieldLot, not here.

## The withheld name

This is the signature. Build it once and reuse it wherever identity is hidden.

On a confidential match the title is the safe title, or “Business opportunity” if there is no safe title. Under “What’s hidden”, draw a 2px harvest-500 rule, 12rem wide, maximum 100% of the card. No text on the rule. The sentence sits under it, in the existing words:

> Confidential. The other party stays unnamed until both sides agree to an introduction. This screen does not try to infer identity.

Harvest-50 panel, harvest-700 label, ink body. No lock icon, no blur of a fake name, no skeleton that implies the name is loading. The line is empty because the product is withholding, not because data failed.

When both sides have accepted, the rule is gone and the organization names are set in the title in sans semibold. A relationship row uses forest-50. Do not animate a name “decoding.”

A strong match is criteria alignment. The percent sits in tabular figures beside the words “criteria alignment.” It is not a deal, not a score to celebrate, and not a ring chart.

## Components

### Wordmark

A 22px square, forest-700, white “C” in sans 12px medium, radius 4px. The word “Core” beside it in sans 13px medium ink. No gradient, no shadow, no leaf.

### Rail

Paper at 85% over ledger, a rule on the inline-end edge so Arabic mirrors cleanly. Active item: ink at 6% fill, medium weight. Inactive: ink at 65%. Group label in meta style, sentence case (“Today”, not “TODAY”). Five destinations, in this order: Radar, Intents, Opportunities, Start, Settings. Icons are optional; if used, one weight, no emoji mixed with outline icons. The current “◎” and “⚙” mix is a placeholder, not a system.

### Match card

White on ledger, 1px rule, radius 16px, shadow `0 1px 2px rgba(10,10,10,0.04)` only. No lift on hover.

Order inside the card is fixed: found, why, hidden, next. Omit a block when it has nothing to say, except “What’s hidden” on a confidential match, which is never omitted. Primary actions, one per state:

| State | Action | Tone |
| --- | --- | --- |
| Candidate match | Qualify | Forest fill, white text |
| Pending introduction | None. “Waiting for the other party to respond.” | Harvest-50, harvest-700 text |
| Qualified match | Request introduction | Forest |
| Qualified match | Accept | White, ink text, 1px ink rule |
| Qualified match | Decline | Quiet: no border, ink at 55%, hover ink at 4% |
| Relationship | Status in forest-700, no new CTA | Forest-50 card |

The button label and the resulting state use the same verb. Qualify stays Qualify while the request runs, then the card becomes the next state. The pending label is “Working…”, not a spinner with no word.

### Public chain

Each open stage is a full-width row: name on the left, “Open” on the right in meta style, sentence case. Border is the rule color. Hover darkens the border to ink at 40%. Non-links (Intent, Business Intelligence, STOP) are text, not fake buttons. STOP is harvest-700. The blocked band is a 1px harvest-700 border, ledger fill, no fill of solid gold.

### Finance desk

Same column, same paper, same type. Research steps stack vertically: market, screening, strategy, backtest, paper book, then the safety path (authorization, safety controls, dispatch contract, external result, reconciliation, STOP). A machine step uses the forest button. A human approval uses a white button with a 2px ink border, labeled with the decision already in the desk: “Approve this result”, “Authorize this intent”. Not “Submit”. The blocked line is repeated on the desk and after reconciliation. An observed result is not a sent order; say that in the note under the result, in the words already on the execution-safety page.

### Forms

White field, 1px ink at 12%, radius 12px, 14px text. Focus: 2px forest-700 outline, offset 2px. Placeholder is ink at 40%. The intent form asks for what the matcher needs: kind, industry, markets, visibility, a public-safe description. Confidential details are a separate field, labeled Confidential, with the hint that they stay hidden until an introduction is accepted.

### Empty and error

Empty Radar with an active intent: “Your Business Intent is active. The system is looking for compatible opportunities — nothing to review yet.” No illustration. Empty with no intent: one forest button, “Create your first Business Intent.”

Errors name the failure and the next step. “Radar could not load. Try again.” No apology, no joke. Alert color, `#FBF4F4` fill. A missing schema says the radar is not available on this database yet.

## Motion

One moment, and only on a match card arriving with a withheld name: the harvest rule draws from the inline start to 12rem over 280ms, ease-out. It runs once. It does not loop.

State changes (qualify, request, accept, decline, waiting) replace the action row in place. Do not fade the whole page.

Do not animate the public chain, do not drift a background, do not pulse a dot on Core, do not lift cards, do not ticker prices on these screens.

`prefers-reduced-motion`: the rule is already at full length. Transitions on buttons drop to none.

## Voice

Plain verbs, sentence case, one job per line. English is the source; Bulgarian and Arabic translate the same keys. Do not leave English labels inside a Bulgarian screen except the execution interlock.

Write what the person can do.

- “Qualify”, “Request introduction”, “Accept”, “Decline”, “Create your first Business Intent”.
- “Waiting for the other party to respond.”
- “A match is criteria alignment. It is not a closed deal.”
- “No broker connection. No production credentials. No live order transmission.”

Do not write what the system wishes it were. No “unlock insights”, no “meet your counterpart”, no harvest metaphors, no “farmers’ morning briefing” on Core. Community, likes, follows, comments, and profile vanity are out of scope. If a feature needs those to make sense, it does not belong on this desk.

Buttons do not end in an arrow. The down-arrow between public stages is a sequence mark, `aria-hidden`, and it is the only arrow.

## Surfaces

| Surface | Document that wins | Visual |
| --- | --- | --- |
| `apps/web` public pages, dashboard, finance desk | This file | Ledger, Core, withheld name, STOP |
| `styles/agri-market-*.css`, root `*.html` | `docs/DESIGN-SYSTEM.md` | Existing marketing system. Do not “refresh” it from this file. |
| `fieldlot/` | `docs/AGRO-MODERNISM-DESIGN-SYSTEM.md` | Agro-Modernism. Do not “refresh” it from this file. |
| `apps/mobile` | Follow this file when a screen is Core (intent, radar, introduction). Academy screens stay on the Academy docs. | |

Shared chrome in `apps/web` that still paints aurora, glass, or gradient text is legacy. New work does not call those classes. Deleting them is a later cleanup, not part of describing the direction.

## Accessibility

- Keyboard focus is the 2px forest outline above, visible on ledger and on white.
- The blocked band is `role="status"`. The current step in a chain is `aria-current="step"`.
- Do not encode state by color alone. Waiting has a sentence. Alert has a sentence. The empty name has a sentence under the rule.
- Strength and percent ship together. A percent without “criteria alignment” reads as a grade.
- RTL mirrors the rail, the chain rule, the card padding, and the drawing direction of the withheld rule. Percents and the English interlock stay left-to-right (`dir="ltr"` on the number, as the match card already does).
- Body text stays at least 14px. Meta at 13px is the floor. The 9px and 10px labels in the sidebar are below the floor; bring them up to 13px when that file is next touched.

## For engineers

Tokens to add or alias, names first:

```css
--ledger: #f6f3ec;
--ink: #0a0a0a;
--forest: #1f4d2c;
--forest-press: #0e2818;
--harvest: #8a6a2f;
--harvest-line: #c4a86a;
--harvest-fill: #faedd1;
--rule: #e7e1d6;
--alert: #a85050;
--alert-fill: #fbf4f4;
--font-serif: "IBM Plex Serif", Georgia, serif;
--font-sans: "IBM Plex Sans", system-ui, sans-serif;
--font-arabic: "IBM Plex Sans Arabic", "Noto Naskh Arabic", Tahoma, sans-serif;
```

Map them onto the existing Tailwind keys (`paper`, `ink`, `forest.700`, `harvest.700`, `harvest.500`, `harvest.50`, `semantic.alert`) rather than inventing a parallel palette in components. `journey-ui.ts` remains the class source for the authenticated journey. Public pages should consume the same colors instead of raw `#141618`, `#8fbf9a`, and `#e2b657`.

Copy stays in `product-ux-copy.ts`. Visual work does not rewrite glossary strings to sound warmer.

Do not implement this file’s public-shell change while the polish gate is blocked. When that gate opens, the first correction is the split brain: one paper, one wordmark, the withheld rule, the harvest STOP. Not a new illustration set.
