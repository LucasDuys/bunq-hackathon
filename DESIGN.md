# DESIGN.md -- Carbo Reserve UI

Visual design system, component specs, animation language, and data visualization for the Carbo Reserve dashboard. Intended as the single reference for Track C (dashboard + demo polish) during the 24-hour build.

Stack: Next.js 14 App Router, Tailwind, shadcn/ui, Framer Motion, Recharts (stacked area + treemap), D3 (scatter plot). All animation via Framer Motion unless noted.

---

## Color System

### Base palette (warm, not white)

The background is warm cream/beige, never pure white. This separates us visually from every fintech that ships `#ffffff` backgrounds.

| Token | Hex | Usage |
|---|---|---|
| `--bg-base` | `#FAF6F1` | Page background, default surface |
| `--bg-card` | `#FFFFFF` | Card surfaces (the slight contrast against cream makes them float) |
| `--bg-card-hover` | `#FDF9F4` | Card hover state |
| `--bg-elevated` | `#F5F0EA` | Top bar, sidebar, section headers |
| `--bg-input` | `#F7F3EE` | Input fields, search bars |
| `--border-default` | `#E8E2DA` | Card borders, dividers |
| `--border-subtle` | `#F0EBE4` | Inner dividers, separators within cards |
| `--text-primary` | `#1A1A1A` | Headings, bold numbers, primary content |
| `--text-secondary` | `#6B6560` | Labels, descriptions, secondary info |
| `--text-tertiary` | `#9C9590` | Timestamps, metadata, hints |

### Accent palette (bunq-derived, carbon-graded)

The accent system is a gradient from bunq green (good / low carbon) through amber (moderate) to a muted red (high carbon). This gradient is the primary visual language for the cost-vs-environment tension.

| Token | Hex | Usage |
|---|---|---|
| `--green-500` | `#30C06F` | bunq primary green. Reserve balance, low-carbon indicators, success states |
| `--green-400` | `#5DD48D` | Lighter green for backgrounds, chart fills |
| `--green-300` | `#A8E6C3` | Subtle green tints, area chart lowest layer |
| `--green-100` | `#E5F7ED` | Green badge backgrounds |
| `--amber-500` | `#E5A830` | Moderate carbon intensity, warning states |
| `--amber-400` | `#F0C060` | Amber chart fills |
| `--amber-100` | `#FEF5E0` | Amber badge backgrounds |
| `--red-500` | `#D94F4F` | High carbon intensity, over-budget, block states |
| `--red-400` | `#E87878` | Red chart fills |
| `--red-100` | `#FEECEC` | Red badge backgrounds |

### Carbon intensity gradient (continuous)

For elements that need a smooth gradient (card left-border, scatter plot dots, treemap cells):

```
low carbon -----> moderate -----> high carbon
#30C06F    -----> #E5A830  -----> #D94F4F
```

Applied via a utility function: `intensityColor(kgCO2e: number, category: string): string` that maps the carbon intensity per EUR to a position on this gradient. The thresholds are category-aware (beef at 5 kg/EUR is expected; software at 5 kg/EUR is extreme).

---

## Typography

Geometric sans-serif to match bunq's visual language. Use **Plus Jakarta Sans** (Google Fonts, open source, closest to bunq's Cera Pro without licensing issues).

| Role | Weight | Size | Tracking | Usage |
|---|---|---|---|---|
| `--type-display` | 700 | 48px / 3rem | -0.02em | Hero numbers (total kg CO2e, reserve balance) |
| `--type-h1` | 700 | 32px / 2rem | -0.01em | Page titles |
| `--type-h2` | 600 | 24px / 1.5rem | -0.01em | Section headers |
| `--type-h3` | 600 | 18px / 1.125rem | 0 | Card titles, chart titles |
| `--type-body` | 400 | 15px / 0.9375rem | 0 | Body text, descriptions |
| `--type-label` | 500 | 13px / 0.8125rem | 0.01em | Labels, badges, metadata |
| `--type-mono` | 500 (JetBrains Mono) | 13px | 0 | Transaction IDs, hashes, code |

### Number rendering

Large stat numbers use tabular figures (`font-variant-numeric: tabular-nums`) so digits don't jump during animation. The real-time counter and reserve balance use this.

