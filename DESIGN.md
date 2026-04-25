# Carbo — Design System (Supabase-inspired)

> Single source of truth for how Carbo **looks, feels, and speaks**.
> If anything in this doc contradicts code, **fix the code**, not the doc.
> Inspired by Supabase: dark-mode-native, terminal-rooted, sparingly green, depth-through-borders, weight-restrained typography.

---

## 0. Implementation note (font substitution)

Supabase ships `Circular` (paid). We use **Inter** as the OSS substitute — same geometric-with-rounded-terminals feel and the doc's own declared fallback. Mono is **Source Code Pro** (free on Google Fonts).

- `--font-sans` → Inter (treat as "Circular" everywhere in this doc)
- `--font-mono` → Source Code Pro
- No serif. Drop legacy `Instrument Serif` use; large displays use Inter at weight 400 with `line-height: 1.00`.

---

## 1. Visual Theme & Atmosphere

Carbo is a **carbon-accounting companion for bunq Business** that should feel like a premium developer tool, not a green ESG dashboard. The mood is **dark-mode-native, terminal-rooted, calm, auditor-grade**. Every screen answers three questions in order: *How much CO₂e?* → *How sure are we?* → *What did we do about it?*

The aesthetic is Supabase's: deep near-black canvas (`#0f0f0f`, `#171717`) with emerald (`#3ecf8e`) used selectively as an *identity marker*, not decoration. Depth comes from a sophisticated **border hierarchy** (`#242424` → `#2e2e2e` → `#363636`), never from drop shadows. Typography is **Inter at weight 400 by default**, weight 500 only for nav and buttons — there is no bold. Hero text compresses to `line-height: 1.00` to read like a terminal command: dense, efficient, no wasted vertical space.

The product's non-negotiable visual signature: **every CO₂e number pairs with a confidence indicator** (bar or `±` range).

**Key characteristics:**
- Dark-mode-native; near-black `#0f0f0f` / `#171717` — never pure black, never light mode.
- Emerald (`#3ecf8e` / `#00c573`) used **sparingly** — logo, links, accent borders, focus rings. Not for filled surfaces.
- Inter at weight 400 default; weight 500 only for buttons + nav. **No 700/bold anywhere.**
- Hero text at `line-height: 1.00`, slightly negative tracking. Card titles `letter-spacing: -0.16px`.
- Source Code Pro `uppercase`, `letter-spacing: 1.2px` for technical labels (KPI labels, status markers).
- Pill (`9999px`) for primary CTAs and tab indicators. **6px** for ghost/secondary buttons. **8–16px** for cards. Nothing in between.
- **No drop shadows.** Depth is encoded in border color. The single permitted shadow is focus: `rgba(0,0,0,0.1) 0 4px 12px`.
- HSL-with-alpha tokens for translucent layering (`rgba(62,207,142,0.3)` for branded borders).
- Every emission number ships with a `ConfidenceBar` or `±` range within 8px.
- Numbers are always `tabular-nums`. Numbers >1000 kg auto-switch to `tCO₂e`.
- Respect `prefers-reduced-motion`. Mode is dark-only; ignore `prefers-color-scheme`.

---

## 2. Color Palette & Roles

All tokens live in `app/globals.css` under `@theme inline` for Tailwind v4. **Never hard-code hex in components.**

### 2.1 Brand
| Token | Hex | Role |
|---|---|---|
| `--brand-green` | `#3ecf8e` | Logo, accent borders, focus highlights |
| `--brand-green-link` | `#00c573` | Interactive links, "this is Supabase-green" CTAs |
| `--brand-green-border` | `rgba(62,207,142,0.30)` | Elevated/branded borders (Level 3) |

### 2.2 Neutral scale (canvas + text)
| Token | Hex | Role |
|---|---|---|
| `--bg-canvas` | `#171717` | Page background |
| `--bg-surface` | `#171717` | Card surface (same as canvas; depth via border) |
| `--bg-button` | `#0f0f0f` | Primary button fill, deepest surface |
| `--bg-inset` | `#0f0f0f` | Inputs, code blocks |
| `--bg-translucent` | `rgba(41,41,41,0.84)` | Sticky nav, glass overlays |
| `--fg-primary` | `#fafafa` | Primary text, button text |
| `--fg-secondary` | `#b4b4b4` | Secondary text, secondary links |
| `--fg-muted` | `#898989` | Muted/tertiary text, link rest |
| `--fg-faint` | `#4d4d4d` | Heavy secondary, captions |
| `--fg-disabled` | `#434343` | Disabled |

