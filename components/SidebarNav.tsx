"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  BookOpen,
  LayoutDashboard,
  Leaf,
  type LucideIcon,
  Menu,
  Search,
  Shield,
  Sparkles,
  Target,
  X,
} from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon };
type Group = { label: string; items: Item[] };

const GROUPS: Group[] = [
  {
    label: "Workspace",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/impacts", label: "Impacts", icon: Target },
    ],
  },
  {
    label: "Operate",
    items: [
      { href: "/reserve", label: "Reserve", icon: Shield },
      { href: "/ledger", label: "Ledger", icon: BookOpen },
    ],
  },
];

type OnboardingLink = { href: string; label: string } | null;
type CloseLink = { href: string; label: string; month: string } | null;

export const SidebarNav = ({
  onboardingLink,
  closeLink,
}: {
  onboardingLink: OnboardingLink;
  closeLink: CloseLink;
}) => {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Mobile top bar (shown < 600px) */}
      <header className="sidebar-topbar">
        <Link href="/" className="flex items-center gap-2">
          <Leaf className="h-[18px] w-[18px]" style={{ color: "var(--brand-green)" }} />
          <span
            className="text-[14px] font-medium tracking-tight"
            style={{ color: "var(--fg-primary)" }}
          >
            Carbo
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="sidebar-menu-btn ml-auto"
        >
          <Menu className="h-4 w-4" />
        </button>
      </header>

      {/* Backdrop (mobile, when open) */}
      <div
        className={`sidebar-backdrop${open ? " is-open" : ""}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar — sticky column on desktop, slide-in drawer on mobile */}
      <aside
        className={`sidebar${open ? " is-open" : ""}`}
        aria-label="Primary navigation"
      >
        {/* Brand */}
        <div className="sidebar-brand">
          <Leaf className="h-[18px] w-[18px]" style={{ color: "var(--brand-green)" }} />
          <span
            className="text-[14px] font-medium tracking-tight"
            style={{ color: "var(--fg-primary)" }}
          >
            Carbo
          </span>
          <span className="ml-auto code-label sidebar-brand-meta">v0.1</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="sidebar-close ml-auto"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pt-3 shrink-0">
          <button type="button" className="sidebar-search">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span>Search</span>
            <span className="sidebar-search-kbd">⌘K</span>
          </button>
        </div>

        {/* Groups */}
        <nav className="sidebar-nav">
          {GROUPS.map((g, gi) => (
            <div key={g.label} className={gi === 0 ? "" : "mt-6"}>
              <div className="px-2.5 mb-2 code-label">{g.label}</div>
              <ul className="flex flex-col gap-0.5">
                {g.items.map((it) => {
                  const active = isActive(it.href);
                  const Icon = it.icon;
                  return (
                    <li key={it.href} className="sidebar-link-row">
                      <Link
                        href={it.href}
                        aria-current={active ? "page" : undefined}
                        className="sidebar-link"
                      >
                        <Icon className="sidebar-link__icon" />
                        <span>{it.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {closeLink && (
            <div className="mt-6">
              <div className="px-2.5 mb-2 code-label">In progress</div>
              <Link href={closeLink.href} className="sidebar-onboarding-link">
                <Activity
                  className="h-[15px] w-[15px] shrink-0"
                  style={{ color: "var(--brand-green)" }}
                />
                <span className="flex-1 truncate">{closeLink.label}</span>
                <span
                  className="code-label tabular-nums shrink-0"
                  style={{ color: "var(--brand-green-link)" }}
                >
                  {closeLink.month}
                </span>
              </Link>
            </div>
          )}

          {onboardingLink && (
            <div className="mt-6">
              <div className="px-2.5 mb-2 code-label">Setup</div>
              <Link href={onboardingLink.href} className="sidebar-onboarding-link">
                <Sparkles
                  className="h-[15px] w-[15px] shrink-0"
                  style={{ color: "var(--brand-green)" }}
                />
                <span>{onboardingLink.label}</span>
              </Link>
            </div>
          )}
        </nav>

        {/* Org footer */}
        <div className="sidebar-org">
          <span
            className="text-[14px] leading-tight"
            style={{ color: "var(--fg-primary)" }}
          >
            Acme BV
          </span>
          <span className="code-label">bunq Business</span>
        </div>
      </aside>
    </>
  );
};
