import Link from "next/link";
import type { GroupOption } from "@/lib/groups";

export function GroupFilterNav({
  groups,
  basePath,
  current,
  extraQuery,
}: {
  groups: GroupOption[];
  basePath: string;
  /** Id vybrané kategorie, nebo null pro „všichni“. */
  current: string | null;
  /** Další query parametry (např. období statistik), které se zachovají při přepnutí. */
  extraQuery?: Record<string, string | undefined>;
}) {
  const href = (groupId: string | null) => {
    const params = new URLSearchParams();
    if (groupId) params.set("skupina", groupId);
    if (extraQuery) {
      for (const [k, v] of Object.entries(extraQuery)) {
        if (v !== undefined && v !== "") params.set(k, v);
      }
    }
    const q = params.toString();
    return q ? `${basePath}?${q}` : basePath;
  };

  const cls = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm transition ${
      active
        ? "border-slate-300 bg-slate-100 text-slate-800"
        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
    }`;

  return (
    <nav className="flex max-w-full flex-wrap items-center gap-2">
      <span className="text-xs text-slate-500">Zobrazit:</span>
      <Link href={href(null)} className={cls(current === null)}>
        Všichni
      </Link>
      {groups.map((g) => (
        <Link key={g.id} href={href(g.id)} className={cls(current === g.id)}>
          <span
            aria-hidden
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: g.color }}
          />
          {g.name}
        </Link>
      ))}
    </nav>
  );
}
