import { prisma } from "@/lib/prisma";
import type { StatEvent, StatType } from "@/lib/review-stats";

/**
 * Čtení rozborů pro hráčský portál.
 *
 * Sdílení se ověřuje tady, na serveru, a vždycky spolu s klubem. Kdo
 * rozbor nasdílený nemá, nedostane data — dostane null a stránka vrátí
 * 404. Kdyby se to kontrolovalo až v komponentě, stačilo by tipnout id.
 */

/** Podmínka „tenhle hráč to smí vidět“ — na jednom místě, ať se nerozejde. */
function sdilenoS(playerId: string) {
  return {
    OR: [{ sharedAll: true }, { shares: { some: { playerId } } }],
  };
}

export type SharedReviewRow = {
  id: string;
  name: string;
  opponent: string | null;
  playedOn: Date;
  eventCount: number;
};

export async function listSharedReviews(
  userId: string,
  playerId: string,
): Promise<SharedReviewRow[]> {
  const rows = await prisma.videoReview.findMany({
    where: { userId, ...sdilenoS(playerId) },
    orderBy: { playedOn: "desc" },
    include: { events: { select: { id: true } } },
  });

  return rows.map((r) => ({
    id: String(r.id),
    name: r.name,
    opponent: r.opponent,
    playedOn: r.playedOn,
    eventCount: r.events.length,
  }));
}

/** Kolik sdílených rozborů hráč má — podle toho se v portálu ukáže odkaz. */
export async function countSharedReviews(
  userId: string,
  playerId: string,
): Promise<number> {
  return prisma.videoReview.count({
    where: { userId, ...sdilenoS(playerId) },
  });
}

export async function getSharedReview(
  userId: string,
  playerId: string,
  reviewId: string,
): Promise<{
  review: {
    name: string;
    opponent: string | null;
    playedOn: Date;
    videoId: string | null;
    notes: string | null;
  };
  types: StatType[];
  events: (StatEvent & { note: string | null })[];
} | null> {
  const review = await prisma.videoReview.findFirst({
    where: { id: reviewId, userId, ...sdilenoS(playerId) },
    include: {
      events: {
        orderBy: { atSeconds: "asc" },
        include: { player: { select: { name: true } } },
      },
    },
  });
  if (!review) return null;

  const types = await prisma.reviewEventType.findMany({
    where: { userId },
    orderBy: { sortOrder: "asc" },
  });

  return {
    review: {
      name: review.name,
      opponent: review.opponent,
      playedOn: review.playedOn,
      videoId: review.videoId,
      notes: review.notes,
    },
    types: types.map((t) => ({
      id: String(t.id),
      label: t.label,
      color: t.color,
      side: t.side,
      sortOrder: t.sortOrder,
      archived: t.archived,
    })),
    events: review.events.map((e) => ({
      id: String(e.id),
      typeId: String(e.typeId),
      atSeconds: e.atSeconds,
      playerId: e.playerId == null ? null : String(e.playerId),
      playerName: e.player?.name ?? null,
      note: e.note,
    })),
  };
}
