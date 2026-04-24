"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf, Search, Bell } from "lucide-react";

const items = [
  { href: "/", label: "Overview" },
  { href: "/categories", label: "Categories" },
  { href: "/tax-savings", label: "Tax savings" },
  { href: "/impact", label: "Impact" },
  { href: "/reserve", label: "Reserve" },
  { href: "/ledger", label: "Ledger" },
];

export const Nav = () => {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-10 backdrop-blur-[14px]"
      style={{
        borderBottom: "1px solid var(--border)",
        background: "rgba(16,18,22,0.72)",
      }}
    >
      <div className="max-w-[1480px] mx-auto px-10 h-14 flex items-center gap-9">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg grid place-items-center"
            style={{
              background: "linear-gradient(135deg, #4ade80, #1a6b3d)",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.1) inset, 0 4px 14px rgba(48,192,111,0.45)",
            }}
          >
            <Leaf className="h-[15px] w-[15px] text-white" />
          </div>
          <span className="text-[15px] font-bold tracking-tight" style={{ color: "var(--text)" }}>
            Carbo
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex gap-0.5 relative">
          {items.map((it) => {
            const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                className="relative px-3.5 py-2 text-[13px] font-medium rounded-lg transition-colors"
                style={{
                  color: active ? "var(--text)" : "var(--text-mute)",
                  background: active ? "rgba(255,255,255,0.05)" : "transparent",
                }}
              >
                {it.label}
                {active && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                    style={{
                      background: "linear-gradient(90deg, transparent, var(--green), transparent)",
                    }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3.5">
          <div
            className="flex items-center gap-2 px-3 py-[7px] rounded-full text-[12.5px] min-w-[220px]"
            style={{
              background: "var(--bg-inset)",
              border: "1px solid var(--border)",
              color: "var(--text-mute)",
            }}
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search transactions…</span>
            <span
              className="ml-auto text-[10.5px] px-1.5 py-0.5 rounded"
              style={{ background: "var(--bg-card-2)", color: "var(--text-faint)" }}
            >
              ⌘K
            </span>
          </div>

          <button
            className="relative w-[34px] h-[34px] rounded-full grid place-items-center"
            style={{ border: "1px solid var(--border)", color: "var(--text-dim)" }}
          >
            <Bell className="h-4 w-4" />
            <span
              className="absolute rounded-full"
              style={{
                top: 7, right: 7, width: 7, height: 7,
                background: "var(--green-bright)",
                boxShadow: "0 0 0 2px var(--bg), 0 0 8px var(--green-bright)",
              }}
            />
          </button>

          <div
            className="w-[34px] h-[34px] rounded-full grid place-items-center text-xs font-bold"
            style={{
              background: "linear-gradient(135deg, #3a4049, #1c2026)",
              border: "1px solid var(--border-strong)",
              color: "var(--text)",
            }}
          >
            A
          </div>
        </div>
      </div>
    </header>
  );
};
