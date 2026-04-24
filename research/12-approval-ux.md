# Defensive UX: Alert Fatigue, Human Oversight, and Warn / Pause / Block Semantics

## Summary
The single largest failure mode of an always-on defensive AI like Sentry is not missing attacks -- it is habituating the user to ignore it. Two decades of HCI research on browser security warnings, SOC analyst dashboards, and privacy nudges converge on the same verdict: warnings that fire too often, use constant visual weight, or ask for a decision without enough context get clicked through in 70-90% of cases. Sentry must therefore calibrate its interventions to confidence: quiet ambient signal for low confidence, a visible banner with context for medium confidence, an active interruption (voice + screen overlay + card soft-pause) for high confidence only. The EU AI Act Article 14 human-oversight obligation pushes this in the same direction -- we need a design that makes the human the final decider on any money-affecting action, with the AI's confidence and evidence visible and the override path in <2 clicks.

## Key Concepts
- **Alert fatigue / warning fatigue**: cumulative desensitization to alerts driven by volume, repetition, low precision, and visual sameness. Documented in SOC operations (51% of teams feel overwhelmed, analysts spend 25%+ of time on false positives) and in browser security warnings (Sunshine et al., Akhawe & Felt "Alice in Warningland").
- **Habituation**: neurobiological decrease in response to repeated stimuli. Generalizes -- users who ignore cookie banners also start ignoring security warnings ("The Fog of Warnings," MIS Quarterly 2025).
- **Calibrated confidence**: the UI exposes the model's probability, not a binary flag, but in a form that humans can read without numeric literacy ("Sentry is fairly sure" vs "Sentry is very sure").
- **Warn / Pause / Block ladder**: three-tier intervention taxonomy matched to three confidence bands and reversibility cost.
- **Human-in-the-loop vs human-on-the-loop vs human-out-of-the-loop**: Article 14 requires the first two for high-risk systems in money-affecting flows.
- **Automation bias**: users over-trust AI outputs even when wrong. Article 14(4)(b) explicitly names this as a design target.

## How It Works
Sentry has three signals feeding a single fraud-risk score per active context (call, message, transaction intent): (a) voice deepfake probability (from research doc 04), (b) conversational red-flag classifier (urgency, secrecy, unusual payee), (c) behavioral anomaly vs the user's baseline. The fused score maps to one of four UX states:

1. **Ambient** (score 0-0.3): tiny shield icon in the corner, neutral color. No interruption. Logged for post-hoc review.
2. **Warn** (0.3-0.6): a small banner at the top of the active surface -- "Sentry noticed: caller asking for urgent transfer." Dismissable. Clicking expands a 1-screen evidence panel.
3. **Pause** (0.6-0.85): voice warning spoken in the user's own cloned voice + on-screen overlay + card soft-paused to EUR 0.01 + clear "Restore normal" button that takes exactly one biometric confirmation. Every pause is logged with rationale for Article 14 audit.
4. **Block** (0.85+): card hard-blocked (status DEACTIVATED), full-screen interstitial, emergency "call a trusted contact" shortcut. Requires explicit multi-factor confirm to unblock.

At every level, the UI shows: *what Sentry saw* (transcript excerpt, waveform, payee name), *why it acted* (top 2-3 features driving the score), *how to override* (one-click escalation to human decision), *what it cost if wrong* (reversibility indicator).

