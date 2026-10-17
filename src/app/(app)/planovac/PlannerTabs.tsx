"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/planovac", label: "Plány" },
  { href: "/planovac/cviceni", label: "Cvičení" },
];

const tabClass = (active: boolean) =>
  `rounded-full border px-3.5 py-1.5 font-heading text-xs font-semibold transition ${
    active
      ? "border-club-line bg-club-soft text-slate-900"
      : "border-slate-200 text-slate-600 hover:border-club hover:bg-club-soft hover:text-slate-900"
  }`;

/** Záložky Plánovače. Detail plánu patří pod „Plány“. */
export function PlannerTabs() {
  const pathname = usePathname();
  const active = pathname.startsWith("/planovac/cviceni")
    ? "/planovac/cviceni"
    : "/planovac";

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
