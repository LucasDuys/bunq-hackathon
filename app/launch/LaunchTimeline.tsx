"use client";

/**
 * LaunchTimeline — master orchestrator for the /launch video.
 *
 * Drives a single RAF clock that advances `totalElapsedMs`. From that we derive
 * the active scene index, scene-local elapsed/progress, and mount the correct
 * scene component. The Leaf overlay lives at the root so it drifts across
 * scene boundaries without remounting.
 *
 * Dev scrubber (only when ?dev=1) lets us scrub, pause, and jump to any scene.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { AboveWindowCaption } from "./components/AboveWindowCaption";
import { HeaderOverlay } from "./components/HeaderOverlay";
import { Leaf } from "./components/Leaf";
import styles from "./launch.module.css";
import { TIMELINE, TOTAL_DURATION_MS } from "./data";
import type { SceneSpec } from "./types";
import S01 from "./scenes/S01";
import S01D from "./scenes/S01D";
import S02 from "./scenes/S02";
import S03 from "./scenes/S03";
import S04 from "./scenes/S04";
import S05 from "./scenes/S05";
import S06 from "./scenes/S06";
import S07A from "./scenes/S07A";
import S10 from "./scenes/S10";
import S11 from "./scenes/S11";
import S11A from "./scenes/S11A";
import S11R from "./scenes/S11R";
import S11P from "./scenes/S11P";
import S12 from "./scenes/S12";
import S13 from "./scenes/S13";
import S13B from "./scenes/S13B";
import S13C from "./scenes/S13C";
import S14 from "./scenes/S14";
import S15 from "./scenes/S15";
import S16 from "./scenes/S16";

// Order MUST match TIMELINE in data.ts.
const SCENES = [
  S01, S01D, S02,
  S03, S04, S05, S06,
  S07A,
  S10, S11, S11A,
  S11R, S11P,
  S12, S13, S13B, S13C,
  S14, S15,
  S16,
];

/** Cumulative ms-offset at which each scene begins. Last entry = TOTAL_DURATION_MS. */
const OFFSETS: number[] = (() => {
  const o = [0];
  for (const s of TIMELINE) o.push(o[o.length - 1]! + s.durationMs);
  return o;
})();

/** Find the scene index for a given total elapsed time (clamped). */
function sceneIndexFor(totalMs: number): number {
  const t = Math.max(0, Math.min(totalMs, TOTAL_DURATION_MS - 1));
  // Binary-light: TIMELINE has 23 entries, linear is fine.
  for (let i = TIMELINE.length - 1; i >= 0; i--) {
    if (t >= OFFSETS[i]!) return i;
  }
  return 0;
}

