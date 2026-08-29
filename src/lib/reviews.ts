import { prisma } from "@/lib/prisma";
import type { StatEvent, StatType } from "@/lib/review-stats";
import { mujSouhrn, souhrnRozboru, type MujSouhrn } from "@/lib/review-summary";
import { formatDateDdMmYyyy, formatDateTimeDdMmYyyy24h } from "@/lib/date-display";
import type { Komentar } from "@/components/ReviewKomentare";

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
  comments: Komentar[];
} | null> {
  const review = await prisma.videoReview.findFirst({
    where: { id: reviewId, userId, ...sdilenoS(playerId) },
    include: {
      events: {
        orderBy: { atSeconds: "asc" },
        include: { player: { select: { name: true } } },
      },
      comments: { orderBy: { createdAt: "asc" } },
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
      groupLabel: t.groupLabel,
      subLabel: t.subLabel,
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
    comments: review.comments.map((k) => ({
      id: String(k.id),
      authorName: k.authorName,
      body: k.body,
      createdLabel: formatDateTimeDdMmYyyy24h(k.createdAt),
      playerId: k.playerId == null ? null : String(k.playerId),
    })),
  };
}

/**
 * Souhrn hráče napříč nasdílenými rozbory.
 *
 * Počítá se jen z toho, co hráč smí vidět — kdyby se sčítalo přes
 * všechny rozbory klubu, prozradilo by číslo i zápasy, ke kterým
 * přístup nemá.
 */
export async function getSharedSummary(
  userId: string,
  playerId: string,
): Promise<MujSouhrn | null> {
  const [reviews, types] = await Promise.all([
    prisma.videoReview.findMany({
      where: { userId, ...sdilenoS(playerId) },
      orderBy: { playedOn: "desc" },
      include: {
        events: {
          select: {
            id: true,
            typeId: true,
            atSeconds: true,
            playerId: true,
            player: { select: { name: true } },
          },
        },
      },
    }),
    prisma.reviewEventType.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (reviews.length === 0) return null;

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

  const souhrn = souhrnRozboru(
    reviews.map((r) => ({
      id: String(r.id),
      name: r.name,
      opponent: r.opponent,
      playedOnLabel: formatDateDdMmYyyy(r.playedOn),
      events: r.events.map((e) => ({
        id: String(e.id),
        typeId: String(e.typeId),
        atSeconds: e.atSeconds,
        playerId: e.playerId == null ? null : String(e.playerId),
        playerName: e.player?.name ?? null,
      })) satisfies StatEvent[],
    })),
    statTypes,
  );

  return mujSouhrn(souhrn, playerId);
}
