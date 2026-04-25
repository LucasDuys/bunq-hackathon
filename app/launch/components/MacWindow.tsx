"use client";

/**
 * MacWindow — light macOS chrome wrapper that frames the dark Carbo product UI.
 *
 * 36px titlebar (#f6f6f6) with three traffic dots + optional sidebar/back/forward
 * icons + centered title. Optional 36px search row (⌘K kbd). Interior is
 * #171717 dark, full height minus titlebar (and search row if shown).
 *
 * The window shadow is the ONLY allowed drop-shadow in the launch shell —
 * documented exception to DESIGN.md, justified by macOS chrome fidelity.
 */
import type { CSSProperties, ReactNode } from "react";
import { ChevronLeft, ChevronRight, PanelLeft, Search } from "lucide-react";
import styles from "../launch.module.css";

export type MacWindowProps = {
  title?: string;
  showSidebar?: boolean;
  showSearch?: boolean;
  width?: number;
  height?: number;
  /** Optional vertical offset from the top of the viewport. If omitted, centered. */
  top?: number;
  /**
   * If true, the titlebar (and search row) renders with a translucent
   * backdrop-blur over the page bg — used for the orbiting-cube and
   * multi-app cuts where windows overlap.
   */
  glass?: boolean;
  children: ReactNode;
  className?: string;
};

const ICON_COLOR = "#6e6e6e";
const SEARCH_ROW_HEIGHT = 36;
const TITLEBAR_HEIGHT = 36;

export function MacWindow({
  title,
  showSidebar = false,
  showSearch = false,
  width = 1480,
  height = 900,
  top,
  glass = false,
  children,
  className,
}: MacWindowProps) {
  const interiorHeight =
    height - TITLEBAR_HEIGHT - (showSearch ? SEARCH_ROW_HEIGHT : 0);

  const positioning: CSSProperties =
    top !== undefined
      ? { top, left: "50%", transform: "translateX(-50%)" }
      : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <div
      className={[styles.macWindow, className].filter(Boolean).join(" ")}
      style={{
        position: "absolute",
        width,
        height,
        ...positioning,
      }}
      role="group"
      aria-label={title ?? "Carbo window"}
    >
      <div
        className={styles.macTitlebar}
        style={
          glass
            ? {
                background: "rgba(246, 246, 246, 0.72)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
              }
            : undefined
        }
      >
        <div className={styles.trafficDots} aria-hidden="true">
          <span className={`${styles.trafficDot} ${styles.red}`} />
          <span className={`${styles.trafficDot} ${styles.yellow}`} />
          <span className={`${styles.trafficDot} ${styles.green}`} />
        </div>

        {showSidebar ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: ICON_COLOR,
              marginLeft: 4,
            }}
            aria-hidden="true"
          >
            <PanelLeft size={16} color={ICON_COLOR} strokeWidth={1.75} />
            <ChevronLeft size={16} color={ICON_COLOR} strokeWidth={1.75} />
            <ChevronRight size={16} color={ICON_COLOR} strokeWidth={1.75} />
          </div>
        ) : null}

        {title ? (
          <div className={styles.macTitle}>{title}</div>
        ) : (
          <div style={{ flex: 1 }} />
        )}

        {/* Right-hand spacer to keep the title visually centered when icons are present. */}
        <div
          style={{
            width: showSidebar ? 12 + 8 + 16 + 8 + 16 + 8 + 16 : 12 + 8 + 12 + 8 + 12,
            visibility: "hidden",
          }}
          aria-hidden="true"
        />
      </div>

      {showSearch ? <SearchRow /> : null}

      <div
        className={styles.macInterior}
        style={{
          height: interiorHeight,
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function SearchRow() {
  return (
    <div
      style={{
        height: SEARCH_ROW_HEIGHT,
        background: "#f6f6f6",
        borderBottom: "1px solid #ececec",
        display: "flex",
        alignItems: "center",
        padding: "0 14px",
        gap: 10,
        color: "#6e6e6e",
      }}
    >
      <Search size={14} color={ICON_COLOR} strokeWidth={1.75} />
      <span
        style={{
          fontSize: 13,
          color: "#6e6e6e",
          fontWeight: 400,
          letterSpacing: "-0.005em",
          flex: 1,
        }}
      >
        Search
      </span>
      <kbd
        style={{
          fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
          fontSize: 11,
          color: "#6e6e6e",
          background: "#ffffff",
          border: "1px solid #e6e6e6",
          borderRadius: 4,
          padding: "2px 6px",
          letterSpacing: 0,
        }}
      >
        ⌘K
      </kbd>
    </div>
  );
}
