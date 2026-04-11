import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

const links = [
  { href: "/prehled", label: "Přehled" },
  { href: "/hraci", label: "Hráči" },
  { href: "/treninky", label: "Tréninky" },
  { href: "/platba", label: "Měsíční platba" },
  { href: "/statistiky", label: "Statistiky" },
  { href: "/skupinove-platby", label: "Skupinové platby" },
  { href: "/nastaveni", label: "Nastavení" },
];

export function AppSidebar({ currentPath }: { currentPath: string }) {
  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-slate-200/90 bg-white p-4">
      <div className="mb-5 text-sm font-medium text-slate-600">Menu</div>
      <nav className="flex flex-1 flex-col gap-0.5">
        {links.map((l) => {
          const active =
            currentPath === l.href || currentPath.startsWith(l.href + "/");
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md border px-3 py-2 text-sm ${
                active
                  ? "border-slate-300 bg-slate-50 text-slate-900"
                  : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50"
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
