# 11 — Impact matrix

## Problem
The spec calls for a 2×2 "Price × Environmental" matrix per category to help users see which sub-choices matter (train vs flight, plant vs beef, EU region vs coal-grid region). Without this, the product looks like just a calculator and loses its behavioral-change edge.

## Key facts
- **Spread within a category is often larger than between categories.** Food: plant-based lunch ~0.18 kg/EUR vs beef-heavy catering ~0.55 kg/EUR — a 3× spread. Travel: train ~0.04 kg/EUR vs short-haul flight ~0.65 kg/EUR — a 16× spread. The matrix surfaces this.
- Treat it as a **nudge, not a ranking**: qualitative labels in each quadrant, quantitative detail on hover/click. Ranking tables invite gaming.
- Four anchors we use (from our factor table):
  - **Travel**: train (low, €0.04) vs flight short-haul (high, €0.65) — ~16× delta.
  - **Food**: plant-based (low, €0.18) vs beef catering (high, €0.55) — ~3× delta.
  - **Cloud**: EU region (low, €0.08) vs coal-grid region (high, €0.25) — ~3× delta.
  - **Procurement**: office supplies (low, €0.20) vs electronics (high, €0.50) — ~2.5× delta. Weaker differentiation; lean on upgrade-avoidance rather than price.
- **Evidence base**: Poore & Nemecek 2018 (food); IEA aviation vs rail comparison; AWS regional carbon intensity reports; Lancaster University 2021 cloud carbon study.

## UX pattern
Table with three columns: Category | Low-impact example | High-impact example.
- No numbers in the matrix itself (reduces arguing).
- Colour-coded badges: green (low) vs amber (high).
- Footnote links each claim to a research doc / factor ID.
- Progressive disclosure: click a row to expand to actual monthly spend distribution across that spectrum.

## What it is NOT
- Not a leaderboard of employees/suppliers.
- Not a blocker — the user can spend however they want; the matrix informs, not gates.

## Decisions for this build
- Static 4-row matrix hard-coded in `app/categories/page.tsx` (Travel, Food, Cloud, Procurement).
- Sub-category details come from the factor table; hover in v2.
- Always pairs a sub-category with a factor ID so claims are traceable.
- Explicit footnote about intra-category spread being larger than between-category — reframes the whole dashboard.
