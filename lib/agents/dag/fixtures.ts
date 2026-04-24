/**
 * Fixture loader for DAG agent stubs. Real Anthropic calls replace this.
 * See docs/agents/00-overview.md for per-agent upgrade sequence.
 */
import fixture from "@/fixtures/demo-runs/sample-run.json";
import type { DagRunResult } from "./types";

export const sampleRun: DagRunResult = fixture as unknown as DagRunResult;