## Current State of the Art (2024-2026)
- **SOC alert-fatigue research** (ACM Computing Surveys 2025, "Alert Fatigue in Security Operations Centres") and the SANS 2025 survey: 79% of 24/7 ops see peak fatigue at shift handoff. Mitigation patterns that transfer to consumer UX: correlation/deduplication, confidence-aware routing, human-AI teaming frameworks (E2E framework, ACM TOIT 2024 "Towards Human-AI Teaming").
- **Classic browser-warning studies**: Sunshine et al. (USENIX 2009) and Akhawe & Felt "Alice in Warningland" (USENIX 2013) demonstrated that warning design choices move click-through rates by 35 percentage points. More recent CHI 2018 experience-sampling work refined this. MIS Quarterly 2025 "Fog of Warnings" shows *non-security* notifications habituate users to security warnings by generalization.
- **EU AI Act Article 14** (in force for high-risk systems from 2 August 2026): human oversight must be "effectively" possible; specifically (4a) understanding the system's capacities and limitations, (4b) awareness of automation bias, (4c) ability to interpret output, (4d) ability to decide not to use it, (4e) ability to override / stop. Sentry's money-affecting actions fall under Annex III risk categories if scoped to banking decisions.
- **Banking app UX trends (2025-2026)** (UXDA, G&Co analyses): users report unclear fraud alerts as a top pain point. Neobanks lean on nudge theory; the winning pattern is "visible trust signal + invisible protection" -- biometrics and behavioral anomaly detection run silently, alerts only escalate when a reversible low-cost action is needed.
- **Resemble AI, Modulate, Whispeak** surface confidence scores to downstream integrators but leave UX to the deploying app.

## Use Cases for Sentry
- **Call with known contact who suddenly asks for money**: Warn tier, banner "This is a pattern Sentry flags; take a breath."
- **Call from unknown number + synthetic-voice score >0.7 + payee = new beneficiary**: Pause tier, self-voice warning, card to 0.01 EUR.
- **Multiple failed merchant authorizations within 30 s after a flagged call**: Block tier, full-screen, one-tap call to trusted contact.
- **Legitimate call that scores high (false positive)**: one-click "This is fine" teaches the model, logs for review. No friction beyond that click.
- **Post-incident review**: every intervention has a card in a "Sentry history" tab with score, features, action taken, outcome, user feedback. Satisfies Article 14 (4a) and the SOC best-practice of making alert rationale inspectable.

## Feasibility for a 24-hour Hackathon
Green on the UX ladder itself (three React components: Banner, PauseOverlay, BlockInterstitial). Yellow on calibration: getting the fraud score to actually respect the bands requires threshold tuning against realistic inputs, which is hard in 24 h with little labelled data. Ship with conservative thresholds that bias to Warn over Pause over Block; it is a better demo to say "Sentry would have paused here" with a manual override to demo the pause UI than to over-trigger and look unreliable.

## Tradeoffs (comparison table)

| Design choice | Benefit | Cost / risk | Sentry call |
|---|---|---|---|
| Always-on modal pop-up on suspicion | Users cannot miss it | Fatigue, habituation, click-through | Avoid. Reserve modal for Block only. |
| Ambient indicator only | Zero fatigue | Users ignore real threats | Use as level 1 only. |
| Voice warning in user's own cloned voice | Breaks through text blindness, novelty | Can be alarming; consent + disclosure needed | Use at Pause tier only, max once per session. |
| Auto-pause card without asking | Fastest defense | Legitimate transaction blocked, user angry | Use only at >0.6 confidence with one-click restore. |
| Ask user to confirm before any action | Article 14-compliant, full trust | Adds latency; if user is being socially engineered they confirm anyway | Confirm for Block; act-then-confirm for Pause. |
| Numeric confidence (0-1) in UI | Precise | Most users cannot calibrate | Use verbal ("fairly sure") + optional numeric on hover. |
| Log all decisions to an audit panel | Regulatory & trust story | Engineering time | Yes, minimal table is enough for the demo. |
| One-click "this was fine" feedback | RLHF signal, reduces false-positive cost | Can be gamed | Yes, rate-limited per session. |

## EU AI Act Article 14 Compliance Sketch
Even if Sentry is not formally "high-risk" at the hackathon stage, building to Article 14 from day one is both cheap and a pitch-defining differentiator:
- **(4a) understand capacities & limitations**: onboarding shows the user what Sentry can/cannot detect; status chip shows detector confidence at all times.
- **(4b) counter automation bias**: the UI never says "this is a scam", it says "Sentry thinks this looks like a scam pattern." Every action has an "I disagree" path.
- **(4c) interpret output**: evidence panel with top features, transcript excerpt, waveform.
- **(4d) decide not to use**: a visible "Pause Sentry for this call" toggle.
- **(4e) override/stop**: one-tap restore on Pause; explicit multi-factor unblock on Block; never an action the user cannot roll back within the session.

