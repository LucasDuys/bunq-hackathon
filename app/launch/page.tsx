"use client";

/**
 * /launch — Carbo launch video, autoplayed in browser.
 *
 * The integrator agent wires the LaunchTimeline orchestrator (mounting all
 * scenes in the correct order with leaf overlay) into this route. This file
 * is intentionally minimal so the integrator owns the orchestration shape.
 */
import styles from "./launch.module.css";
import { LaunchTimeline } from "./LaunchTimeline";

export default function LaunchPage() {
  return (
    <div className={styles.shell}>
      <LaunchTimeline />
    </div>
  );
}
