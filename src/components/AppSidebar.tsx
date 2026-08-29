import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

const links = [
  { href: "/prehled", label: "Přehled" },
  { href: "/hraci", label: "Hráči" },
  { href: "/treninky", label: "Tréninky" },
  { href: "/platby", label: "Platby" },
  { href: "/statistiky", label: "Statistiky" },
  { href: "/rating", label: "Rating" },
  { href: "/rozbory", label: "Rozbory" },
  { href: "/nastaveni", label: "Nastavení" },
];

const linkClass = (active: boolean) =>
  `rounded-md border px-3 py-2 text-sm transition ${
    active
      ? "border-club-line bg-club-soft font-medium text-slate-900"
      : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-800"
  }`;

/** Hlavička s klubovou identitou — stejná typografie jako na webu klubu. */
function ClubMark() {
  return (
    <div className="mb-5">
      <div className="font-heading text-sm font-extrabold uppercase tracking-[0.15em] text-club">
        DC Liberec
      </div>
      <div className="mt-0.5 text-xs text-slate-500">Správa klubu</div>
    </div>
  );
}

function NavLinks({
  currentPath,
  onNavigate,
}: {
  currentPath: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-0.5">
      {links.map((l) => {
        const active =
          currentPath === l.href || currentPath.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={linkClass(active)}
            onClick={onNavigate}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Postranní panel — jen desktop (md+). */
export function AppSidebar({ currentPath }: { currentPath: string }) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-52 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-[rgba(2,6,23,.6)] p-4 backdrop-blur md:flex">
      <ClubMark />
      <NavLinks currentPath={currentPath} />
      <div className="mt-4 border-t border-slate-200 pt-4">
        <LogoutButton />
      </div>
    </aside>
  );
}

/** Obsah vysouvacího menu na telefonu — zavření po kliknutí na odkaz. */
export function MobileMenuPanel({
  currentPath,
  onClose,
}: {
  currentPath: string;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[rgba(2,6,23,.97)] p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-[max(1rem,env(safe-area-inset-top,0px))]">
      <div className="mb-4 flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <span className="font-heading text-sm font-extrabold uppercase tracking-[0.15em] text-club">
          DC Liberec
        </span>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
          aria-label="Zavřít menu"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <NavLinks currentPath={currentPath} onNavigate={onClose} />
      <div className="mt-4 shrink-0 border-t border-slate-200 pt-4">
        <LogoutButton />
      </div>
    </div>
  );
}