### 2.3 Borders (the depth system)
| Token | Hex | Use |
|---|---|---|
| `--border-faint` | `#242424` | Horizontal rules, section dividers |
| `--border-default` | `#2e2e2e` | **Default card / tab borders** |
| `--border-strong` | `#363636` | Hover, focus surface |
| `--border-stronger` | `#393939` | Secondary borders, prominent |
| `--border-charcoal` | `#434343` | Tertiary, dark accents |

### 2.4 Confidence tiers (product-critical)
| Tier | Range | Token | Hex |
|---|---|---|---|
| High | ≥ 0.85 | `--confidence-high` | `#3ecf8e` |
| Medium | 0.60–0.85 | `--confidence-medium` | `#f7b955` |
| Low | < 0.60 | `--confidence-low` | `#e5484d` |
| Pending | no run | `--confidence-none` | `#898989` |

`ConfidenceBar` in `components/ui.tsx` is the sole canonical renderer.

### 2.5 Category palette (Radix accents)
| Category | Hex | Notes |
|---|---|---|
| Scope 1 — Fuel | `#e5484d` | Radix tomato 9 |
| Scope 2 — Electricity | `#3ecf8e` | Brand green |
| Scope 3 — Goods & services | `#9d72ff` | Radix violet 10 |
| Scope 3 — Travel | `#7c66dc` | Radix purple 10 |
| Scope 3 — Digital / SaaS | `#5fb9ff` | Radix indigo 10 |
| Scope 3 — Services | `#f7b955` | Radix yellow A7 |
| Scope 3 — Food & catering | `#f76b15` | Radix orange 9 |
| Uncategorised | `#898989` | Pure muted grey |

### 2.6 Semantic / status
| Token | Hex | Role |
|---|---|---|
| `--status-success` | `#3ecf8e` | Approved, transferred |
| `--status-warning` | `#f7b955` | Pending review |
| `--status-danger` | `#e5484d` | Rejected, low confidence |
| `--status-info` | `#5fb9ff` | Informational |

---

## 3. Typography Rules

### 3.1 Families
| Role | Family | Weights | Source |
|---|---|---|---|
| Display + Body | Inter | 400, 500 | `next/font/google` |
| Mono / labels | Source Code Pro | 400 | `next/font/google` |

### 3.2 Hierarchy
| Role | Font | Size | Weight | Line height | Tracking |
|---|---|---|---|---|---|
| Display Hero | Inter | 64–72px (clamp) | 400 | **1.00** | -0.02em |
| Display H1 | Inter | 36px | 400 | 1.10 | -0.015em |
| H2 / Section | Inter | 24px | 400 | 1.25 | -0.005em |
| Card Title | Inter | 24px | 400 | 1.33 | **-0.16px** |
| Sub-heading | Inter | 18px | 400 | 1.56 | 0 |
| Body | Inter | 16px | 400 | 1.50 | 0 |
| Body small | Inter | 14px | 400 | 1.43 | 0 |
| Nav / Button | Inter | 14px | **500** | 1.14 | 0 |
| Small | Inter | 12px | 400 | 1.33 | 0 |
| Code Label | Source Code Pro | 12px | 400 | 1.33 | **1.2px**, `uppercase` |
| Mono inline | Source Code Pro | 12–13px | 400 | 1.40 | 0 |

### 3.3 Principles
- **Weight 400 default.** Weight 500 only for buttons + nav. **Never 700.** Hierarchy is via size, not weight.
- **Hero `line-height: 1.00`** is the signature. Don't relax.
- Card titles: `letter-spacing: -0.16px`.
- Source Code Pro 12px uppercase 1.2px = "developer console" — section eyebrows, KPI labels, technical metadata.
- **Sentence case headlines.**
- `font-feature-settings: "calt", "tnum"` globally.
- All numbers `tabular-nums`. Always.
- Max line length 66ch for prose.
- Never justify.

---

## 4. Component Stylings

Every primitive lives in `components/ui.tsx`. Don't fork inline.

### 4.1 Buttons
| Variant | Fill | Text | Border | Shape |
|---|---|---|---|---|
| `primary` | `var(--bg-button)` | `var(--fg-primary)` | `1px solid var(--fg-primary)` | pill |
| `secondary` | `var(--bg-button)` | `var(--fg-primary)` | `1px solid var(--border-default)` | pill |
| `ghost` | transparent | `var(--fg-primary)` | transparent → `var(--border-default)` on hover | **6px** |
| `danger` | `var(--status-danger)` | `#fafafa` | none | pill |

