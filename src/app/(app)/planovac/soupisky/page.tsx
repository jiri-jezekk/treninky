import Link from "next/link";
import { listGroups } from "@/lib/groups";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { RosterManager } from "./RosterManager";

export default async function SoupiskyPage({
  searchParams,
}: {
  searchParams: Promise<{ skupina?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const groups = await listGroups(userId);

  if (groups.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
        Nejdřív si založ kategorie (U12, U15…) v{" "}
        <Link href="/hraci" className="underline decoration-slate-300 underline-offset-4">
          Hráčích
        </Link>
        .
      </p>
    );
  }

  const group = groups.find((g) => g.id === sp.skupina) ?? groups[0]!;

  const [members, clubPlayers] = await Promise.all([
    prisma.rosterMember.findMany({
      where: { userId, groupId: group.id },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, name: true, skill: true, active: true },
    }),
    prisma.player.count({
      where: { userId, active: true, groupMembers: { some: { groupId: group.id } } },
    }),
  ]);

  return (
    <>
      <p className="mb-4 max-w-prose text-sm text-slate-600">
        Kdo do kategorie chodí a jak na tom je — podle toho se skládají
        vyrovnané týmy. S hráči klubu ani platbami soupiska nesouvisí.
      </p>

      <nav className="mb-5 flex flex-wrap gap-2" aria-label="Kategorie">
        {groups.map((g) => (
          <Link
            key={g.id}
            href={`/planovac/soupisky?skupina=${g.id}`}
            aria-current={g.id === group.id ? "page" : undefined}
            className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition ${
              g.id === group.id
                ? "border-club-line bg-club-soft text-slate-900"
                : "border-slate-200 text-slate-600 hover:border-club"
            }`}
          >
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: g.color }}
            />
            {g.name}
          </Link>
        ))}
      </nav>

      <RosterManager
        key={group.id}
        groupId={group.id}
        groupName={group.name}
        members={members}
        clubPlayerCount={clubPlayers}
      />
    </>
  );
}
