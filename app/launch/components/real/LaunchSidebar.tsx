"use client";

/**
 * LaunchSidebar — static visual clone of the real Carbo sidebar
 * (components/Sidebar.tsx + components/SidebarNav.tsx).
 *
 * Renders inside MacWindow.macInterior. Hardcoded nav data; no DB queries,
 * no client routing. The `activeKey` prop just toggles which item shows
 * the brand-green left edge + "active" treatment, so the parent scene can
 * pick what's highlighted (default: "dashboard").
 */
import {
  BookOpen,
  CalendarCheck,
  FileText,
  Home,
  Leaf,
  type LucideIcon,
  ScrollText,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react";
import { CodeLabel } from "@/components/ui";

type Item = { key: string; label: string; icon: LucideIcon };
type Group = { label: string; items: Item[] };

const GROUPS: Group[] = [
  {
    label: "Overview",
    items: [
      { key: "dashboard", label: "Dashboard", icon: Home },
      { key: "ledger", label: "Ledger", icon: BookOpen },
    ],
  },
  {
    label: "Carbon",
    items: [
      { key: "close", label: "Close", icon: CalendarCheck },
      { key: "impacts", label: "Impacts", icon: Target },
      { key: "reserve", label: "Reserve", icon: Wallet },
    ],
  },
  {
    label: "Documents",
    items: [
      { key: "invoices", label: "Invoices", icon: FileText },
      { key: "reports", label: "Reports", icon: ScrollText },
    ],
  },
];

export type LaunchSidebarProps = {
  activeKey?: string;
};

export function LaunchSidebar({ activeKey = "dashboard" }: LaunchSidebarProps) {
  return (
    <aside
      style={{
        width: 240,
        height: "100%",
        flexShrink: 0,
        background: "var(--bg-canvas)",
        borderRight: "1px solid var(--border-faint)",
        display: "flex",
        flexDirection: "column",
      }}
      aria-label="Primary navigation"
    >
      {/* Brand row */}
      <div
        style={{
          height: 56,
          padding: "0 16px",
          borderBottom: "1px solid var(--border-faint)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <Leaf
          style={{
            height: 18,
            width: 18,
            color: "var(--brand-green)",
          }}
        />
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--fg-primary)",
            letterSpacing: "-0.005em",
          }}
        >
          Carbo
        </span>
        <span style={{ marginLeft: "auto" }}>
          <CodeLabel>v0.6</CodeLabel>
        </span>
      </div>

      {/* Search row */}
      <div style={{ padding: "12px 12px 0 12px", flexShrink: 0 }}>
        <div
          style={{
            height: 36,
            background: "var(--bg-inset)",
            border: "1px solid var(--border-default)",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            padding: "0 10px",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: "var(--fg-muted)",
              flex: 1,
            }}
          >
            Search
          </span>
          <kbd
            style={{
              fontFamily: "var(--font-source-code-pro), ui-monospace, monospace",
              fontSize: 11,
              color: "var(--fg-muted)",
              background: "var(--bg-button)",
              border: "1px solid var(--border-default)",
              borderRadius: 4,
              padding: "1px 5px",
              letterSpacing: 0,
            }}
          >
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Groups */}
      <nav
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {GROUPS.map((g) => (
          <div key={g.label}>
            <div style={{ padding: "0 10px", marginBottom: 8 }}>
              <CodeLabel>{g.label}</CodeLabel>
            </div>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              {g.items.map((it) => {
                const isActive = it.key === activeKey;
                const Icon = it.icon;
                return (
                  <li key={it.key} style={{ position: "relative" }}>
                    {isActive ? (
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 4,
                          bottom: 4,
                          width: 2,
                          background: "var(--brand-green)",
                          borderRadius: 1,
                        }}
                      />
                    ) : null}
                    <div
                      aria-current={isActive ? "page" : undefined}
                      style={{
                        height: 32,
                        padding: "0 10px",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        borderRadius: 6,
                        background: isActive ? "var(--bg-hover)" : "transparent",
                        color: isActive
                          ? "var(--fg-primary)"
                          : "var(--fg-secondary)",
                      }}
                    >
                      <Icon
                        style={{
                          height: 15,
                          width: 15,
                          color: isActive
                            ? "var(--brand-green)"
                            : "var(--fg-muted)",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          letterSpacing: 0,
                        }}
                      >
                        {it.label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* Setup group with onboarding callout */}
        <div>
          <div style={{ padding: "0 10px", marginBottom: 8 }}>
            <CodeLabel>Setup</CodeLabel>
          </div>
          <div
            aria-current={activeKey === "onboarding" ? "page" : undefined}
            style={{
              height: 32,
              padding: "0 10px",
              display: "flex",
              alignItems: "center",
              gap: 10,
              borderRadius: 6,
              background: "var(--brand-green-soft)",
              border: "1px solid var(--brand-green-border)",
              color: "var(--brand-green-link)",
            }}
          >
            <Sparkles
              style={{
                height: 15,
                width: 15,
                color: "var(--brand-green)",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 500 }}>Onboarding</span>
          </div>
        </div>
      </nav>

      {/* Org footer */}
      <div
        style={{
          borderTop: "1px solid var(--border-faint)",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 14,
            color: "var(--fg-primary)",
            lineHeight: 1.2,
          }}
        >
          Acme BV
        </span>
        <CodeLabel>BUNQ BUSINESS · NL12 BUNQ</CodeLabel>
      </div>
    </aside>
  );
}
