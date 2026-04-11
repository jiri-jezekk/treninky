import Link from "next/link";
import {
  PLAYER_GROUP_LABELS,
  PLAYER_GROUP_ORDER,
} from "@/lib/player-groups";
import type { PlayerGroup } from "@prisma/client";

export function GroupFilterNav({
  basePath,
  current,
}: {
  basePath: string;
  current: PlayerGroup | null;
}) {
  const href = (skupina: PlayerGroup | null) =>
    skupina ? `${basePath}?skupina=${skupina}` : basePath;

  const cls = (active: boolean) =>
    `rounded-md border px-2.5 py-1 text-sm transition ${
      active
        ? "border-slate-300 bg-slate-100 text-slate-800"
        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
    }`;

  return (
    <nav className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-500">Zobrazit:</span>
      <Link href={href(null)} className={cls(current === null)}>
        Všichni
      </Link>
      {PLAYER_GROUP_ORDER.map((g) => (
        <Link key={g} href={href(g)} className={cls(current === g)}>
          {PLAYER_GROUP_LABELS[g]}
        </Link>
      ))}
    </nav>
  );
}