## Recommended Approach for the Hackathon
1. **Three components, one fused score**: Banner (Warn), PauseOverlay (Pause), BlockInterstitial (Block). Drive from a single `riskScore` + `intent` prop.
2. **Calibrated language**: "Sentry noticed" (Warn), "Sentry paused your card" (Pause), "Sentry blocked this" (Block). Never "FRAUD DETECTED" all-caps.
3. **Evidence always one click away**: every alert expands to show the signals. No black boxes.
4. **Self-voice warning** (from doc 05) only at Pause tier and only once per 5 minutes per session.
5. **Pause = soft card limit to EUR 0.01** (doc 06), not status change. Reversible in one biometric tap.
6. **Audit log component** visible in the demo UI -- becomes the Article 14 artefact on stage.
7. **Rehearse the false-positive flow**: show a legitimate call that scores 0.55, Warn fires, user clicks "this is fine," model feedback is logged. Proves Sentry is not paranoid.
8. **Color discipline**: amber for Warn, stronger amber for Pause, red only at Block. Do not use red at every level or habituation kicks in within the demo itself.
9. **One-screen rule**: every intervention fits a phone screen without scrolling. If users have to scroll during a scam, they will dismiss.
10. **Kill-switch**: a "Turn off Sentry" button in settings. Article 14 (4d). And it reassures judges that the user is sovereign.

## Sources
- [Article 14: Human Oversight (EU AI Act)](https://artificialintelligenceact.eu/article/14/)
- [Article 14 - AI Act Service Desk](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-14)
- [IAPP: Under EU AI Act, high-risk systems require a human touch](https://iapp.org/news/a/eu-ai-act-shines-light-on-human-oversight-needs)
- [Alert Fatigue in SOCs: Research Challenges and Opportunities (ACM Computing Surveys 2025)](https://dl.acm.org/doi/10.1145/3723158)
- [Towards Human-AI Teaming to Mitigate Alert Fatigue in SOCs (ACM TOIT 2024)](https://dl.acm.org/doi/10.1145/3670009)
- [Reducing SOC Analysts' Alert Fatigue via Real-Time CTI Correlation and Deduplication (Springer 2025)](https://link.springer.com/chapter/10.1007/978-3-032-19540-1_2)
- [Anton Chuvakin: Anton's Alert Fatigue: The Study](https://medium.com/anton-on-security/antons-alert-fatigue-the-study-0ac0e6f5621c)
- [Alice in Warningland: Browser Security Warning Effectiveness (Akhawe & Felt)](https://www.semanticscholar.org/paper/Alice-in-Warningland:-A-Large-Scale-Field-Study-of-Akhawe-Felt/48923501c2374f28fbab6788e358d245f93e69e7)
- [An Experience Sampling Study of User Reactions to Browser Warnings (CHI 2018, Felt et al.)](https://www.guanotronic.com/~serge/papers/chi18-warnings.pdf)
- [The Fog of Warnings: How Non-Security Notifications Diminish Security Warnings (MIS Quarterly 2025)](https://misq.umn.edu/misq/article/49/4/1357/3281/The-Fog-of-Warnings-How-Non-Security-Related)
- [UXDA: Dark Patterns in Banking UX](https://www.theuxda.com/blog/dark-patterns-in-digital-banking-compromise-financial-brands)
- [G&Co: Banking App Design Trends 2026](https://www.g-co.agency/insights/banking-app-design-trends-2025-ux-ui-mobile-insights)
- [Melanie Fink: Human Oversight under Article 14 of the EU AI Act (SSRN)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=5147196)