export function LaunchTimeline() {
  const [totalElapsedMs, setTotalElapsedMs] = useState(0);
  const [paused, setPaused] = useState(false);
  const lastFrameRef = useRef<number | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Dev mode: only mount the scrubber when ?dev=1.
  const [devMode, setDevMode] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDevMode(window.location.search.includes("dev=1"));
  }, []);

  // Loop mode: only restart at end when ?loop=1.
  const loopMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.location.search.includes("loop=1");
  }, []);

  // Master RAF — advance clock by frame delta when not paused.
  useEffect(() => {
    let frame = 0;
    lastFrameRef.current = null;
    const tick = (now: number) => {
      const last = lastFrameRef.current;
      if (last === null) {
        lastFrameRef.current = now;
      } else {
        const delta = now - last;
        lastFrameRef.current = now;
        if (!pausedRef.current) {
          setTotalElapsedMs((prev) => {
            const next = prev + delta;
            if (next >= TOTAL_DURATION_MS) {
              return loopMode ? next - TOTAL_DURATION_MS : TOTAL_DURATION_MS;
            }
            return next;
          });
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [loopMode]);

  // Derive scene state from clock.
  const currentSceneIdx = sceneIndexFor(totalElapsedMs);
  const currentScene: SceneSpec = TIMELINE[currentSceneIdx]!;
  const sceneStartMs = OFFSETS[currentSceneIdx]!;
  const sceneElapsedMs = Math.max(
    0,
    Math.min(currentScene.durationMs, totalElapsedMs - sceneStartMs)
  );
  const sceneProgress =
    currentScene.durationMs > 0 ? sceneElapsedMs / currentScene.durationMs : 1;

  const ActiveScene = SCENES[currentSceneIdx]!;

  const jumpToScene = useCallback((idx: number) => {
    const offset = OFFSETS[idx] ?? 0;
    setTotalElapsedMs(offset);
    lastFrameRef.current = null;
  }, []);

  const onScrub = useCallback((value: number) => {
    setTotalElapsedMs(value);
    lastFrameRef.current = null;
  }, []);

  const togglePause = useCallback(() => {
    setPaused((p) => !p);
    lastFrameRef.current = null;
  }, []);

  return (
    <>
      {/* Three-band cinematic layout: top plate (chapter header) ·
          stage (camera-zoomed scene) · bottom plate (narrator caption +
          scene-progress hairline). Text plates live in the white shell so
          they never collide with the dark MacWindow interior. */}
      <div className={styles.frame}>
        <header className={styles.topPlate}>
          {currentScene.header ? (
            <HeaderOverlay
              key={`hdr-${currentScene.id}`}
              text={currentScene.header}
              elapsedMs={sceneElapsedMs}
              durationMs={currentScene.durationMs}
              sceneIndex={currentSceneIdx + 1}
              sceneTotal={TIMELINE.length}
            />
          ) : null}
        </header>

        <main className={styles.stage}>
          <ActiveScene
            key={currentScene.id}
            elapsedMs={sceneElapsedMs}
            durationMs={currentScene.durationMs}
            progress={sceneProgress}
          />
        </main>

        <footer className={styles.bottomPlate}>
          <div
            className={styles.sceneProgressTrack}
            role="progressbar"
            aria-label="Scene progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(sceneProgress * 100)}
          >
            <div
              className={styles.sceneProgressFill}
              style={{ transform: `scaleX(${sceneProgress})`, width: "100%" }}
            />
          </div>
          {currentScene.caption ? (
            <AboveWindowCaption
              key={`cap-${currentScene.id}`}
              text={currentScene.caption}
              elapsedMs={sceneElapsedMs}
              durationMs={currentScene.durationMs}
            />
          ) : null}
        </footer>
      </div>

      {/* Leaf — root-level so it drifts across scene boundaries. */}
      <Leaf
        elapsedMs={totalElapsedMs}
        opacity={currentScene.leafOpacity ?? 0.35}
      />

      {/* Dev scrubber (?dev=1 only) */}
      {devMode ? (
        <DevScrubber
          totalElapsedMs={totalElapsedMs}
          paused={paused}
          currentSceneIdx={currentSceneIdx}
          sceneElapsedMs={sceneElapsedMs}
          sceneDurationMs={currentScene.durationMs}
          onScrub={onScrub}
          onTogglePause={togglePause}
          onJumpToScene={jumpToScene}
        />
      ) : null}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dev scrubber
// ─────────────────────────────────────────────────────────────────────────────

type DevScrubberProps = {
  totalElapsedMs: number;
  paused: boolean;
  currentSceneIdx: number;
  sceneElapsedMs: number;
  sceneDurationMs: number;
  onScrub: (v: number) => void;
  onTogglePause: () => void;
  onJumpToScene: (idx: number) => void;
};

function DevScrubber({
  totalElapsedMs,
  paused,
  currentSceneIdx,
  sceneElapsedMs,
  sceneDurationMs,
  onScrub,
  onTogglePause,
  onJumpToScene,
}: DevScrubberProps) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 64,
        background: "rgba(15, 15, 15, 0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        color: "#fafafa",
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 16px",
        zIndex: 11000,
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
        fontFamily: "var(--font-inter), system-ui, sans-serif",
      }}
    >
      {/* Play/Pause */}
      <button
        type="button"
        onClick={onTogglePause}
        aria-label={paused ? "Play" : "Pause"}
        style={{
          width: 36,
          height: 36,
          borderRadius: 9999,
          background: "var(--brand-green)",
          color: "#0a0a0a",
          border: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        {paused ? <Play size={16} /> : <Pause size={16} />}
      </button>

      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={TOTAL_DURATION_MS}
        step={10}
        value={totalElapsedMs}
        onChange={(e) => onScrub(Number(e.target.value))}
        style={{
          flex: 1,
          accentColor: "var(--brand-green)",
        }}
      />

      {/* Readout */}
      <div
        style={{
          fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
          fontSize: 12,
          color: "#b4b4b4",
          letterSpacing: 0,
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {fmtMs(totalElapsedMs)} / {fmtMs(TOTAL_DURATION_MS)} ·{" "}
        {TIMELINE[currentSceneIdx]?.id} (scene {fmtSec(sceneElapsedMs)}/{fmtSec(sceneDurationMs)})
      </div>

      {/* Scene chips */}
      <div
        style={{
          display: "flex",
          gap: 4,
          flexShrink: 0,
        }}
      >
        {TIMELINE.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onJumpToScene(i)}
            style={{
              minWidth: 32,
              height: 28,
              padding: "0 6px",
              borderRadius: 6,
              border: `1px solid ${
                i === currentSceneIdx
                  ? "var(--brand-green)"
                  : "rgba(255, 255, 255, 0.12)"
              }`,
              background: "transparent",
              color: i === currentSceneIdx ? "var(--brand-green)" : "#b4b4b4",
              fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
              fontSize: 10,
              letterSpacing: "0.6px",
              cursor: "pointer",
              transition: "border-color 200ms, color 200ms",
            }}
          >
            {s.id}
          </button>
        ))}
      </div>
    </div>
  );
}

function fmtMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function fmtSec(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}
