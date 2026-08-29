import { PlayersManager } from "./PlayersManager";
import { listGroups } from "@/lib/groups";
import { formatRangeCs, isPrepaidOn } from "@/lib/prepaid";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export default async function HraciPage() {
  const userId = await requireUserId();

  const [groups, players, memberCounts, prepayments] = await Promise.all([
    listGroups(userId),
    prisma.player.findMany({
      where: { userId },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        number: true,
        active: true,
        inRating: true,
        seesReviews: true,
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
    prisma.prepayment.findMany({
      where: { userId },
      orderBy: { startsOn: "asc" },
      select: {
        playerId: true,
        startsOn: true,
        endsOn: true,
        season: { select: { name: true } },
      },
    }),
  ]);

  const counts = new Map<string, number>(
    memberCounts.map((c) => [c.groupId, Number(c._count.groupId ?? 0)]),
  );

  // Předplaceno se teď nečte z přepínače, ale z období — a to platí
  // k dnešku, ne navždy. Loňské předplatné hráče už neoznačuje.
  const today = new Date();
  const prepaidByPlayer = new Map<
    string,
    { label: string; current: boolean }[]
  >();
  for (const p of prepayments) {
    const key = String(p.playerId);
    const entry = {
      label: `${p.season?.name ?? "Předplatné"} · ${formatRangeCs(p)}`,
      current: isPrepaidOn([p], today),
    };
    const list = prepaidByPlayer.get(key);
    if (list) list.push(entry);
    else prepaidByPlayer.set(key, [entry]);
  }

  return (
    <PlayersManager
      groups={groups.map((g) => ({ ...g, memberCount: counts.get(g.id) ?? 0 }))}
      players={players.map((p) => ({
        id: p.id,
        name: p.name,
        number: p.number,
        active: p.active,
        inRating: p.inRating,
        seesReviews: p.seesReviews,
        payToken: p.payToken,
        hasPassword: p.passwordSetAt != null,
        groupIds: p.groupMembers.map((m) => m.groupId),
        prepaid: prepaidByPlayer.get(String(p.id)) ?? [],
      }))}
    />
  );
}