- Padding: `sm` → `h-8 px-3 text-[13px]`; `md` → `h-10 px-8 text-sm`.
- Focus-visible: `outline: 2px solid var(--brand-green); outline-offset: 2px`.
- Hover: border lift (default → strong). **No scale.**
- Disabled: `opacity: 0.5`.

### 4.2 Cards
- Background: `var(--bg-canvas)` (same as page; depth via border).
- Border: `1px solid var(--border-default)`. Hover: `var(--border-strong)`.
- Radius: `12px` default; `16px` for feature/hero. Never larger.
- Internal padding: 16–24px.
- **No shadows.**

### 4.3 Stats
- Label: Source Code Pro 12px uppercase 1.2px `var(--fg-muted)`.
- Value: Inter 28px weight 400, `tabular-nums`, `line-height: 1.0`.
- Sub: Inter 14px weight 400 `var(--fg-secondary)`.
- Tones: default `--fg-primary`; positive `--brand-green`; warning `--status-warning`; danger `--status-danger`.
- **Every estimate stat must embed `ConfidenceBar` or `±` in `sub`.**

### 4.4 ConfidenceBar
- Track 6px tall, `var(--bg-inset)`.
- Fill: solid tier color (no glow, no gradient).
- Label row: Source Code Pro 12px uppercase "CONFIDENCE" left, `{n}%` right (`tabular-nums`, weight 500).
- 500ms ease-out width animation on mount.
- `role="progressbar"` + `aria-value*`.

### 4.5 Badges
- Pill, Inter 12px weight 500, `px-2.5 py-0.5`.
- Border-only chips (transparent fill, full-color border + text).

### 4.6 Navigation (sidebar)
- **Left rail**, sticky, 240px wide, full viewport height, `border-r: 1px solid var(--border-faint)`, background `var(--bg-canvas)`.
- **Brand row**: 56px, padding 16px, `border-b: 1px solid var(--border-faint)`. `Leaf` in `var(--brand-green)` + "Carbo" Inter 500 14px. Optional `code-label` meta on the right (e.g. version).
- **Search row**: full-width 36px button styled like an Input (§4.8): `var(--bg-inset)`, `1px solid var(--border-default)`, 6px radius, "Search" + ⌘K kbd in Source Code Pro 11px.
- **Groups**: each section opens with a `code-label` eyebrow (Source Code Pro 12px uppercase 1.2px, `var(--fg-muted)`). Items stack with 2px gap.
- **Link**: 32px tall, padding `0 10px`, 6px radius, `gap: 10px`, icon 15×15, label Inter 14px weight 500.
  - Rest: text `var(--fg-secondary)`, icon `var(--fg-muted)`, transparent.
  - Hover: bg `var(--bg-hover)`, text `var(--fg-primary)`, icon `var(--fg-secondary)`.
  - **Active** (`aria-current="page"`): bg `var(--bg-hover)`, text `var(--fg-primary)`, icon `var(--brand-green)`, **2px `var(--brand-green)` left edge flush to the sidebar border** (the only non-border accent on the rail).
  - Focus-visible: 2px `var(--brand-green)` outline, `outline-offset: -2px`.
- **Onboarding callout** (when present): same row dimensions but elevated to L3 — `var(--brand-green-soft)` fill, `var(--brand-green-border)`, text `var(--brand-green-link)`, `Sparkles` icon. Lives under a "Setup" eyebrow.
- **Org footer**: pinned to bottom, `border-t: 1px solid var(--border-faint)`, padding 16px. Org name Inter 14px `var(--fg-primary)`, sub-line `code-label` `var(--fg-muted)`.
- **Mobile (< 600px)**: sidebar hides; a fixed 56px top bar appears with brand + hamburger trigger. The hamburger opens the sidebar as a left-slide drawer (`min(280px, 85vw)`, 250ms `cubic-bezier(0.32, 0.72, 0, 1)`) over a `rgba(0,0,0,0.6)` backdrop. ESC and backdrop-click close it; route changes also close it; body scroll locks while open.

### 4.7 Tables
- Row 44px, no zebra. Hover row: bg `var(--bg-hover)` + 2px left edge `var(--brand-green)`.
- Numerics right, `tabular-nums`.
- Category dot 6px + label.
- Tx ids: Source Code Pro 12px `var(--fg-muted)`, truncate.

