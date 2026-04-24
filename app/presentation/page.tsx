"use client";

import { notFound } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import sampleRun from "@/fixtures/demo-runs/sample-run.json";
import styles from "./presentation.module.css";
import type { DagRunResult, AgentName } from "@/lib/agents/dag/types";

const DEMO_ENABLED = process.env.NEXT_PUBLIC_DEMO === "1";

const run = sampleRun as unknown as DagRunResult;

const SECTIONS: Array<{ id: string; label: string }> = [
  { id: "hero", label: "Hero" },
  { id: "problem", label: "Problem" },
  { id: "current", label: "Today" },
  { id: "proposed", label: "Proposed" },
  { id: "replay", label: "Live run" },
  { id: "report", label: "CFO report" },
  { id: "vision", label: "Vision" },
];

const AGENT_ORDER: Array<{ id: AgentName; label: string; color: string; group: number }> = [
  { id: "spend_emissions_baseline_agent", label: "Spend & emissions baseline", color: "var(--cat-other)", group: 1 },
  { id: "green_alternatives_agent", label: "Green alternatives", color: "var(--cat-goods)", group: 2 },
  { id: "cost_savings_agent", label: "Cost savings", color: "var(--cat-digital)", group: 2 },
  { id: "green_judge_agent", label: "Green judge", color: "var(--cat-goods)", group: 3 },
  { id: "cost_judge_agent", label: "Cost judge", color: "var(--cat-digital)", group: 3 },
  { id: "carbon_credit_incentive_strategy_agent", label: "Credit & incentive strategy", color: "var(--cat-travel)", group: 4 },
  { id: "executive_report_agent", label: "Executive report", color: "var(--cat-electricity)", group: 5 },
];

function useActiveSection(): string {
  const [active, setActive] = useState("hero");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive((entry.target as HTMLElement).dataset.section ?? "hero");
          entry.target.classList.toggle(styles.visible, entry.isIntersecting);
        }
      },
      { threshold: 0.25 },
    );
    document.querySelectorAll("[data-section]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return active;
}

function ConfidenceBar({ value }: { value: number }) {
  const tier =
    value >= 0.85
      ? "var(--confidence-high)"
      : value >= 0.6
      ? "var(--confidence-medium)"
      : "var(--confidence-low)";
  const pct = Math.round(value * 100);
  return (
    <div>
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 6 }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "1.2px",
            textTransform: "uppercase",
            color: "var(--fg-muted)",
          }}
        >
          Confidence
        </span>
        <span
          className="tabular-nums"
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: "var(--fg-secondary)",
          }}
        >
          {pct}%
        </span>
      </div>
      <div
        className={styles.confidenceBar}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={styles.confidenceFill}
          style={{ width: `${pct}%`, background: tier }}
        />
      </div>
    </div>
  );
}

