"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/planovac", label: "Plány" },
  { href: "/planovac/cviceni", label: "Cvičení" },
  { href: "/planovac/soupisky", label: "Soupisky" },
  { href: "/planovac/tymy", label: "Týmy" },
];

const tabClass = (active: boolean) =>
  `inline-flex min-h-10 items-center rounded-full border px-3.5 py-1.5 font-heading text-sm font-semibold transition ${
    active
      ? "border-club-line bg-club-soft text-slate-900"
      : "border-slate-200 text-slate-600 hover:border-club hover:bg-club-soft hover:text-slate-900"
  }`;

/** Záložky Plánovače. Detail plánu patří pod „Plány“. */
export function PlannerTabs() {
  const pathname = usePathname();
  const active =
    TABS.slice(1).find((t) => pathname.startsWith(t.href))?.href ?? "/planovac";

  return (
    <nav className="mb-6 flex flex-wrap gap-2" aria-label="Plánovač">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={tabClass(active === t.href)}
          aria-current={active === t.href ? "page" : undefined}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
