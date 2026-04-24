# 01 -- Carbon Accounting Primer

_Status: stub. Fill on Day 0 or as needed by a team member new to the domain._

## What to answer

- What is kg CO2e and why do we use it instead of raw CO2?
- Scope 1 vs Scope 2 vs Scope 3 emissions, and where does a typical bunq transaction land?
- Activity data vs emission factor vs gross emissions -- which one does Carbon Reserve compute, store, and expose?
- What is "removal" vs "avoidance" and why do we prefer removal credits in the policy defaults?
- What is "uncertainty" in GHG accounting and how is it usually reported?

## Sources to check

- GHG Protocol Corporate Standard (free PDF): <https://ghgprotocol.org/corporate-standard>
- GHG Protocol Scope 3 Standard: <https://ghgprotocol.org/standards/scope-3-standard>
- EFRAG ESRS E1 (binding under CSRD): <https://www.efrag.org/lab6>
- Oxford Principles for Net Zero Aligned Carbon Offsetting (2024 revision): <https://www.smithschool.ox.ac.uk/publications/oxford-principles-net-zero-aligned-carbon-offsetting-revised-2024>

## Output shape

See `RESEARCH-INDEX.md` -> Research agent output format.

## One-paragraph preliminary view

For a bunq transaction loop, almost all emissions are Scope 3 (purchased goods + services, employee travel, fuel-and-energy-related activities for expensed utilities). We compute **gross emissions** per transaction from (activity data) x (emission factor), track a policy-driven **offset** amount, and expose **net emissions** and the offsetting narrative for CSRD E1-7. We prefer **removal** credits (biochar, peatland restoration, reforestation) over **avoidance** credits because the 2024 revision of the Oxford Principles and VCMI Claims Code both push enterprises that way, and the judging story is cleaner.
