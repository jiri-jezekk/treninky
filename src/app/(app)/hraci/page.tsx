import { PlayersManager } from "./PlayersManager";
import { listGroups } from "@/lib/groups";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export default async function HraciPage() {
  const userId = await requireUserId();

  const [groups, players, memberCounts] = await Promise.all([
    listGroups(userId),
    prisma.player.findMany({
      where: { userId },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        number: true,
        active: true,
        prepaidSeason: true,
        payToken: true,
        passwordSetAt: true,
        groupMembers: { select: { groupId: true } },
      },
    }),
    // Omezeno na kategorie tohoto uživatele — bez toho by se počítala
    // členství napříč všemi účty.
    prisma.playerGroupMembership.groupBy({
      by: ["groupId"],
      where: { group: { userId } },
      _count: { groupId: true },
    }),
  ]);

  const counts = new Map<string, number>(
    memberCounts.map((c) => [c.groupId, Number(c._count.groupId ?? 0)]),
  );

  return (
    <PlayersManager
      groups={groups.map((g) => ({ ...g, memberCount: counts.get(g.id) ?? 0 }))}
      players={players.map((p) => ({
        id: p.id,
        name: p.name,
        number: p.number,
        active: p.active,
        prepaidSeason: p.prepaidSeason,
        payToken: p.payToken,
        hasPassword: p.passwordSetAt != null,
        groupIds: p.groupMembers.map((m) => m.groupId),
      }))}
    />
  );
}
