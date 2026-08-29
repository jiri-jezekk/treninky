import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewTracker } from "./ReviewTracker";
import { ensureDefaultEventTypes } from "@/actions/rozbory";
import { formatDateDdMmYyyy, formatDateTimeDdMmYyyy24h } from "@/lib/date-display";
import { toDateInputValue } from "@/lib/prepaid";
import type { StatType } from "@/lib/review-stats";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export default async function RozborDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();
  await ensureDefaultEventTypes(userId);

  const [review, types, players, kategorie, sezony] = await Promise.all([
    prisma.videoReview.findFirst({
      where: { id, userId },
      include: {
        events: {
          orderBy: { atSeconds: "asc" },
          include: { player: { select: { id: true, name: true } } },
        },
        roster: { select: { playerId: true } },
        group: { select: { id: true, name: true } },
        season: { select: { id: true, name: true } },
        comments: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.reviewEventType.findMany({
      where: { userId },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.player.findMany({
      where: { userId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.group.findMany({
      where: { userId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.season.findMany({
      where: { userId },
      orderBy: { startsOn: "desc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!review) notFound();

  const statTypes: StatType[] = types.map((t) => ({
    id: String(t.id),
    label: t.label,
    color: t.color,
    side: t.side,
    groupLabel: t.groupLabel,
    subLabel: t.subLabel,
    sortOrder: t.sortOrder,
    archived: t.archived,
  }));

  return (
    <div className="min-w-0 max-w-6xl">
      <Link
        href="/rozbory"
        className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4"
      >
        ‹ Rozbory
      </Link>

      <ReviewTracker
        review={{
          id: String(review.id),
          name: review.name,
          opponent: review.opponent,
          playedOnLabel: formatDateDdMmYyyy(review.playedOn),
          playedOnValue: toDateInputValue(review.playedOn),
          videoId: review.videoId,
          notes: review.notes,
          visibleToPlayers: review.visibleToPlayers,
          groupId: review.group ? String(review.group.id) : null,
          groupName: review.group?.name ?? null,
          seasonId: review.season ? String(review.season.id) : null,
          seasonName: review.season?.name ?? null,
          // Prázdná soupiska = celý klub; rozhoduje se až v komponentě,
          // aby staré rozbory fungovaly beze změny.
          roster: review.roster.map((r) => String(r.playerId)),
        }}
        types={statTypes}
        players={players.map((p) => ({ id: String(p.id), name: p.name }))}
        kategorie={kategorie.map((g) => ({ id: String(g.id), name: g.name }))}
        sezony={sezony.map((x) => ({ id: String(x.id), name: x.name }))}
        comments={review.comments.map((k) => ({
          id: String(k.id),
          authorName: k.authorName,
          body: k.body,
          createdLabel: formatDateTimeDdMmYyyy24h(k.createdAt),
          playerId: k.playerId == null ? null : String(k.playerId),
        }))}
        events={review.events.map((e) => ({
          id: String(e.id),
          typeId: String(e.typeId),
          atSeconds: e.atSeconds,
          playerId: e.playerId == null ? null : String(e.playerId),
          playerName: e.player?.name ?? null,
          note: e.note,
        }))}
      />
    </div>
  );
}
