import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewTracker } from "./ReviewTracker";
import { ensureDefaultEventTypes } from "@/actions/rozbory";
import { formatDateDdMmYyyy } from "@/lib/date-display";
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

  const [review, types, players] = await Promise.all([
    prisma.videoReview.findFirst({
      where: { id, userId },
      include: {
        events: {
          orderBy: { atSeconds: "asc" },
          include: { player: { select: { id: true, name: true } } },
        },
        shares: { select: { playerId: true } },
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
  ]);
  if (!review) notFound();

  const statTypes: StatType[] = types.map((t) => ({
    id: String(t.id),
    label: t.label,
    color: t.color,
    side: t.side,
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
          sharedAll: review.sharedAll,
          sharedWith: review.shares.map((s) => String(s.playerId)),
        }}
        types={statTypes}
        players={players.map((p) => ({ id: String(p.id), name: p.name }))}
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
