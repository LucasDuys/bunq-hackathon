# Carbon Autopilot — Design System

> Single source of truth for how Carbon Autopilot **looks, feels, and speaks**.
> Inspired by [Wise](https://getdesign.md/wise/design-md) (friendly fintech, bright-green accent, scale-on-hover) and cross-referenced with **bunq's own brand** (dark-first, Montserrat display, Inter body, Easy Green deep-forest-to-bright-mint palette). Adapted for a carbon accounting + auto-reserve product sitting on bunq Business.
>
> If anything in this document contradicts code, **fix the code**, not the doc. If the code knows a truth the doc doesn't, update the doc in the same PR.
>
> Format: [Stitch DESIGN.md](https://stitch.withgoogle.com/docs/design-md/overview/) 9-section spec + product-specific extensions.

---

## 1. Visual Theme & Atmosphere

Carbon Autopilot is a **carbon-accounting companion for bunq Business**. It has to feel like a native extension of bunq — not a grey ESG dashboard bolted on. The mood is **calm, confident, auditor-grade, and quietly optimistic**. Every screen answers three questions in order: *How much CO₂e?* → *How sure are we?* → *What did we do about it?*

The aesthetic borrows three things from bunq:

1. **Dark-first palette option** with deep-forest-to-bright-mint pairings (`#002E1B` ↔ `#00ff95`) — the exact palette of bunq's own **Easy Green** plan, which is the closest product in bunq's lineup to ours. Light mode is a first-class equal, not an afterthought.
2. **Montserrat display + Inter body** — bunq's live typography stack. Montserrat is round, friendly, and geometric; Inter is a neutral workhorse. The combination reads as "serious money, human voice."
3. **Rainbow role colors for categories** — bunq uses distinct accents per plan (Easy Green, Core Blue, Pro Purple). We use the same system per CSRD emissions category (Scope 1 fuel, Scope 2 energy, Scope 3 goods, etc.) so the color itself becomes legend.

It borrows three things from Wise:

1. **Bright-green pill CTAs** that physically scale on hover (`scale(1.05)`) and compress on press (`scale(0.95)`). Motion is minimal but tactile.
2. **Inter weight 600 as the body default** — confident, not light. Numbers are always tabular, always the loudest thing on screen.
3. **`font-feature-settings: "calt"`** on all text (contextual alternates), and zero decorative shadows — depth comes from the accent, not from blur.

And one thing from us: every numeric claim is paired with a **confidence indicator** (a percent + colored bar). Users never see `128.3 kg CO₂e` alone — they see it with `91% confidence` next to it. This is the product's non-negotiable visual signature.

**Key characteristics:**
- Light + dark parity; **dark mode is default on mobile**, light is default on desktop (system preference wins).
- Near-black (`#0e0f0c`) text on warm white (`#fafaf9`) in light mode. Deep forest (`#002E1B`) canvas with bright-mint (`#00ff95`) accents in dark mode.
- Pill buttons (`9999px`) for primary actions. Soft cards (`12–20px` radius). No hard-right-angle rectangles anywhere except tables and inputs.
- Shadows are **ring shadows only** (`0 0 0 1px rgba(0,0,0,0.08)`), never blurred drop shadows.
- Every CO₂e number is a tabular figure. Numbers over 1,000 kg auto-switch to `tCO₂e`.
- **Uncertainty is visible, not hidden.** A range (`± 12.4 kg`) or confidence tier color is always within 8px of any emission figure.
- Icons via `lucide-react` at `h-4 w-4` baseline; decorative sizes never exceed `h-6 w-6` in-body.
- Motion uses `transition-[transform,background,opacity] duration-150 ease-out`; scale hover only on interactive. Respect `prefers-reduced-motion`.

---

## 2. Color Palette & Roles

All tokens are defined in `app/globals.css` under `@theme inline` so Tailwind v4 picks them up as utilities (`bg-accent`, `text-accent-fg`, etc.). **Never hard-code hex values in components** — always reference the token.

### 2.1 Brand

| Token | Hex | Role | Taken from |
|---|---|---|---|
| `--brand-forest-950` | `#002E1B` | Dark-mode primary canvas; deep carbon-reserve surface | bunq Easy Green |
| `--brand-forest-800` | `#005d36` | Filled CTA text-on-accent; dark-mode card surface | bunq Easy Green |
| `--brand-forest-600` | `#0e6b40` | Primary button fill in light mode; trend line stroke | bunq Easy Green |
| `--brand-mint-500`   | `#00ff95` | **Hero accent.** Dark-mode CTA fill, confidence-bar "high," active states | bunq Easy Green (bright) |
| `--brand-mint-200`   | `#cdffad` | Hover wash, selection highlight, active-row tint | Wise pastel |
| `--brand-mint-100`   | `#e2f6d5` | Light-mode accent-surface, badge background | Wise light mint |
| `--brand-ink`        | `#0e0f0c` | Primary text (light mode); near-black | Wise |
| `--brand-paper`      | `#fafaf9` | Light-mode canvas; warm, not sterile white | — |

> **Why this pair?** bunq's Easy Green plan is the exact emotional signal we want: earnest sustainability without greenwash. Using its literal palette lets Carbon Autopilot slot into the bunq app aesthetic a user already trusts.

### 2.2 Surfaces

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg-canvas` | `#fafaf9` | `#0a0a0a` | Page background |
| `--bg-surface` | `#ffffff` | `#121212` | Card / panel |
| `--bg-surface-muted` | `#f6f6f6` | `#1c1c1c` | Subtle surface (nav, input) |
| `--bg-accent-subtle` | `#e2f6d5` | `#002E1B` | Tinted surfaces on success/active |
| `--border-default` | `rgba(14,15,12,0.12)` | `rgba(255,255,255,0.10)` | Default border |
| `--border-strong` | `rgba(14,15,12,0.24)` | `rgba(255,255,255,0.20)` | Hover / emphasis border |
| `--ring-accent` | `rgba(0,255,149,0.45)` | `rgba(0,255,149,0.55)` | Focus ring (accessible 3:1 on both modes) |

### 2.3 Text

| Token | Light | Dark | Use |
|---|---|---|---|
| `--fg-primary`   | `#0e0f0c` | `#fafaf9` | Body, headings |
| `--fg-secondary` | `#454745` | `#a6a6a6` | Captions, metadata |
| `--fg-muted`     | `#737373` | `#737373` | Placeholder, disabled |
| `--fg-on-accent` | `#002E1B` | `#002E1B` | Text on mint CTA — always deep forest, never white |

### 2.4 Confidence tiers (product-critical)

Every CO₂e figure carries a confidence tier that maps to a color. **Use these tokens, never ad-hoc emerald/amber/rose.**

| Tier | Range | Token | Hex (light / dark) | Visual |
|---|---|---|---|---|
| High | ≥ 0.85 | `--confidence-high` | `#00ff95` / `#00ff95` | Bright mint — matches brand |
| Medium | 0.60–0.85 | `--confidence-medium` | `#f79009` / `#fdb022` | Amber warn |
| Low | < 0.60 | `--confidence-low` | `#f04438` / `#f97066` | Red escalate |
| Pending | no run | `--confidence-none` | `#9e9e9e` / `#737373` | Neutral grey |

The `ConfidenceBar` in `components/ui.tsx` is the sole canonical renderer. Do **not** reinvent it; extend it.

### 2.5 Category "rainbow" (mirrors bunq plan-color system)

Every CSRD category gets one of these, consistent across charts, badges, and ledger rows. Assigned in `lib/factors/index.ts` — never redefine ad hoc.

| Category | Light | Dark | Notes |
|---|---|---|---|
| **Scope 1 — Fuel / Combustion** | `#912922` | `#ff6b5a` | Red-earth; matches bunq's warm-tone plans |
| **Scope 2 — Electricity** | `#377ef7` | `#00bfff` | Electric blue — bunq "Core" |
| **Scope 3 — Goods & services** | `#0e6b40` | `#00ff95` | Forest/mint — our primary |
| **Scope 3 — Travel & logistics** | `#4000ff` | `#bf00ff` | Purple — bunq "Pro" |
| **Scope 3 — Digital / SaaS** | `#955705` | `#f79009` | Amber — bunq "Freelance" vibe |
| **Uncategorised** | `#737373` | `#9e9e9e` | Pure grey; must be < 8% of spend before CSRD sign-off |

### 2.6 Semantic / status

| Token | Hex | Role |
|---|---|---|
| `--status-success` | `#17b26a` | Approved, transferred, verified |
| `--status-warning` | `#f79009` | Pending review, medium confidence |
| `--status-danger`  | `#f04438` | Rejected, override, low confidence |
| `--status-info`    | `#0080ff` | Informational, neutral highlight |

---

## 3. Typography Rules

### 3.1 Font families

| Role | Family | Weights in use | Source |
|---|---|---|---|
| Display | **Montserrat** | 600, 700, 800, 900 | `next/font/google` — matches bunq.com |
| Body / UI | **Inter** | 400, 500, 600, 700 | `next/font/google` — matches bunq.com and Wise |
| Mono / numbers | **Fragment Mono** _(or fallback **Geist Mono**)_ | 400 | `next/font/google` — bunq uses Fragment Mono |

> **Migration note.** The repo currently loads Geist + Geist Mono in `app/layout.tsx`. Migrate to `Montserrat` + `Inter` + `Fragment Mono` in one PR. Keep Geist Mono as a fallback in `--font-mono` so we never show an unstyled flash. Tailwind v4 config: expose via `--font-display`, `--font-sans`, `--font-mono`.

### 3.2 Hierarchy

| Role | Font | Size | Weight | Line height | Letter-spacing | Notes |
|---|---|---|---|---|---|---|
| Display Hero | Montserrat | 56–72px (clamp) | 800 | 1.00 | -0.02em | Dashboard top number (tCO₂e) |
| Display H1 | Montserrat | 36px | 700 | 1.05 | -0.015em | Page titles |
| H2 | Montserrat | 24px | 700 | 1.15 | -0.01em | Section headers |
| H3 / Card title | Inter | 15px | 600 | 1.25 | -0.005em | `CardTitle` |
| Body | Inter | 14px | 500 | 1.50 | 0 | Default paragraph |
| Body strong | Inter | 14px | 600 | 1.50 | 0 | Emphasis in-flow |
| Caption | Inter | 12px | 500 | 1.40 | 0.02em | `Stat` label, nav meta |
| Micro / uppercase label | Inter | 11px | 600 | 1.20 | 0.08em (uppercase) | `Stat` label, tab markers |
| Numeric — inline | Inter | 14–16px | 600 | 1.50 | 0 | `tabular-nums`, always |
| Numeric — display | Montserrat | 28–72px | 700–800 | 1.00 | -0.02em | `tabular-nums`, always |
| Mono / code / ids | Fragment Mono | 12–13px | 400 | 1.40 | 0 | Tx ids, ledger hashes, webhook payloads |

### 3.3 Principles

- **Sentence case headlines.** Match bunq voice: "Monthly carbon close" — not "Monthly Carbon Close" (fix `app/page.tsx:36`).
- **Weight 500 is body default**, 600 for emphasis. Never body at 400 — it reads thin on dark mode.
- **`font-feature-settings: "calt", "tnum"`** applied globally in `app/globals.css`. Contextual alternates + tabular numbers — matching Wise's `"calt"` rule and adding our non-negotiable tabular digits.
- **Numbers always have `tabular-nums`.** Already applied on `Stat` — extend to every table cell that shows money or CO₂e.
- **Never justify.** Left-align everything except nav.
- **Max line length 66ch** for prose (policy pages, research notes in `research/`).

---

## 4. Component Stylings

Every primitive lives in `components/ui.tsx`. **Don't fork these inline** — extend the file.

### 4.1 Buttons (`Button`)

| Variant | Fill | Text | Border | Shape | Hover | Active |
|---|---|---|---|---|---|---|
| **primary** | `var(--brand-mint-500)` (dark) / `var(--brand-forest-600)` (light) | `var(--fg-on-accent)` / `#fff` | — | pill (`rounded-full`) | `scale(1.02)` + saturate | `scale(0.98)` |
| **secondary** | transparent | `var(--fg-primary)` | 1px `var(--border-default)` | pill | bg `var(--bg-surface-muted)` | `scale(0.98)` |
| **ghost** | transparent | `var(--fg-secondary)` | — | pill | bg `var(--bg-surface-muted)` | — |
| **danger** | `var(--status-danger)` | `#fff` | — | pill | opacity 0.9 | `scale(0.98)` |

- Padding: `sm` = `px-3 h-8 text-xs`, `md` = `px-4 h-10 text-sm`.
- Focus-visible: `outline: 2px solid var(--ring-accent); outline-offset: 2px`. **Always visible**, never removed.
- Disabled: `opacity-50 cursor-not-allowed`, no pointer events.
- **All interactive elements get `transition-transform duration-150`** — scale is the product's motion signature. `prefers-reduced-motion`: swap scale for a 1px y-translate or opacity change.

### 4.2 Cards (`Card`, `CardHeader`, `CardBody`)

- Radius: `rounded-2xl` (16px) default; `rounded-[20px]` for dashboard hero tiles; `rounded-lg` (10px) only for inline inputs.
- Border: `1px solid var(--border-default)`.
- Shadow: none by default. On hover/active: `ring-1 ring-[var(--border-strong)]` — **no drop shadows ever.**
- Background: `var(--bg-surface)`.
- Padding: header `px-5 py-4`, body `px-5 py-4`. For data-dense cards (ledger rows), `px-4 py-3`.
- `CardHeader` separator: `border-b border-[var(--border-default)]`.

### 4.3 Stats (`Stat`)

- Label: 11px uppercase `tracking-wide` in `--fg-muted`.
- Value: Montserrat 28px weight 700, `tabular-nums`, color per tone.
- Sub: 12px `--fg-secondary`.
- Tones: `default` (ink), `positive` (`--brand-forest-600` / `--brand-mint-500`), `warning` (`--status-warning`), `danger` (`--status-danger`).
- **Every stat that represents an estimate must either embed a `ConfidenceBar` or display a `± range` string in the `sub` slot.** This is a product invariant.

### 4.4 ConfidenceBar

- Height: 6px (up from current 2px — thin looks fragile; bunq uses 6–8px bars in the app).
- Track: `var(--bg-surface-muted)`.
- Fill: gradient from tier color at 100% opacity on the filled portion.
- Label above: 11px uppercase "CONFIDENCE" + right-aligned `{n}%` in Inter 600.
- Animate width on mount: `transition-[width] duration-500 ease-out`.

### 4.5 Badges

- Pill (`rounded-full`), 11px, weight 600, `px-2.5 py-0.5`.
- Tones map 1:1 to semantic tokens (`positive` → `--status-success` bg at 15% + text at 100%).
- Category badges use the category rainbow from §2.5 — solid dot at 6px next to an ink label, not full-fill.

### 4.6 Navigation (`Nav.tsx`)

- Sticky top, 56px, `border-b` + `backdrop-blur-md` with `bg-[var(--bg-surface)]/80`.
- Brand lockup: `Leaf` icon in `var(--brand-forest-600)` (light) / `var(--brand-mint-500)` (dark) + "Carbon Autopilot" in Montserrat 600, 14px.
- Nav links: Inter 500, 14px, `--fg-secondary`; active link uses `--fg-primary` + a 2px underline in `--brand-mint-500` offset by 4px below text.
- Right slot: org name ("Acme BV · bunq Business") in 12px `--fg-muted`, `font-mono`.

### 4.7 Tables / Ledger rows

- Row height: 44px (touch target).
- Zebra: `odd:bg-[var(--bg-surface-muted)]/50` — very subtle.
- Hover: full row `bg-[var(--bg-surface-muted)]`.
- Numeric columns right-aligned, `tabular-nums`.
- Category column shows a 6px colored dot (category rainbow) + label.
- Transaction IDs and hashes in Fragment Mono, 12px, `--fg-muted`, `truncate` with tooltip on hover.

### 4.8 Inputs

- Height 40px, `rounded-lg` (10px), 1px border, 14px Inter 500.
- Focus: 2px `--ring-accent` outline, border transitions to `--border-strong`.
- Placeholder: `--fg-muted`.
- Numeric inputs: `tabular-nums` + right-aligned.
- **Currency inputs always display the € prefix inside a leading slot**, not in the label.

### 4.9 Charts (`TrendChart.tsx` and future)

- Line / area fill: category color from §2.5, fallback to `--brand-forest-600` (light) / `--brand-mint-500` (dark).
- Grid: `stroke-[var(--border-default)]` at 0.5 opacity, `strokeDasharray="3 3"`.
- Axes: 11px Inter 500 in `--fg-muted`.
- Tooltip: `Card` styling, 12px Fragment Mono for numeric values, with a confidence tier swatch on the left.
- **Stacked bars for category breakdown**: ordered by emissions magnitude, largest at the base. Colors from §2.5.
- **Confidence-range band** renderable as a 20% opacity area behind the line — mandatory on any chart showing current-month CO₂e.

### 4.10 Close state machine (hero component)

The close flow (`app/close/[id]`, `CloseActions`) is the product's emotional core. It has six states; each has a distinct visual signature:

| State | Color | Icon | Copy example |
|---|---|---|---|
| `INGEST` | `--fg-muted` | `Zap` | "Ingesting transactions…" |
| `CLASSIFY` | `--brand-forest-600` | `Tags` | "Matching merchants…" |
| `ESTIMATE` | `--brand-forest-600` | `Calculator` | "Estimating emissions…" |
| `CLUSTER` | `--status-warning` | `AlertCircle` | "We have 3 questions." |
| `READY` | `--brand-mint-500` | `CheckCircle2` | "Ready to approve." |
| `APPROVED` | `--status-success` | `ShieldCheck` | "Reserve transferred." |

A sticky progress rail (6 dots) sits at the top of the close page. Current state pulses (`animate-pulse`); completed states are solid accent; future states are hollow borders.

---

## 5. Layout Principles

### 5.1 Grid + spacing

- **Base unit: 4px.** Scale: `0.5 (2) · 1 (4) · 2 (8) · 3 (12) · 4 (16) · 5 (20) · 6 (24) · 8 (32) · 10 (40) · 12 (48) · 16 (64) · 20 (80)` — all in Tailwind defaults.
- **Section gap: 24px** (desktop) / **16px** (mobile). Between cards, between heading + body.
- **Inner card gap: 16px**.
- **Line-of-sight rule**: vertically-adjacent numeric values must share the same x-alignment (right edge for money, left edge for labels).

### 5.2 Page shell (`app/layout.tsx`)

- Max content width: `max-w-6xl` (1152px) — current is correct. Do **not** widen; the product is fundamentally a reading surface.
- Horizontal padding: `px-6` desktop, `px-4` mobile.
- Vertical padding: `py-8` desktop, `py-6` mobile.
- Nav height: 56px fixed.

### 5.3 Dashboard

- KPI row: 4 columns desktop → 2 columns tablet → 1 column mobile (`grid-cols-1 md:grid-cols-4`).
- Chart + secondary card row: 3-column grid, chart spans 2 (`lg:grid-cols-3 + lg:col-span-2`). Match existing `app/page.tsx:77`.
- Close-run summary: full-width card, 4-stat grid inside.

### 5.4 Radius scale

| Scale | Value | Use |
|---|---|---|
| `--radius-xs` | 4px | Inline chips, badges |
| `--radius-sm` | 8px | Inputs, small buttons in tight rows |
| `--radius-md` | 12px | Default |
| `--radius-lg` | 16px | Cards |
| `--radius-xl` | 20px | Hero cards, modals |
| `--radius-pill` | 9999px | Primary CTAs, badges with icon+label |

### 5.5 White space philosophy

bunq gives numbers **a lot of air**. A single `tCO₂e` figure lives in ≥ 240px of vertical space on hero dashboards. Don't pack three KPIs where two breathe. If the user can't find the confidence indicator within 400ms of landing, we failed.

---

## 6. Depth & Elevation

| Level | Treatment | Use |
|---|---|---|
| L0 — flat | no border | Page background |
| L1 — ring | `1px solid var(--border-default)` | Default cards, inputs |
| L2 — ring-strong | `1px solid var(--border-strong)` | Hovered/focused cards |
| L3 — inset | inset ring `var(--ring-accent)` 2px | Focused inputs, active tabs |
| L4 — sticky | `backdrop-blur-md` + 80% surface | Nav, bottom action bars |

**Shadow philosophy.** Copy Wise: **no blurred shadows, ever.** Depth comes from ring borders and subtle surface tint shifts. The single exception: the modal / sheet overlay, which uses `backdrop-filter: blur(8px) + rgba(0,0,0,0.4)` to dim the page. Modals themselves still have ring borders, not drop shadows.

---

## 7. Do's and Don'ts

### Do

- Pair every CO₂e number with confidence (`Stat` + `ConfidenceBar`, or `±` range in sub).
- Use sentence case for every headline (bunq voice).
- Use pill buttons for primary CTAs (`rounded-full`).
- Use `scale(1.02)` hover / `scale(0.98)` active on interactive elements (dial Wise's 1.05/0.95 down one notch — we're a dashboard, not a marketing page).
- Use category rainbow colors consistently — same hex in chart, badge, row dot.
- Use Fragment Mono for transaction IDs, ledger hashes, webhook payloads — anything machine-ish.
- Use tabular-nums on every number.
- Respect `prefers-reduced-motion` (swap scale for opacity / 1px translate).
- Dark mode is first-class — test every screen in both.

### Don't

- Don't hard-code hex values in components — always token.
- Don't use emerald-500/600 raw Tailwind — use `--brand-forest-600` / `--brand-mint-500`.
- Don't show a CO₂e number without confidence.
- Don't use Title Case — it reads like a corporate deck.
- Don't use drop shadows. Ring borders only.
- Don't widen past `max-w-6xl`.
- Don't put white text on mint — text on accent is **always** `var(--fg-on-accent)` (deep forest).
- Don't relax `tabular-nums`. Misaligned digits in money columns is the #1 way this product loses trust.
- Don't animate colors on chart updates — only widths and opacity. Color = meaning here.
- Don't show progress spinners without a text label ("Running close…", not just a spin).

---

## 8. Responsive Behavior

### 8.1 Breakpoints (Tailwind defaults)

| Name | Width | Layout change |
|---|---|---|
| Mobile | < 640px | Single column; nav collapses to hamburger; KPI cards stack. |
| `sm` | ≥ 640px | 2-col KPI grid; inline nav labels. |
| `md` | ≥ 768px | 4-col KPI grid; chart + secondary card split. |
| `lg` | ≥ 1024px | 3-col chart row; sidebars allowed on close-run detail. |
| `xl` | ≥ 1280px | Full layout, no further changes — we cap at `max-w-6xl`. |

### 8.2 Touch

- Min tap target: 44 × 44px.
- Pills get +4px horizontal padding on touch (`@media (pointer: coarse)`).
- Row hover states also activate on touch as pressed states.

### 8.3 Mode selection

- Default: respect `prefers-color-scheme`.
- On mobile only, override to dark regardless — matches bunq app behavior (the bunq app is dark-first on mobile).
- `html` classlist switching via the Next.js root layout — no JS flicker. Use the `color-scheme` CSS property.

---

## 9. Voice & Content

Carbon Autopilot's voice = bunq's friendliness + a CFO's precision. It is **honest about uncertainty**, **allergic to jargon**, **never cute at the user's expense**.

### 9.1 Principles

1. **Plain Dutch/English only.** No "carbon offsets" — say "credits we bought from EU-registered projects." No "spend-based methodology" — say "we estimate CO₂e from what you paid." Mirror bunq: *"Forget baffling jargon."*
2. **Show the range.** "128 ± 12 kg CO₂e this month" is better than "128 kg CO₂e (91% confidence)" which is better than "128 kg CO₂e."
3. **Second-person, active.** "You spent €4,320 on fuel" > "€4,320 was spent on fuel."
4. **Numbers before adjectives.** "3 clusters need review" > "A few clusters need review."
5. **Never apologise for the tool.** "We couldn't classify 4 transactions" not "Sorry, we weren't able to classify…"
6. **State the action verb.** `Run carbon close` · `Approve & transfer` · `Override category` — always verb-first.
7. **Celebrate sparingly.** A `ShieldCheck` green badge on APPROVED is enough. No confetti.

### 9.2 Phrase library

| Use case | Preferred | Avoid |
|---|---|---|
| Monthly close CTA | "Run carbon close" | "Generate emissions report" |
| Awaiting review | "3 questions for you" | "User input required" |
| Approve transfer | "Approve & transfer €412" | "Submit" |
| Confidence low | "We're 52% sure" | "Low confidence" (on its own) |
| Reserve | "Carbon Reserve" (title), "reserve" (body) | "Offset pool" |
| Categories | Use IPCC/CSRD names verbatim | Invented labels |

### 9.3 Lexicon (single source of product terms)

- **Close / Carbon close** — the monthly state-machine run that turns transactions into a signed emissions total.
- **Reserve** — the bunq sub-account where money is auto-transferred for future credit purchase.
- **Cluster** — a group of uncertain transactions the agent asks you about at once.
- **Credit** — an EU-registered carbon credit we can buy. Singular noun, never "offset."
- **Confidence** — a 0–1 number (shown as %) on every emissions estimate. Three tiers: High / Medium / Low.
- **Ledger** — the append-only audit log. Not "history," not "log," not "journal."

### 9.4 Numbers

- Currency: `fmtEur()` from `lib/utils.ts` — `en-NL` locale, `€ 4.320`.
- CO₂e: `fmtKg()` from `lib/utils.ts` — `128.3 kgCO₂e` < 1000, `1.42 tCO₂e` above.
- Percent: `fmtPct()` — 0 decimals by default. Confidence uses integer percent.
- Dates: month in `YYYY-MM`, full dates in `24 Apr 2026`, never `04/24/2026` (EU).

---

## 10. Motion

- Global tokens: `duration-150` (micro — hover, press), `duration-300` (standard — panels, tabs), `duration-500` (reveal — bar fills, number count-ups).
- Easing: `ease-out` for enter, `ease-in` for exit.
- Scale hover: `1.02`. Press: `0.98`. Applied to `button`, pill links, card CTAs.
- Numbers count up on first paint of a close-run result (500ms, ease-out). Use `requestAnimationFrame`, not CSS — needs monotonic integer interpolation with `tabular-nums`.
- **No bounce, no overshoot, no parallax.** This is a financial tool.
- Reduced motion: swap all `transform` for opacity or 1px `translateY`. Confidence bar still animates width (meaning is preserved).

---

## 11. Accessibility

- **WCAG 2.2 AA minimum.** AAA for body text where feasible.
- Contrast: verified with axe-core CI. Mint `#00ff95` on deep forest `#002E1B` = 12.3:1 (AAA). Ink `#0e0f0c` on paper `#fafaf9` = 17.6:1 (AAA).
- Focus ring always visible. Never `outline: none` without a replacement.
- All interactive elements have an accessible name (button text, `aria-label`, or wrapped heading).
- Charts include a `<table>` fallback (visually hidden) with the same data — `lucide-react` + `recharts` do not give us this free.
- `ConfidenceBar` includes `role="progressbar"` + `aria-valuenow/min/max`.
- Color is never the sole signal. Confidence tier uses color **and** a text label. Category rainbow pairs color with the category name.
- Keyboard: the whole close flow is reachable with Tab + Enter. Modal traps focus.
- Respect `prefers-reduced-motion` (see §10) and `prefers-color-scheme`.

---

## 12. Asset inventory

| Where | What | Notes |
|---|---|---|
| `app/layout.tsx` | Root font loading | Load Montserrat (400, 600, 700, 800, 900), Inter (400, 500, 600, 700), Fragment Mono (400) via `next/font/google`. Expose CSS vars `--font-display`, `--font-sans`, `--font-mono`. |
| `app/globals.css` | Design tokens | All tokens from §2 under `@theme inline`. Global `font-feature-settings: "calt", "tnum";` on `body`. |
| `components/ui.tsx` | Primitives | Card, Stat, Button, Badge, ConfidenceBar — extend per §4. Every new primitive goes here. |
| `components/Nav.tsx` | Top nav | Per §4.6. |
| `components/TrendChart.tsx` | Recharts area chart | Migrate hard-coded `#10b981` / `#e4e4e7` / `#71717a` to CSS-var-backed colors per §4.9. |
| `lib/factors/index.ts` | Category → color mapping | Single export: `categoryColors` — read from this everywhere. |
| `lib/utils.ts` | Formatters | `fmtEur`, `fmtKg`, `fmtPct`, `cn`. Don't duplicate formatters in components. |

---

## 13. Agent Prompt Guide

When you're asked to build or modify UI, read this first. When in doubt, match an existing screen rather than inventing.

### 13.1 Quick reference

- Accent: `--brand-mint-500` (`#00ff95`) in dark mode, `--brand-forest-600` (`#0e6b40`) in light mode.
- Text on accent: **always** `--fg-on-accent` (`#002E1B`). Never white.
- Display font: Montserrat 700–800, -0.015em tracking.
- Body font: Inter 500 default, 600 for emphasis.
- Mono: Fragment Mono (fallback Geist Mono).
- Radius: 16px cards, 9999px pills. No hard rectangles.
- Every number is `tabular-nums`. Every CO₂e number pairs with confidence.

### 13.2 Starter prompts

- *"Add a new KPI card:"* Use `<Card><CardBody><Stat label=".." value=".." sub=".." tone=".." /></CardBody></Card>`. If the value is an emissions estimate, include `<ConfidenceBar value={..} />` in the body.
- *"New page header:"* `<h1 className="text-2xl font-semibold tracking-tight font-display">` using sentence case, with a one-sentence sub-paragraph in `text-sm text-[var(--fg-secondary)]`. Place primary CTA to the right (flex + justify-between).
- *"Chart update:"* Use `TrendChart` shape; never inline a new `recharts` component. Colors from category rainbow in §2.5.
- *"Button:"* Import from `components/ui`. Pick `primary` / `secondary` / `ghost`. Never restyle — extend the component if a new variant is needed.

### 13.3 Checklist before opening a PR on any UI change

- [ ] All colors reference CSS variables (no raw hex, no raw Tailwind emerald/zinc).
- [ ] Works in dark **and** light mode — screenshot both.
- [ ] `tabular-nums` on every number.
- [ ] Any CO₂e number has a companion confidence indicator or `±` range.
- [ ] Focus-visible ring on every interactive element.
- [ ] `prefers-reduced-motion` respected.
- [ ] Headlines sentence case.
- [ ] No drop shadows introduced.
- [ ] Min touch target 44px.
- [ ] Tested at 375px, 768px, 1280px widths.

---

## 14. Inspirations & attribution

- **Wise DESIGN.md** (via [awesome-design-md](https://github.com/VoltAgent/awesome-design-md)) — base structure, pill+scale CTA rules, `"calt"` everywhere, Inter-at-600 body rule, ring-shadow philosophy.
- **bunq brand** (bunq.com, bunq Together, bunq press kit) — Montserrat display + Inter body + Fragment Mono stack, dark-first mode, Easy Green deep-forest-to-bright-mint pairing, rainbow-plan role-color system, sentence-case headlines, "Forget baffling jargon" voice.
- **Stitch DESIGN.md format** (Google) — 9-section template.

This is an **inspired-by** document, not an official bunq asset. Do not ship to production without legal review of any direct brand lift.

