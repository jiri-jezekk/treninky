import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

const links = [
  { href: "/prehled", label: "Přehled" },
  { href: "/hraci", label: "Hráči" },
  { href: "/treninky", label: "Tréninky" },
  { href: "/statistiky", label: "Statistiky" },
  { href: "/skupinove-platby", label: "Skupinové platby" },
  { href: "/nastaveni", label: "Nastavení" },
];

export function AppSidebar({ currentPath }: { currentPath: string }) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-slate-50 p-4">
      <div className="mb-6 font-semibold text-slate-800">Tréninky</div>
      <nav className="flex flex-1 flex-col gap-1">
        {links.map((l) => {
          const active =
            currentPath === l.href || currentPath.startsWith(l.href + "/");
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                active
                  ? "bg-emerald-100 text-emerald-900"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-4 border-t border-slate-200 pt-4">
        <LogoutButton />
      </div>
    </aside>
  );
}