---

## Spacing and Grid

8px base unit. All spacing is multiples of 8.

| Token | Value | Usage |
|---|---|---|
| `--space-1` | 4px | Inline icon gaps |
| `--space-2` | 8px | Tight padding (badges, chips) |
| `--space-3` | 12px | Inner card padding between elements |
| `--space-4` | 16px | Card padding, gap between stacked elements |
| `--space-5` | 24px | Section gaps |
| `--space-6` | 32px | Card padding (outer), gap between cards |
| `--space-8` | 48px | Major section dividers |

Grid: 12-column on desktop (1280px+), single column on mobile. Card grid uses `auto-fill, minmax(380px, 1fr)` so cards are spacious (3-4 visible at typical viewport).

Border radius: `12px` for cards, `8px` for buttons and inputs, `6px` for badges and chips, `50%` for avatars and status dots.

---

## Shadows and Elevation

Soft, warm shadows (not blue-gray). Achieved by tinting the shadow color toward the beige base.

| Level | CSS | Usage |
|---|---|---|
| `--shadow-card` | `0 1px 3px rgba(120, 100, 80, 0.06), 0 1px 2px rgba(120, 100, 80, 0.04)` | Default card |
| `--shadow-card-hover` | `0 4px 12px rgba(120, 100, 80, 0.08), 0 2px 4px rgba(120, 100, 80, 0.04)` | Card hover / focus |
| `--shadow-elevated` | `0 8px 24px rgba(120, 100, 80, 0.10), 0 4px 8px rgba(120, 100, 80, 0.06)` | Modals, expanded panels |
| `--shadow-top-bar` | `0 1px 0 rgba(120, 100, 80, 0.08)` | Persistent top bar bottom edge |

---

## Page Structure

```
+------------------------------------------------------------------+
|  TOP BAR (persistent, expandable)                                 |
|  Carbo Reserve: EUR 13.80  |  184 kg CO2e this month  |  [...]  |
+------------------------------------------------------------------+
|                                                                    |
|  MAIN CONTENT (scrollable)                                        |
|                                                                    |
|  [Stacked Area Chart -- footprint over time, full width]          |
|                                                                    |
|  [Stats Row -- 3-4 large number cards in a row]                   |
|                                                                    |
|  [Two-column: Treemap (left 60%) | Scatter Plot (right 40%)]     |
|                                                                    |
|  [Transaction Cards -- spacious, 1-2 per row]                     |
|  [Transaction Cards]                                              |
|  [Transaction Cards]                                              |
|                                                                    |
+------------------------------------------------------------------+
```

Navigation is minimal: the main dashboard is the primary view. Secondary views (CSRD export, settings, transaction detail) are accessed via morph transitions from cards or top-bar expansion, not a sidebar nav.

---

## Component Specs

### 1. Persistent Top Bar

Sticky at the top. Warm elevated background (`--bg-elevated`). Contains:

- **Carbo Reserve balance**: large bold number (`--type-h2`, `--green-500`), preceded by a small filled circle pulsing gently (Framer Motion `scale` oscillation, 0.9 -> 1.1, 3s loop, subtle). Label "Carbo Reserve" in `--text-secondary` above.
- **Monthly footprint**: large bold number, colored by intensity gradient.
- **Real-time saved counter**: animated number that ticks up smoothly when a new offset is confirmed. Use Framer Motion `useMotionValue` + `useTransform` + `animate` for a slot-machine style digit roll. Tabular figures prevent layout shift.
- **Expand chevron**: clicking expands the top bar downward (Framer Motion `layout` + `AnimatePresence`) to reveal:
  - Monthly budget progress bar (horizontal, green fill, amber when >80%, red when >100%)
  - Breakdown: reserved / purchased / retired with badge colors
  - "View CSRD Export" link
  - Collapse on click or scroll-down

```
+------------------------------------------------------------------+
|  [*] Carbo Reserve        184.2 kg CO2e        12.4 kg saved    |
|      EUR 13.80             this month            this month   [v] |
+------------------------------------------------------------------+
   ^                                                            ^
   pulse dot                                             expand chevron
```

Expanded state:

```
+------------------------------------------------------------------+
|  [*] Carbo Reserve        184.2 kg CO2e        12.4 kg saved    |
|      EUR 13.80             this month            this month   [^] |
|  ---------------------------------------------------------------- |
|  Budget: ████████████░░░░░░░░  73% of 250 kg cap                 |
|  Reserved: EUR 10.20  |  Purchased: EUR 3.60  |  Retired: 0.04t  |
|  [View CSRD Export ->]                                            |
+------------------------------------------------------------------+
```

### 2. Transaction Cards

Spacious. One or two per row depending on viewport. Each card has:

- **Left accent border**: 3px, colored by the carbon intensity gradient for that transaction.
- **Top row**: merchant name (bold, `--type-h3`), amount in EUR (bold, right-aligned), timestamp (`--text-tertiary`).
- **Middle row**: category badge (e.g. "Food" with a subtle green/amber/red background), aggregate kg CO2e (bold number), confidence indicator (subtle, e.g. "~93%").
- **Bottom row**: agent action summary in one line ("Reserved EUR 1.06 into Carbo Reserve" or "Skipped -- below threshold" or "Awaiting approval"), status badge.
- **Right edge**: small receipt thumbnail (40x56px, rounded corners, subtle shadow) if a receipt was uploaded, otherwise a dashed placeholder with a camera icon.
- **Hover**: card lifts (`--shadow-card-hover`), background shifts to `--bg-card-hover`. Cursor pointer.
- **Click**: morph transition into the detail view (see Transitions section).

```
+--------------------------------------------------------------+
|  | Albert Heijn                              EUR 42.80       |
|  | 24 Apr 2026, 18:05                                        |
|  |                                                    [img]  |
|  | [Food]   14.2 kg CO2e  ~93%                               |
|  |                                                           |
|  | Reserved EUR 1.06 into Carbo Reserve        [Approved]   |
+--------------------------------------------------------------+
  ^ green left border (low-mid intensity)
```

### 3. Transaction Detail View (morph target)

When a card is clicked, it morphs (Framer Motion `layoutId`) into a full detail view that takes over the main content area. The card's position and size animate smoothly into the detail layout.

Detail view contains:

- **Header**: merchant, amount, date (carried from card, same layout positions so the morph is seamless).
- **Receipt panel**: full receipt image (if uploaded) with extracted line items overlaid as highlights. Each line item shows: name, qty, unit price, kg CO2e, intensity color dot.
- **Carbon breakdown**: horizontal stacked bar showing each item's contribution to total kg CO2e. Largest item highlighted.
- **Agent reasoning**: the 80-word reasoning summary in a subtle callout box (`--bg-elevated` background, left border `--green-500`).
- **DAG step visualization**: vertical steps (see Animation section).
- **Policy rule**: which YAML rule fired, displayed as a styled code block.
- **Action buttons**: "Approve" (green) / "Reject" (muted) for pending drafts, or status display for completed actions.
- **Back**: click outside or top-left back arrow morphs back to the card in the list.

### 4. Stats Row

3-4 stat cards in a horizontal row, each showing one large number:

| Card | Number | Label | Color |
|---|---|---|---|
| Total footprint | `184.2` | kg CO2e this month | intensity gradient |
| Transactions processed | `47` | transactions | `--text-primary` |
| Average intensity | `3.9` | kg CO2e per transaction | intensity gradient |
| Top category | `Beef` | 73% of total footprint | `--red-500` |

Numbers are `--type-display` (48px, bold). Labels are `--type-label` below. Cards are `--bg-card` with `--shadow-card`. On load, numbers count up from 0 with a spring animation (Framer Motion `useSpring`, `stiffness: 50`, `damping: 20`).

---

## Data Visualizations

### Stacked Area Chart (footprint over time)

Full-width, ~240px tall. Shows daily kg CO2e stacked by category over the current month.