### 4.8 Inputs
- 40px, `rounded-[6px]`, `1px solid var(--border-default)`, Inter 14px 400, bg `var(--bg-inset)`.
- Focus: border `var(--brand-green)`, ring `var(--brand-green-border)`.

### 4.9 Charts
- Stroke `var(--brand-green)`. Area fill `var(--brand-green-soft)`.
- Grid `var(--border-faint)`, dasharray `3 3`.
- Axis labels Source Code Pro 11px uppercase `var(--fg-muted)`.
- Tooltip card with strong border + Source Code Pro values.
- 20% confidence band behind line on current-month CO₂e.

### 4.10 Close state machine
| State | Color | Icon | Copy |
|---|---|---|---|
| `INGEST` | `--fg-muted` | `Zap` | "Ingesting transactions…" |
| `CLASSIFY` | `--fg-secondary` | `Tags` | "Matching merchants…" |
| `ESTIMATE` | `--fg-secondary` | `Calculator` | "Estimating emissions…" |
| `CLUSTER` | `--status-warning` | `AlertCircle` | "We have 3 questions." |
| `READY` | `--brand-green` | `CheckCircle2` | "Ready to approve." |
| `APPROVED` | `--status-success` | `ShieldCheck` | "Reserve transferred." |

Sticky 6-dot rail at top. Active dot 1.5s opacity pulse; completed solid green; future hollow `var(--border-default)`.

---

## 5. Layout Principles

### 5.1 Spacing
- Base 4px. Scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128.
- **Section gap: 96px desktop / 48px mobile** between major sections.
- **Card gap: 24px**. Inner card 16–24px.

### 5.2 Page shell
- Two-column flex: **240px sidebar** (left) + **fluid content** (right), both children of `<body>`.
- Sidebar is sticky-positioned and contributes 240px to flex flow on desktop; on mobile it's `position: fixed` (out of flow) and a top bar pushes content down by 56px (`.layout-main` adds `padding-top`).
- Content column: `flex-1 min-w-0`, inner wrapper `max-w-[1200px] mx-auto`.
- Padding: `px-6 py-8` desktop, `px-4 py-6` mobile.
- Below 600px, mobile top bar: 56px fixed, `border-b: 1px solid var(--border-faint)`.

### 5.3 Dashboard
- KPI row: 4-col → 2-col → 1-col.
- Hero number ≥ 240px vertical room.
- Charts 8/12 cols; secondary 4/12.

### 5.4 Radius scale
| Token | Value | Use |
|---|---|---|
| `--r-sm` | 6px | Ghost buttons, inputs |
| `--r-md` | 12px | Default cards |
| `--r-lg` | 16px | Hero / feature cards |
| `--r-pill` | 9999px | Primary buttons, tabs |

### 5.5 White space
A hero figure has ≥ 240px vertical breathing room. If you can't find the confidence indicator within 400ms of landing, redesign.

---

## 6. Depth & Elevation

| Level | Treatment | Use |
|---|---|---|
| L0 | no border | Page background |
| L1 | `1px solid var(--border-default)` | Default cards |
| L2 | `1px solid var(--border-strong)` | Hover, focus surface |
| L3 | `1px solid var(--brand-green-border)` | Active/highlighted |
| Focus | `0 4px 12px rgba(0,0,0,0.10)` + green outline | Keyboard focus |

**No blurred drop shadows. Ever.**

---

## 7. Do's and Don'ts

### Do
- Pair every CO₂e number with confidence.
- Use `var(--bg-canvas)` everywhere; depth via border.
- Use brand green sparingly — borders, links, accents only.
- Keep weight 400 default; 500 only for buttons + nav.
- Hero `line-height: 1.00`. Card titles `letter-spacing: -0.16px`.
- Source Code Pro uppercase 1.2px for KPI labels and section eyebrows.
- Pills (9999px) for primary, 6px for ghost/inputs, 12–16px for cards.
- `tabular-nums` on every number.
- Sentence case headlines.
- Respect `prefers-reduced-motion`.

### Don't
- Don't add box-shadows (focus only).
- Don't use bold (700) anywhere.
- Don't paint large surfaces green.
- Don't widen past `max-w-[1200px]`.
- Don't mix radii.
- Don't relax `tabular-nums`.
- Don't put white text on green; brand-green is for borders/links, not fills.
- Don't use serif.
- Don't show a CO₂e number without confidence.

---

## 8. Responsive Behavior

Single breakpoint at **600px**.

| Width | Layout |
|---|---|
| < 600px | Single column, stacked, condensed nav, full-width buttons |
| ≥ 600px | Multi-column grids, full nav, expanded |

