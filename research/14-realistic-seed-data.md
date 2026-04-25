# 14 — Realistic seed data for the demo

## Problem

The current `scripts/seed.ts` emits 61 hand-crafted transactions over 90 days. They're varied enough to produce uncertainty clusters (Amazon, AWS, Consultancy XYZ) but the dataset doesn't *look* like a real EU mid-cap's books. Specifically: no recurring backbone, no payroll, no monthly cadence, uniform amount distribution, no FX, no edge cases, no year-over-year coverage.

For a CSRD-grade pitch we want a synthetic generator that mirrors how a 50-person Dutch software company actually spends. ~600 transactions over 12 months, deterministic-but-varied, structured so the close still produces interesting refinement questions.

## Reference: Acme BV — 50-person Dutch software company

Anchor profile for the generator. Numbers below are defensible against a CFO/auditor; gaps flagged at end.

### 1. Volume & cadence

- ~50 tx/month total (anchored to 600/yr target — no public Dutch SME tx/employee/month figure exists)
- Split: **~55% card, ~38% SEPA-out, ~5% SEPA Direct Debit, ~2% incoming**
- Weekday-skewed: card Mon-Fri ~85%, weekend ~15%; SEPA weekdays only (bunq executes weekend instructions next business day)
- Day-of-month spikes: **1st** (rent, AWS, EU SaaS), **24th-25th** (Dutch payroll), **5th-10th** (US-billed SaaS post-FX), **28th-31st** (utility direct debits)
- Reversals: 0.5-1.0% of card tx (Visa/MC threshold ~0.9-1.0%)

### 2. Recurring SaaS portfolio (~18 subscriptions)

- Per-seat (50 seats unless noted): **Slack Business+** ~€14/seat, **Google Workspace** ~€22/seat, **Notion Business** €18-20/seat, **Linear Business** $12/seat, **Figma** $25 avg (15-20 seats), **1Password Business** ~€8/seat, **Zoom Business** €18/seat (15 hosts), **GitHub Enterprise** $21/seat (~30 eng), **Sentry Business** $80-300 flat, **Datadog** $15-23/host (10-30 hosts)
- Flat / usage: **Vercel Pro** $20/seat + usage, **Anthropic / OpenAI** variable, **Cloudflare** $20-200, **Sendgrid/Resend** $20-90, **PostHog** $0-450, **HubSpot Starter** ~€15/seat (≤5 sales seats)
- Billing: 60% on the 1st, 30% mid-month anniversary, 10% annual (1Password, Sentry, Zoom often paid yearly in January)
- FX (USD-billed): GitHub, Linear, Vercel, Sentry, Notion, Datadog, Figma, Anthropic, OpenAI. Bunq presents EUR with a separate FX line.

**Generator config: 18 recurring subs, €11k-€14k/month total, 60% on day-1, 30% mid-month, 10% annual; 8 of 18 in USD with FX metadata.**

### 3. Cloud / infra

- IT infra ≈ 15-25% of OpEx for a software SME (DataBank); typically the second-largest line after payroll
- 30 engineers × $200-$1,000/month → **AWS €10k-€14k/month base**, +N(0, €1.5k) noise, Q4 multiplier 1.15
- Vendor share: **AWS 70%, GCP 20%, Azure 5%, Cloudflare/Vercel/Fly 5%** (software-native bias; broad NL stats list Azure higher because they include enterprise IT)
- AWS billed via "AWS EMEA SARL LU" (Luxembourg, EUR) — no FX surprise
- Variability 10-25% MoM; Q4 +15-20% from holiday traffic

### 4. Payroll & rent (NL)

- **Pay date 24th-25th** monthly (bi-weekly is rare in NL). Explicitly chosen so employees can cover rent + ZVW health on the 1st.
- 50 employees × €5,200 gross ≈ €3,800 net → **~€190k/month** total; model as 50 SEPA outflows or 1 batch credit transfer with 50 line items
- Holiday allowance (8%) hits late May / early June as a separate batch
- Pension provider (ASR/Aegon) SEPA on 27th-28th
- Office rent Amsterdam: prime €565/m²/yr (Cushman & Wakefield, +6% to 2025). 50 people × 8 m² avg = 400 m² → **~€18.8k/month rent on the 1st**
- Utilities (Eneco/Greenchoice/Vattenfall): **monthly equal direct debit €600-€1,200**, around 1st-5th, with annual reconciliation Feb-Mar
- Telco (KPN/Ziggo): monthly direct debit €80-€200, ~15th
- Tax: BTW (VAT) quarterly on last day of month following quarter (30 Apr / 31 Jul / 31 Oct / 31 Jan); loonheffing (payroll tax) monthly by end of following month

