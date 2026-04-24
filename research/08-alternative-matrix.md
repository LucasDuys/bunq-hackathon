# 08 -- Alternative Matrix (Lower-Carbon Recommendation)

_Status: stub. Optional polish feature, only if time._

## What it is

For every purchase, the agent can render a 2x2 matrix of alternatives:

|  | Low cost | High cost |
|---|---|---|
| **Low environmental impact** | oat milk supermarket brand | oat milk organic local |
| **High environmental impact** | dairy milk supermarket | dairy milk organic farm |

User sees their current choice highlighted, and can see how much CO2e + EUR each cell would be.

## How it works

1. After line-item extraction, for each item look up same-category alternatives in a small hand-curated database.
2. For each alternative, fetch its emission factor + retail price.
3. Render the 2x2. Highlight the user's current choice.
4. Offer "suggest lower-carbon next time" toggle. If on, the agent sends a push notification before the next same-category trip.

## Data needed

- Product category taxonomy (food.dairy.milk, food.meat.beef, travel.intercity.rail, ...).
- Per-category cost distribution (2-3 price points).
- Per-category emission factor distribution (2-3 points).

## Scope cut for hackathon

Hand-curate three categories: dairy, beef, short-haul travel. Three is enough for the demo beat.

## Output shape

See `RESEARCH-INDEX.md` -> Research agent output format.
