"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

export const NavLinks = ({
  items,
  onboardingLink,
}: {
  items: NavItem[];
  onboardingLink: NavItem | null;
}) => {
  const pathname = usePathname();

  return (
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
      {onboardingLink && (
        <Link
          href={onboardingLink.href}
          className="relative px-3.5 py-2 text-[13px] font-medium rounded-lg transition-colors"
          style={{ color: "var(--green-bright)" }}
        >
          {onboardingLink.label}
        </Link>
      )}
    </nav>
  );
};