function DagReplay({ data }: { data: DagRunResult }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!playing) return;
    if (step >= AGENT_ORDER.length) {
      setPlaying(false);
      return;
    }
    const ms = Math.max(400, data.metrics[AGENT_ORDER[step].id]?.latencyMs ?? 800);
    timer.current = setTimeout(() => setStep((s) => s + 1), ms);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, step, data]);

  const current = AGENT_ORDER[Math.min(step, AGENT_ORDER.length - 1)];
  const currentOutput: Record<string, unknown> = (() => {
    switch (current.id) {
      case "spend_emissions_baseline_agent":
        return data.baseline.baseline;
      case "green_alternatives_agent":
        return data.greenAlt.summary;
      case "cost_savings_agent":
        return data.costSavings.summary;
      case "green_judge_agent":
        return data.greenJudge.summary;
      case "cost_judge_agent":
        return data.costJudge.summary;
      case "carbon_credit_incentive_strategy_agent":
        return data.creditStrategy.summary;
      case "executive_report_agent":
        return data.executiveReport.kpis;
      default:
        return {};
    }
  })();

  return (
    <div>
      <div className={styles.replayPanel}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {AGENT_ORDER.map((agent, i) => (
            <div key={agent.id} className={styles.agentNode} data-active={i <= step}>
              <div>
                <span className={styles.agentDot} style={{ background: agent.color }} />
                <span className={styles.agentTitle}>{agent.label}</span>
              </div>
              <div className={styles.agentMeta}>
                {data.metrics[agent.id].latencyMs.toFixed(0)}ms · in {data.metrics[agent.id].inputTokens}tok · out{" "}
                {data.metrics[agent.id].outputTokens}tok
                {data.metrics[agent.id].cached ? " · cached" : ""}
              </div>
            </div>
          ))}
        </div>
        <div>
          <div className={styles.statLabel} style={{ marginBottom: 8 }}>
            {current.label} output
          </div>
          <pre className={styles.payload}>{JSON.stringify(currentOutput, null, 2)}</pre>
        </div>
      </div>
      <div className={styles.replayControls}>
        <button
          className={`${styles.button} ${styles.buttonPrimary}`}
          onClick={() => {
            setStep(0);
            setPlaying(true);
          }}
        >
          {playing ? "Playing…" : "Play DAG"}
        </button>
        <button
          className={`${styles.button} ${styles.buttonGhost}`}
          onClick={() => {
            setPlaying(false);
            setStep(0);
          }}
        >
          Reset
        </button>
        <span className={styles.agentMeta}>
          Total baked latency: {data.totalLatencyMs.toFixed(0)}ms · run {data.runId}
        </span>
      </div>
    </div>
  );
}

