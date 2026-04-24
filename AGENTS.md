<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Design is specified

`DESIGN.md` at repo root is the **single source of truth** for how Carbon Autopilot looks, feels, and speaks. Read it before touching anything visual (components, pages, Tailwind tokens, CSS, copy, motion, a11y). It inherits Wise's friendly-fintech primitives and bunq's Easy Green palette + Montserrat/Inter/Fragment Mono typography.

Hard rules agents must honor on every UI change:
- Use design tokens from `DESIGN.md` §2 — never hard-code hex or raw Tailwind color names like `emerald-600`/`zinc-*` in components.
- Every CO₂e number pairs with a confidence indicator (bar or ± range). See `ConfidenceBar` in `components/ui.tsx`.
- Sentence-case headlines, `tabular-nums` on every number, pill CTAs, ring-shadows only (no blurred drop shadows), and dark + light parity.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.

If `DESIGN.md` and code disagree, fix the code. If you learned something the doc doesn't cover, update `DESIGN.md` in the same PR.