- **Layers** (bottom to top): food (green-300), travel (amber-400), procurement (a warm blue `#6B9BD2`), office (a warm purple `#9B8EC4`), other (border-default as fill).
- **X-axis**: dates, `--type-label`, `--text-tertiary`. Show every 3rd date to avoid clutter.
- **Y-axis**: kg CO2e, `--type-label`, `--text-tertiary`. Left-aligned.
- **Hover**: vertical crosshair line, tooltip showing breakdown per category for that day. Tooltip has `--bg-card` background, `--shadow-elevated`.
- **Animation on load**: layers grow upward from the baseline with a staggered spring (each layer starts 80ms after the previous). Use Recharts `<Area isAnimationActive animationBegin={index * 80} animationDuration={800} animationEasing="ease-out" />`.
- **Curve**: `monotoneX` for smooth natural curves.
- **Grid lines**: horizontal only, `--border-subtle`, dashed.

### Treemap (category breakdown)

Left column of the two-column section, ~60% width. Shows proportional kg CO2e by category.

- **Cell colors**: each category gets its own color from the palette (food = green-400, travel = amber-400, procurement = blue, office = purple, software = a warm teal `#5BA8A0`).
- **Cell content**: category name (`--type-label`, white or dark depending on contrast), kg CO2e number (`--type-h3`, bold), percentage of total.
- **Animation on load**: cells scale up from 0 with a staggered spring. Each cell starts from its center point.
- **Hover**: cell lifts slightly (2px translate), border appears, tooltip with full breakdown.
- **Library**: Recharts `<Treemap>` with custom content renderer for the cell styling.

### Guided Scatter Plot (alternative matrix)

Right column, ~40% width. Shows products/purchases plotted on cost (x) vs environmental impact (y), with subtle quadrant guidelines.

- **Quadrant lines**: dashed, `--border-subtle`, at the median values. Labels in each corner in `--text-tertiary`:
  - Top-left: "High impact, low cost"
  - Top-right: "High impact, high cost"
  - Bottom-left: "Low impact, low cost" (the target quadrant, subtle green background tint)
  - Bottom-right: "Low impact, high cost"
- **Dots**: sized by transaction amount (min 8px, max 24px radius). Colored by intensity gradient. On hover, expand with a spring and show a tooltip (item name, EUR, kg CO2e).
- **Slight organization**: within each quadrant, dots are arranged in a force-directed micro-layout (D3 `forceSimulation` with very weak forces) so they don't overlap but also don't form a rigid grid. This gives the "organized but organic" feel.
- **Animation on load**: dots fly in from the edges to their positions with spring physics (D3 force simulation runs for ~60 frames).
- **Current purchase highlight**: the most recent transaction's dots have a pulsing ring around them.

### Real-Time Saved Counter

In the top bar. A number that represents total kg CO2e offset this month.

- **Implementation**: `useMotionValue` initialized to the current total. When a new offset event arrives (via Supabase realtime subscription or webhook SSE), `animate(motionValue, newTotal, { duration: 1.2, ease: "easeOut" })`. Display via `useTransform` that formats to 1 decimal place.
- **Visual**: the number briefly flashes `--green-500` when it increments, then fades back to `--text-primary` over 600ms.
- **Digit roll effect**: wrap each digit in an overflow-hidden container. On change, the old digit slides up and out while the new digit slides up from below. Framer Motion `AnimatePresence` + `exit={{ y: -20, opacity: 0 }}` / `initial={{ y: 20, opacity: 0 }}`.

---

## Animation Language

All durations and easings are consistent across the app. Define as Tailwind theme extensions or CSS custom properties.

### Timing

| Token | Duration | Easing | Usage |
|---|---|---|---|
| `--motion-fast` | 150ms | `ease-out` | Hover states, badge color changes |
| `--motion-normal` | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Card hover lift, tooltip appear |
| `--motion-slow` | 500ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Morph transitions, panel expand |
| `--motion-spring` | -- | `{ stiffness: 300, damping: 30 }` | Number count-up, chart load, dot settle |
| `--motion-gentle` | -- | `{ stiffness: 100, damping: 20 }` | Top bar expand, slow reveals |

### Morph Transition (card -> detail)

The signature transition. When a user clicks a transaction card:

1. Card's `layoutId` matches the detail view's container `layoutId`.
2. Framer Motion automatically interpolates position, size, and border-radius.
3. Card content fades out over the first 40% of the transition; detail content fades in over the last 60%.
4. Background dims to `rgba(26, 26, 26, 0.3)` behind the expanding card.
5. Duration: `--motion-slow` (500ms).
6. Reverse on close: detail morphs back down to the card position in the list.