function Nav({ active, onJump }: { active: string; onJump: (id: string) => void }) {
  return (
    <nav className={styles.nav} aria-label="Presentation sections">
      {SECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          className={styles.navItem}
          data-active={active === s.id}
          onClick={() => onJump(s.id)}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}

export default function PresentationPage() {
  if (!DEMO_ENABLED) notFound();
  const active = useActiveSection();
  const exec = run.executiveReport;
  const tCO2e = (kg: number) => (kg / 1000).toFixed(1);
  const eur = (v: number) => `€${(v ?? 0).toLocaleString("en-NL")}`;

  const jump = useCallback((id: string) => {
    document.querySelector(`[data-section="${id}"]`)?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Keyboard navigation — arrow keys switch sections
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const idx = SECTIONS.findIndex((s) => s.id === active);
      if (idx === -1) return;
      const nextIdx =
        e.key === "ArrowRight"
          ? Math.min(SECTIONS.length - 1, idx + 1)
          : Math.max(0, idx - 1);
      if (nextIdx !== idx) jump(SECTIONS[nextIdx].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, jump]);

  return (
    <main className={styles.page}>
      <Nav active={active} onJump={jump} />

      {/* ── Hero ─────────────────────────────── */}
      <section className={styles.section} data-section="hero">
        <span className={styles.eyebrow}>Carbo · bunq hackathon 7.0 · 2026</span>
        <h1 className={styles.h1}>
          Turn bunq transactions into a
          <br />
          <span className={styles.accent}>CFO-ready</span> monthly carbon close.
        </h1>
        <p className={styles.lead}>
          An autonomous 7-agent DAG reads a company&rsquo;s month of spending, finds greener and
          cheaper alternatives, judges them, and composes a signed executive report with a net
          company-scale financial impact number.
        </p>
        <div className={styles.kpiRow}>
          <div className={styles.card}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Baseline emissions</div>
              <div className={styles.statValue}>
                {tCO2e(run.baseline.baseline.estimated_total_tco2e * 1000)}{" "}
                <span style={{ fontSize: 18, color: "var(--fg-muted)" }}>tCO₂e</span>
              </div>
              <div className={styles.statSub}>{eur(run.baseline.baseline.total_spend_eur)} spend analysed</div>
              <ConfidenceBar value={run.baseline.baseline.baseline_confidence} />
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Net annual impact</div>
              <div className={styles.statValue} style={{ color: "var(--brand-green)" }}>
                {eur(exec.kpis.net_company_scale_financial_impact_eur)}
              </div>
              <div className={styles.statSub}>
                {tCO2e(exec.kpis.emissions_reduced_tco2e * 1000)} tCO₂e reduced
              </div>
              <ConfidenceBar value={exec.kpis.confidence} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem ──────────────────────────── */}
      <section className={styles.section} data-section="problem">
        <span className={styles.eyebrow}>Problem</span>
        <h2 className={styles.h2}>A monthly close is a reasoning task, not a template.</h2>
        <p className={styles.lead}>
          Spreadsheets aggregate. Template reports render. Neither can say{" "}
          <em>
            &ldquo;switch the AMS–FRA flights to rail; buy 18 tCO₂e of EU removal credits; cancel
            Confluence — net impact €28.8k.&rdquo;
          </em>{" "}
          A single LLM call can&rsquo;t either, because the steps must be proposed, challenged,
          corrected, and composed — not free-associated.
        </p>
        <div className={styles.kpiRow}>
          <div className={styles.card}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Today · LLM touchpoints</div>
              <div className={styles.statValue}>2</div>
              <div className={styles.statSub}>refinement Q&amp;A + narrative</div>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Proposed · reasoning agents</div>
              <div className={styles.statValue}>7</div>
              <div className={styles.statSub}>propose · judge · strategize · compose</div>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Critical-path LLM calls</div>
              <div className={styles.statValue}>5</div>
              <div className={styles.statSub}>parallel fan-out at two stages</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Today ────────────────────────────── */}
      <section className={styles.section} data-section="current">
        <span className={styles.eyebrow}>Today</span>
        <h2 className={styles.h2}>A 12-state orchestrator with two LLM touchpoints.</h2>
        <p className={styles.lead}>
          The state machine survives restarts and renders the close as a deterministic, auditable
          sequence. But the reasoning layer is thin — one Sonnet call generates refinement
          questions; a second composes the narrative. No proposals, no validation, no CFO-grade
          net impact.
        </p>
        <div className={styles.linearFlow}>
          {[
            "AGGREGATE",
            "ESTIMATE_INITIAL",
            "CLUSTER",
            "QUESTIONS_GENERATED (Sonnet)",
            "AWAITING_ANSWERS",
            "APPLY_ANSWERS",
            "ESTIMATE_FINAL",
            "APPLY_POLICY",
            "PROPOSED",
            "AWAITING_APPROVAL",
            "EXECUTING",
            "COMPLETED",
          ].map((s, i) => (
            <span key={s} style={{ display: "contents" }}>
              <span className={styles.linearNode}>{s}</span>
              {i < 11 ? <span className={styles.linearArrow}>→</span> : null}
            </span>
          ))}
        </div>
      </section>

      {/* ── Proposed ─────────────────────────── */}
      <section className={styles.section} data-section="proposed">
        <span className={styles.eyebrow}>Proposed</span>
        <h2 className={styles.h2}>Seven agents, two judges, one composer.</h2>
        <p className={styles.lead}>
          The DAG keeps the 12-state orchestrator and replaces its LLM touchpoints with a
          structured reasoning graph. Every number the CFO sees has been proposed by a worker,
          validated by a judge, and composed by a reporter.
        </p>
        <div className={styles.dagGrid}>
          {AGENT_ORDER.map((agent) => (
            <div key={agent.id} className={styles.agentNode} data-active={true}>
              <div>
                <span className={styles.agentDot} style={{ background: agent.color }} />
                <span className={styles.agentTitle}>{agent.label}</span>
              </div>
              <div className={styles.agentMeta}>
                Stage {agent.group} · {run.metrics[agent.id].latencyMs.toFixed(0)}ms ·{" "}
                {run.metrics[agent.id].inputTokens + run.metrics[agent.id].outputTokens} tok
              </div>
              <div className={styles.agentMeta}>See docs/agents for system prompt.</div>
            </div>
          ))}
        </div>
        <p className={styles.lead}>
          <em>Parallel fan-out:</em> Green Alternatives ‖ Cost Savings at stage 2; Green Judge ‖
          Cost Judge at stage 3. Wall-clock critical path = 5 Sonnet calls, not 7.
        </p>
      </section>

      {/* ── Live run ─────────────────────────── */}
      <section className={styles.section} data-section="replay">
        <span className={styles.eyebrow}>Live run</span>
        <h2 className={styles.h2}>Baked replay from a real DAG run.</h2>
        <p className={styles.lead}>
          Pre-recorded outputs from a <code>runDag()</code> execution on March 2026 mock data.
          Every payload below is the agent&rsquo;s real structured response, not hand-written
          commentary.
        </p>
        <DagReplay data={run} />
      </section>

      {/* ── CFO report ───────────────────────── */}
      <section className={styles.section} data-section="report">
        <span className={styles.eyebrow}>CFO report</span>
        <h2 className={styles.h2}>{exec.report_title}</h2>
        <p className={styles.lead}>{exec.executive_summary}</p>
        <div className={styles.kpiRow}>
          <div className={styles.card}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Procurement savings</div>
              <div className={styles.statValue}>{eur(exec.kpis.direct_procurement_savings_eur)}</div>
              <div className={styles.statSub}>annual, approved items only</div>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Credits needed</div>
              <div className={styles.statValue}>
                {eur(exec.kpis.recommended_credit_purchase_cost_eur)}
              </div>
              <div className={styles.statSub}>EU removal, post-reduction</div>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Tax / incentive upside</div>
              <div className={styles.statValue}>
                {eur(exec.kpis.estimated_tax_incentive_upside_eur)}
              </div>
              <div className={styles.statSub}>scenario; advisor review required</div>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Net impact</div>
              <div className={styles.statValue} style={{ color: "var(--brand-green)" }}>
                {eur(exec.kpis.net_company_scale_financial_impact_eur)}
              </div>
              <div className={styles.statSub}>
                payback {exec.kpis.payback_period_months} months ·{" "}
                {tCO2e(exec.kpis.emissions_reduced_tco2e * 1000)} tCO₂e reduced
              </div>
              <ConfidenceBar value={exec.kpis.confidence} />
            </div>
          </div>
        </div>
        <div className={styles.matrix} aria-label="Price vs carbon matrix">
          <div className={styles.matrixCell} data-quadrant="hclc">
            <div className={styles.matrixHeader}>High cost · low carbon</div>
            {exec.matrix.high_cost_low_carbon.map((r) => (
              <div key={r} className={styles.matrixItem}>
                {r}
              </div>
            ))}
          </div>
          <div className={styles.matrixCell} data-quadrant="lclc">
            <div className={styles.matrixHeader}>Low cost · low carbon</div>
            {exec.matrix.low_cost_low_carbon.map((r) => (
              <div key={r} className={styles.matrixItem}>
                {r}
              </div>
            ))}
          </div>
          <div className={styles.matrixCell} data-quadrant="hchc">
            <div className={styles.matrixHeader}>High cost · high carbon</div>
            {exec.matrix.high_cost_high_carbon.map((r) => (
              <div key={r} className={styles.matrixItem}>
                {r}
              </div>
            ))}
          </div>
          <div className={styles.matrixCell} data-quadrant="lchc">
            <div className={styles.matrixHeader}>Low cost · high carbon</div>
            {exec.matrix.low_cost_high_carbon.map((r) => (
              <div key={r} className={styles.matrixItem}>
                {r}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Vision ───────────────────────────── */}
      <section className={styles.section} data-section="vision">
        <span className={styles.eyebrow}>Next</span>
        <h2 className={styles.h2}>
          Replace the linear close with the DAG. Wire live Anthropic calls behind the mock flag.
        </h2>
        <p className={styles.lead}>
          The scaffold lives under <code>lib/agents/dag/</code>. Per-agent system prompts and I/O
          schemas are in <code>docs/agents/</code>. Context-scaling patterns (no raw rows, bounded
          tools, prompt caching, parallel fan-out) are in{" "}
          <code>research/13-context-scaling-patterns.md</code>. Flip{" "}
          <code>ANTHROPIC_MOCK=0</code> and set <code>ANTHROPIC_API_KEY</code> in{" "}
          <code>.env.local</code> to go live.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span className={styles.pill}>spec · .forge/specs/spec-agentic-dag.md</span>
          <span className={styles.pill}>comparison · docs/architecture-comparison.md</span>
          <span className={styles.pill}>research · research/13-context-scaling-patterns.md</span>
        </div>
      </section>
    </main>
  );
}
