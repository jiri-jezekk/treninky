import Link from "next/link";
import { listGroups } from "@/lib/groups";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { QuickTeams } from "./QuickTeams";

/** Rychlé rozdělení do týmů bez plánu — nic se neukládá. */
export default async function TymyPage() {
  const userId = await requireUserId();

  const [groups, members] = await Promise.all([
    listGroups(userId),
    prisma.rosterMember.findMany({
      where: { userId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, skill: true, groupId: true },
    }),
  ]);

  if (members.length === 0) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
        Soupisky jsou zatím prázdné.{" "}
        <Link
          href="/planovac/soupisky"
          className="underline decoration-slate-300 underline-offset-4 hover:text-slate-800"
        >
          Doplnit soupisky
        </Link>
      </p>
    );
  }

  return (
    <>
      <p className="mb-4 max-w-prose text-sm text-slate-600">
        Rychlé vyrovnané týmy bez plánu. Označ, kdo je tu, a rozděl — nic se
        neukládá.
      </p>
      <QuickTeams
        groups={groups
          .filter((g) => members.some((m) => m.groupId === g.id))
          .map((g) => ({ id: g.id, name: g.name, color: g.color }))}
        members={members}
      />
    </>
  );
}