```tsx
// Transaction card
<motion.div layoutId={`tx-${tx.id}`} onClick={() => setSelected(tx.id)}>
  {/* card content */}
</motion.div>

// Detail view (rendered when selected)
<AnimatePresence>
  {selected && (
    <motion.div layoutId={`tx-${selected}`} className="detail-view">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        {/* detail content */}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

### Ripple Effect (new transaction)

When a webhook delivers a new transaction:

1. A notification toast appears top-right with a subtle slide-in from the right.
2. The new transaction card appears at the top of the list.
3. A circular ripple emanates from the notification bell icon toward the new card. The ripple is a `--green-500` ring at 10% opacity that expands from 0 to ~200px radius over 600ms, fading out.
4. The new card has a brief `--green-100` background that fades to `--bg-card` over 1.5s.
5. The real-time counter in the top bar increments with the digit roll animation.

```tsx
// Ripple: positioned absolutely from the bell icon
<motion.div
  className="rounded-full border-2 border-green-500/20"
  initial={{ scale: 0, opacity: 0.4 }}
  animate={{ scale: 8, opacity: 0 }}
  transition={{ duration: 0.6, ease: "easeOut" }}
/>
```

### DAG Step Visualization (vertical, sequential light-up)

Shown in the transaction detail view. A vertical stepper showing the agent's processing pipeline.

Steps (top to bottom):
1. Received
2. Normalized
3. Context requested
4. Receipt extracted
5. Carbon estimated
6. Policy evaluated
7. Action executed
8. Ledger recorded

Each step is a row:
```
[circle]  Step name                    [duration badge]
   |
   |      One-line result summary
   |