### 5. Travel

- 1-3 trips/month total across the company; **4-6 conference weeks/yr** (5-10 tx clustered over 3 days); **1 offsite/yr** (~30 people, ~80 tx burst over 5 days)
- Flights: KLM/Transavia AMS-EU economy €150-€350; Lufthansa/EasyJet €120-€280; long-haul €600-€1,400
- Hotels: NH Hotels / Booking.com aggregator €140-€220/night (NL/DE/FR), London €220-€330
- Train: NS International AMS-Berlin €38-€120; Eurostar AMS-London €60-€180

### 6. Office groceries / team meals

- **Albert Heijn / Jumbo office runs**: 1-2x/week, €40-€120
- **Thuisbezorgd team lunch**: 1-2x/week, €150-€400 (15-25 people × ~€7/lunch)
- ⚠️ **Deliveroo NL shut down EU consumer in 2022** — do NOT use post-2022; replace with Uber Eats NL or Just Eat / Thuisbezorgd Voor de Zaak
- **Client dinners** 2-4x/month: Loetje (€35-€55pp), De Kas (€75-€110pp), Bistrot Neuf (€50-€70pp). Bills €200-€800
- **Coffee** is light — Dutch convention is the company espresso machine + AH beans. Occasional Starbucks/Coffee Company €4-€18, ~5-15 tx/month total
- **Friday borrel** (drinks): Gall & Gall wine run €60-€200 + occasional bar tab €150-€500

### 7. Procurement long tail

- **Coolblue Zakelijk**: 2/month, €450 median (lognormal). Monitors €280-€600, MacBook Pro €2,200-€3,400, chairs Herman Miller/Vitra €450-€1,400. NL net-30 invoicing.
- **Bol.com Zakelijk**: 3/month, €70 median
- **Amazon EU SARL**: 3/month, €110 median (EUR, no FX)
- **MediaMarkt**: 0-1/month, €100-€1,200
- **Per-hire onboarding burst**: ~€3,000-€4,000 in a 7-day window (laptop + monitor + chair + peripherals)

### 8. Merchant naming variations

bunq's `counterparty_alias.display_name` for outbound card is acquirer descriptor text, usually `MERCHANT NAME CITY COUNTRY` truncated to ~22-25 chars (Mastercard NameLoc field). For SEPA: the actual SCT `name` field + IBAN.

Examples:
- **Albert Heijn**: "Albert Heijn 1411", "AH 0019 AMSTERDAM", "AH to go 5402", "AH XL Schiphol", "AH ONLINE", "ALBERT HEIJN B.V."
- **Uber**: "Uber BV", "UBER *TRIP HELP.UBER.COM", "UBER *EATS AMSTERDAM", "UBER BV AMSTERDAM NL"
- **Bolt**: "BOLT.EU/O/", "Bolt Operations OU", "Bolt.eu Tallinn EE"
- **Booking**: "Booking.com Amsterdam", "Booking.com B.V.", "BOOKING.COM7654321" (with reservation number — Booking is a payments aggregator so the actual hotel is masked)
- **Shell**: "Shell 1234 AMSTERDAM", "Shell Recharge", "Shell NL Sales BV"
- **KLM**: "KLM 074-1234567890" (ticket number suffix), "KLM ROYAL DUTCH AIRLI"

**Generator approach: per-merchant template with `{name, city?, store_no?, suffix?}` slots; truncate to 22 chars uppercase for card; exact legal name + IBAN for SEPA.**

### 9. Edge cases / noise

