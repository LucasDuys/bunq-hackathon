import Link from "next/link";
import { Leaf } from "lucide-react";

const items = [
  { href: "/", label: "Overview" },
  { href: "/categories", label: "Categories" },
  { href: "/impacts", label: "Impacts" },
  { href: "/reserve", label: "Reserve" },
  { href: "/ledger", label: "Ledger" },
];

export const Nav = () => (
  <header className="sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur">
    <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-8">
      <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
        <Leaf className="h-5 w-5 text-emerald-600" />
        <span>Carbo</span>
      </Link>
      <nav className="flex items-center gap-5 text-sm">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50">
            {it.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto text-xs text-zinc-500">Acme BV · bunq Business</div>
    </div>
  </header>
);