[circle]  Next step ...
```

- **Idle state**: circle is `--border-default`, line is `--border-subtle`, text is `--text-tertiary`.
- **Active state** (currently processing): circle pulses `--green-500`, line below is dashed and animating (dash-offset animation), text is `--text-primary`.
- **Complete state**: circle is filled `--green-500` with a checkmark, line is solid `--green-400`, text is `--text-primary`, duration badge appears (e.g. "230ms").
- **Sequential light-up**: when viewing a completed transaction, the steps animate from top to bottom with a 200ms stagger. Each circle fills, line draws downward (SVG stroke-dashoffset animation), and the summary text fades in. Total sequence: ~1.6s for all 8 steps.
- **Live mode**: during real-time processing, steps light up as the agent completes them. The current step has the pulsing circle. This is driven by SSE events from the backend.

### Chart Load Animations

All charts animate on first render (intersection observer, not page load):

- **Stacked area**: layers grow upward from baseline, staggered 80ms per layer.
- **Treemap**: cells scale from center, staggered 40ms per cell, ordered largest-first.
- **Scatter plot**: dots fly in from edges, D3 force simulation settles over ~1s.
- **Stat numbers**: count up from 0 with spring physics, staggered 100ms per card.
- **Progress bars**: width grows from 0 with `--motion-slow`.

---

## Key UI States

### Empty state (no transactions yet)

Centered on the main content area. A single illustration-style line drawing of a leaf growing from a receipt (keep it simple, can be an SVG). Below: "Waiting for your first transaction" in `--text-secondary`, a subtle pulse animation on the leaf.

### Loading state

Skeleton screens matching the exact card and chart layouts. Skeleton color: `--bg-elevated` with a shimmer animation (left-to-right gradient sweep, 1.5s loop). No spinners anywhere.

### Error state

Inline error messages, never modals. Red-tinted callout box with `--red-100` background, `--red-500` left border, `--text-primary` message, `--text-secondary` suggestion.

### Approval pending

Transaction card gets a left border of `--amber-500` instead of the intensity gradient. A subtle horizontal stripe pattern (CSS repeating-linear-gradient, very faint) in the card background. Action row shows "Approve" and "Reject" buttons. "Approve" is `--green-500` fill, "Reject" is outline only with `--text-secondary`.

---

## Agent Message Styling

When the agent communicates (reasoning summary, context request, approval request), it uses a distinct callout block:

- Background: `--bg-elevated`
- Left border: 3px `--green-500`
- Text: `--text-primary`, `--type-body`
- Tone: terse, bunq-style. No filler. Example: "14.2 kg CO2e. Beef is 73%. Policy offsets food above 10 kg. Reserving EUR 1.06."
- No chat bubbles, no avatar, no "AI" badge. The agent is the system, not a character.

---

## CSRD Export View

Accessed from the expanded top bar or a dedicated route. Table-based, not a report layout.

- Full-width table with horizontal scroll on narrow viewports.
- Columns match the spec in `ARCHITECTURE.md` (reporting_period, entity_id, scope, category, ..., methodology_narrative).
- Row hover highlights in `--bg-card-hover`.
- "Export CSV" button top-right, `--green-500` fill.
- Methodology narrative column is truncated with ellipsis; hover shows full text in a tooltip.
- Each row has a small link icon that morphs to the underlying transaction detail.

---

## Tailwind Config Sketch

```js
// tailwind.config.ts (relevant extensions only)
{
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FAF6F1',
          100: '#F5F0EA',
          200: '#F0EBE4',
          300: '#E8E2DA',
        },
        carbon: {
          green: '#30C06F',
          'green-light': '#5DD48D',
          'green-subtle': '#A8E6C3',
          'green-bg': '#E5F7ED',
          amber: '#E5A830',
          'amber-light': '#F0C060',
          'amber-bg': '#FEF5E0',
          red: '#D94F4F',
          'red-light': '#E87878',
          'red-bg': '#FEECEC',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        button: '8px',
        badge: '6px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(120,100,80,0.06), 0 1px 2px rgba(120,100,80,0.04)',
        'card-hover': '0 4px 12px rgba(120,100,80,0.08), 0 2px 4px rgba(120,100,80,0.04)',
        elevated: '0 8px 24px rgba(120,100,80,0.10), 0 4px 8px rgba(120,100,80,0.06)',
      },
    },
  },
}
```

---

## Libraries

| Library | Purpose | Why this one |
|---|---|---|
| `framer-motion` | All layout animations, morph transitions, ripple, number rolls, `AnimatePresence` | Best React animation library for layout animations. `layoutId` is the only clean way to do card-to-detail morph. |
| `recharts` | Stacked area chart, treemap | Lightweight, React-native, good animation support, works with SSR. |
| `d3` (d3-force, d3-scale, d3-color only) | Scatter plot force layout, intensity color interpolation | Minimal D3 import for the two things Recharts can't do well: force-directed layout and custom color scales. |
| `plus-jakarta-sans` (Google Fonts) | Primary typeface | Free, geometric, closest match to bunq's Cera Pro. |
| `tailwind-merge` + `clsx` | Class management | Already in shadcn/ui. |

Do not add: chart.js (redundant with recharts), three.js (overkill), lottie (we can do everything in framer-motion), GSAP (license complexity).

---

## Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| `< 640px` (mobile) | Single column. Top bar collapses to just the reserve balance. Charts stack vertically. Transaction cards full-width. |
| `640-1024px` (tablet) | Two-column grid for charts. Transaction cards full-width. |
| `> 1024px` (desktop) | Full layout as diagrammed. Treemap + scatter side by side. Transaction cards 1-2 per row. |

For the hackathon demo, optimize for a single large screen (projector / external monitor, ~1440px). Mobile polish is post-hackathon.

---

## Demo-Specific Notes

- The DAG step visualization should be the centerpiece of the live demo. When a transaction comes in on stage, the audience watches the steps light up in sequence. Make sure the timing is visible at projector distance -- steps should take at least 200ms each even if the actual processing is faster. Add artificial minimum display time per step.
- The morph transition from card to detail is the second "wow" moment. Rehearse it at projector resolution.
- The real-time counter ticking up after an approval is the third. Time it so the audience sees: approve button pressed -> counter increments -> ripple -> done.
- Keep the beige warm enough that it doesn't wash out on a projector. Test `#FAF6F1` on the venue projector early; if it looks white, shift to `#F5EDE3`.

---

_Last updated: 2026-04-24. Living document -- update during the build as components land._