- **Reversals**: 0.7% of card tx, same-amount negative within 1-7 days, descriptor `REFUND <ORIG MERCHANT>`
- **SDD failures**: 0.3% (insufficient funds, mandate revoked) — R-transactions
- **FX**: 8 USD-billed vendors. bunq Mastercard FX is 0% markup (mid-market). Book the EUR debit, snapshot original USD/GBP in metadata. The amount is always EUR-presented in `amount.value`.
- **Duplicate webhook deliveries**: bunq retries up to 5x at 1-min intervals; emit 0.5-1% duplicate events with the same `id` for idempotency testing

### 10. bunq Business transaction format

`MUTATION` event wraps a `Payment` object:
- `id`, `created`, `updated`, `monetary_account_id`
- `amount: { value, currency }` — always EUR for cross-currency (bunq pre-converts)
- `description` — usually empty for cards (merchant in counterparty), free-text up to 140 chars for SEPA (typically invoice number)
- `type`: MASTERCARD / IDEAL / BUNQ / SEPA_CREDIT / SEPA_DIRECT_DEBIT
- `sub_type`
- `counterparty_alias: { iban?, display_name, label_user{display_name} }`
- `attachment[]`
- **No MCCs in the public bunq API** — merchant categorization must be inferred from `display_name` regex matching (this is a deliberate gap Carbo's classifier fills)

### 11. Year-over-year & seasonality

- MoM variance ±10-20% on total OpEx (payroll is the stable floor; card+travel is the variable layer)
- **Q4** (Dec): holiday party at Loetje/Bistrot/De Kas €5-15k single bill + Sinterklaas gifts (early Dec) €30-€80 × 50 employees via Bol.com/Coolblue. **Multiplier 1.15.**
- **Summer** (Jul-Aug): travel/dinners drop 30-40%, AWS flat, payroll +8% holiday allowance bump in May/June. **Multiplier 0.80.**
- **January** is the largest single-month SaaS spike (3-4× normal SaaS month) — annual renewals (1Password, Sentry, Zoom, insurance ASR/Centraal Beheer, NS Business cards). **Multiplier 1.25.**
- KvK chamber fee Q1; KPMG/Mazars annual filing Q1-Q2 €5-15k

### 12. Merchant catalogue (~95 names by category)

| Category | Merchants |
|---|---|
| Travel — flights/train/transit (12) | KLM, Transavia, Lufthansa, EasyJet, British Airways, Eurostar, NS International, NS Reizigers, Deutsche Bahn, Schiphol Parking, Q-Park, P+R Amsterdam |
| Travel — ground/lodging (10) | Uber BV, Bolt.eu, Booking.com B.V., NH Hotels, citizenM, The Student Hotel, Mövenpick Amsterdam, Airbnb Payments UK, Hilton Amsterdam Airport, Mercure |
| Cloud / infra (8) | AWS EMEA SARL, Google Cloud EMEA, Microsoft Azure, Cloudflare, Vercel, Fly.io, DigitalOcean, Hetzner Online |
| SaaS — collaboration (10) | Slack (Salesforce), Google Workspace, Notion Labs, Linear Orbit Inc, Figma, Atlassian, Loom, Miro, Zoom Video, Calendly |
| SaaS — engineering (10) | GitHub Inc, GitLab, Sentry, Datadog, PostHog, LaunchDarkly, 1Password, Tailscale, Anthropic, OpenAI |
| SaaS — sales/finance (8) | HubSpot, Pipedrive, Stripe, Mollie, Adyen, Yuki, Moneybird, Visma e-conomic |
| Food — supermarket (5) | Albert Heijn, Jumbo, Hema, Lidl, Marqt |
| Food — delivery/dining (12) | Thuisbezorgd, Uber Eats NL, Loetje, Restaurant De Kas, Bistrot Neuf, Restaurant Breda, Café-Restaurant Amsterdam, Coffee Company, Starbucks, Bagels & Beans, Vapiano, Bar Bukowski |
| Procurement (8) | Coolblue Zakelijk, Bol.com Zakelijk, Amazon EU SARL, MediaMarkt, IKEA Business, Hema, Action, Mediamarkt Online |
| Utilities / services (12) | Eneco, Greenchoice, Vattenfall, Waternet, KPN Zakelijk, Ziggo, T-Mobile NL, ASR Verzekeringen, Centraal Beheer, KvK, Belastingdienst, Mazars Accountants |
| Fuel / fleet (~3-5 tx/yr for software co) | Shell, BP, Tango, GreenWheels, MyWheels |

Spend share by EUR (rough): payroll 50%, cloud 12%, SaaS 10%, rent+utilities 11%, travel 7%, food 4%, procurement 4%, taxes 2%.

## Generator outline

```
scripts/seed-realistic.ts --months=12 --employees=50 --seed=42

→ deterministic procedural generator:
  1. Recurring backbone: 18 SaaS subs + payroll + rent + utilities, scheduled by date
  2. Burst events: 1 offsite/yr + 4-6 conf weeks/yr + onboarding bursts
  3. Long tail: weekday-weighted card sampling from category distribution × per-merchant lognormal
  4. Edge cases: 0.7% reversals, 0.3% SDD failures, 0.7% duplicate webhook events
  5. Seasonality multipliers: Dec 1.15, Jan 1.25, Jul-Aug 0.80
  6. Per-merchant naming: template variants per chain (5-10 spellings)
  7. FX metadata for 8 USD vendors
```

Output: ~600 transactions/year for the canonical Acme BV profile.

## Honest gaps in the research

- bunq sandbox doesn't publish exact descriptor truncation rules for card MUTATION events — patterns above are inferred from Mastercard NameLoc conventions. Validate against a real sandbox dump before locking the generator.
- No public Dutch SME tx/employee/month figure exists — 50 tx/month for 50 employees is anchored to a 600/yr target, not measured.
- NH Berlin business rate not in public results — used Amsterdam €170 as proxy. Defensible since NH list-prices are similar EU-wide ±15%.
- AWS spend per engineer cited in USD; €/$ ≈ 1.0 today so the ranges hold.

## Sources

- bunq Payment API: https://doc.bunq.com/payment/payment
- bunq Event API: https://doc.bunq.com/event
- bunq Monetary Account: https://doc.bunq.com/basics/bunq-api-objects/monetary-account
- Cushman & Wakefield Amsterdam offices: https://www.cushmanwakefield.com/en/netherlands/offices/amsterdam
- Statista — Amsterdam prime office rent: https://www.statista.com/statistics/530076/office-real-estate-prime-rent-amsterdam-netherlands-europe/
- VU — salary payment dates: https://vu.nl/en/employee/salary/dates-of-salary-payments
- Undutchables — Salaries in NL: https://undutchables.nl/about-us/blog/salaries-in-the-netherlands
- business.gov.nl — Personnel costs: https://business.gov.nl/running-your-business/staff/payment-and-wages/
- Slack / GitHub / Linear / Notion / Figma / Vercel / Sentry / Datadog public pricing pages
- Zylo 2025 SaaS Management Index: https://zylo.com/reports/2025-saas-management-index/
- SaaS Capital — 2025 spending benchmarks: https://www.saas-capital.com/blog-posts/spending-benchmarks-for-private-b2b-saas-companies/
- Geminate — Startup engineering budget Y1: https://geminatesolutions.com/blog/startup-engineering-budget-year-one
- Statista — NL cloud services by sector 2020: https://www.statista.com/statistics/1056500/distribution-of-popular-cloud-services-in-the-netherlands-by-sector/
- NS International AMS-Berlin: https://www.nsinternational.com/en/train/amsterdam-berlin
- KAYAK — KLM AMS-Berlin: https://www.kayak.com/flight-routes/Berlin-Brandenburg-BER/Amsterdam-Schiphol-AMS
- Hotelvak — NL hotel prices 2025: https://hotelvak.eu/en/hotel-news/hotel-stay-in-the-netherlands-in-2025-on-average-6-more-expensive-than-in-2024/
- Thuisbezorgd — Lunch order avg: https://www.thuisbezorgd.nl/en/partner/blog/boost-your-business/lunch-proof-your-menu-and-benefit-from-takeaway-pay/
- Coolblue Zakelijk SME: https://www.coolblue.nl/en/c/sme.html
- Chargeflow — chargeback statistics 2025: https://www.chargeflow.io/blog/chargeback-statistics-trends-costs-solutions
- NL Compass — energy providers: https://www.nlcompass.com/guides/utilities-bills-netherlands-expats/energy-providers-comparison