Section gaps collapse 96px → 48px below 600px.

---

## 9. Voice & Content

### 9.1 Principles
1. Plain English. No jargon.
2. Show the range — "128 ± 12 kg CO₂e".
3. Second-person, active.
4. Numbers before adjectives.
5. Never apologise for the tool.
6. Verb-first CTAs.
7. Celebrate sparingly.

### 9.2 Phrase library
| Use | Preferred | Avoid |
|---|---|---|
| Close CTA | "Run carbon close" | "Generate emissions report" |
| Awaiting review | "3 questions for you" | "User input required" |
| Approve transfer | "Approve & transfer €412" | "Submit" |
| Confidence low | "We're 52% sure" | "Low confidence" |

### 9.3 Lexicon
- **Close** — monthly state-machine run.
- **Reserve** — bunq sub-account.
- **Cluster** — group of uncertain transactions.
- **Credit** — EU-registered carbon credit.
- **Confidence** — 0–1, integer percent.
- **Ledger** — append-only audit log.

### 9.4 Numbers
- Currency: `fmtEur()` — `€ 4.320` (en-NL).
- CO₂e: `fmtKg()` — `128.3 kgCO₂e` < 1000, `1.42 tCO₂e` above.
- Percent: `fmtPct()` integer.
- Dates: `YYYY-MM` for months, `24 Apr 2026` for full dates.

---

## 10. Motion

- Tokens: `duration-150` (hover/press), `duration-300` (panels), `duration-500` (bar fills, count-ups).
- Easing: `ease-out` enter, `ease-in` exit.
- **No scale on hover.** Border + opacity shifts only.
- Numbers count up on first paint of close result (500ms ease-out, `requestAnimationFrame`).
- No bounce, overshoot, parallax.
- Reduced motion: opacity-only.

---

## 11. Accessibility

- WCAG 2.2 AA minimum.
- `#fafafa` on `#171717` = 14.4:1 (AAA). `#3ecf8e` on `#171717` = 8.2:1 (AAA).
- Focus ring always visible.
- Charts: visually-hidden `<table>` fallback.
- `ConfidenceBar` `role="progressbar"`.
- Color is never sole signal.
- Keyboard-complete close flow.
- Honor `prefers-reduced-motion`.

---

## 12. Asset inventory

| Where | What |
|---|---|
| `app/layout.tsx` | Inter (400, 500) + Source Code Pro (400) via `next/font/google`; expose `--font-inter`, `--font-source-code-pro`. |
| `app/globals.css` | All §2 tokens under `@theme inline`. Global `font-feature-settings: "calt", "tnum"`. |
| `components/ui.tsx` | Card, Stat, Button, Badge, ConfidenceBar, CodeLabel, Eyebrow. |
| `components/Sidebar.tsx` + `components/SidebarNav.tsx` | §4.6 (server data fetch + client rail/drawer). |
| `components/TrendChart.tsx` | §4.9. |

---

## 13. Agent Prompt Guide

### 13.1 Quick reference
- Background: `#171717`.
- Text: `#fafafa` / `#b4b4b4` / `#898989`.
- Brand green: `#3ecf8e` borders/links only — never large fills.
- Borders: `#242424` / `#2e2e2e` / `#363636`.
- Inter 400 default, 500 only for nav + buttons. Never 700.
- Source Code Pro 12px uppercase 1.2px for KPI labels and section eyebrows.
- Hero: `line-height: 1.00`. Cards: `letter-spacing: -0.16px`.
- Pill (9999px) for primary, 6px ghost/inputs, 12–16px cards.
- Every CO₂e → `ConfidenceBar`.

### 13.2 PR checklist
- [ ] All colors via tokens.
- [ ] No drop shadows added.
- [ ] No 700 weight added.
- [ ] `tabular-nums` on every number.
- [ ] Every CO₂e number ships with confidence.
- [ ] Focus-visible ring on every interactive.
- [ ] `prefers-reduced-motion` respected.
- [ ] Sentence case headlines.
- [ ] 44px min touch.
- [ ] Tested at 375 / 768 / 1280.
- [ ] No `font-serif` references.

---

## 14. Inspirations

- **Supabase** (supabase.com) — dark-mode-native palette, border-as-depth, weight-restraint, Source Code Pro labels, pill+6px radius hierarchy.
- **Stitch DESIGN.md format** — 9-section template.

This is an **inspired-by** doc, not an official Supabase asset.
