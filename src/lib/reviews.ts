import { prisma } from "@/lib/prisma";
import type { StatEvent, StatType } from "@/lib/review-stats";
import { mujSouhrn, souhrnRozboru, type MujSouhrn } from "@/lib/review-summary";
import { formatDateDdMmYyyy, formatDateTimeDdMmYyyy24h } from "@/lib/date-display";
import type { Komentar } from "@/components/ReviewKomentare";

/**
 * Čtení rozborů pro hráčský portál.
 *
 * Dvě rozhodnutí, která platí tady a nikde jinde by se držet neměla:
 *
 * 1. **Rozbory vidí každý přihlášený hráč klubu.** Ruční sdílení po
 *    jednom se v praxi zapomínalo a hráč otevřel prázdný seznam. Klub
 *    se pořád bere z tokenu, ne z id v cestě — do cizího klubu se
 *    nikdo nepodívá.
 * 2. **Jména u zápisů dostane hráč jen u svých.** Rozbor má učit, ne
 *    ukazovat prstem. Ořezává se to tady, na serveru; kdyby se jména
 *    schovávala až v komponentě, stačilo by kouknout do zdroje stránky.
 */

/** Filtr seznamu rozborů. Prázdné pole neomezuje. */
export type FiltrRozboru = {
  groupId?: string | null;
  seasonId?: string | null;
};

/**
 * Podmínka pro hráčskou stranu. `visibleToPlayers` je tu vždycky:
 * rozbory cizích týmů si trenér dělá kvůli přípravě a hráčům do nich
 * nic není.
 */
function kde(userId: string, filtr?: FiltrRozboru) {
  return {
    userId,
    visibleToPlayers: true,
    ...(filtr?.groupId ? { groupId: filtr.groupId } : {}),
    ...(filtr?.seasonId ? { seasonId: filtr.seasonId } : {}),
  };
}

export type SharedReviewRow = {
  id: string;
  name: string;
  opponent: string | null;
  playedOn: Date;
  eventCount: number;
  groupName: string | null;
  groupColor: string | null;
  seasonName: string | null;
};

export async function listReviewsForPlayer(
  userId: string,
  filtr?: FiltrRozboru,
): Promise<SharedReviewRow[]> {
  const rows = await prisma.videoReview.findMany({
    where: kde(userId, filtr),
    orderBy: { playedOn: "desc" },
    include: {
      events: { select: { id: true } },
      group: { select: { name: true, color: true } },
      season: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: String(r.id),
    name: r.name,
    opponent: r.opponent,
    playedOn: r.playedOn,
    eventCount: r.events.length,
    groupName: r.group?.name ?? null,
    groupColor: r.group?.color ?? null,
    seasonName: r.season?.name ?? null,
  }));
}

/** Kolik rozborů klub má — podle toho se v portálu ukáže odkaz. */
export async function countReviewsForPlayer(userId: string): Promise<number> {
  return prisma.videoReview.count({ where: { userId, visibleToPlayers: true } });
}

/** Nabídka do filtru — jen to, co je u nějakého rozboru opravdu použité. */
export async function filtryRozboru(
  userId: string,
  /** Hráčská strana vidí jen zveřejněné rozbory — a jen z nich se má
   *  skládat i nabídka filtru, jinak by kategorie svítila naprázdno. */
  jenViditelne = false,
): Promise<{
  kategorie: { id: string; name: string; color: string }[];
  sezony: { id: string; name: string }[];
}> {
  const rows = await prisma.videoReview.findMany({
    where: { userId, ...(jenViditelne ? { visibleToPlayers: true } : {}) },
    select: {
      group: { select: { id: true, name: true, color: true, sortOrder: true } },
      season: { select: { id: true, name: true, startsOn: true } },
    },
  });

  const kategorie = new Map<
    string,
    { id: string; name: string; color: string; sortOrder: number }
  >();
  const sezony = new Map<string, { id: string; name: string; startsOn: Date }>();
  for (const r of rows) {
    if (r.group) {
      kategorie.set(String(r.group.id), {
        id: String(r.group.id),
        name: r.group.name,
        color: r.group.color,
        sortOrder: r.group.sortOrder,
      });
    }
    if (r.season) {
      sezony.set(String(r.season.id), {
        id: String(r.season.id),
        name: r.season.name,
        startsOn: r.season.startsOn,
      });
    }
  }

  return {
    kategorie: [...kategorie.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "cs"))
      .map(({ id, name, color }) => ({ id, name, color })),
    // Nejnovější sezóna první — na tu se kouká nejčastěji.
    sezony: [...sezony.values()]
      .sort((a, b) => b.startsOn.getTime() - a.startsOn.getTime())
      .map(({ id, name }) => ({ id, name })),
  };
}

export async function getReviewForPlayer(
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
    groupName: string | null;
    seasonName: string | null;
  };
  types: StatType[];
  events: (StatEvent & { note: string | null })[];
  comments: Komentar[];
} | null> {
  const review = await prisma.videoReview.findFirst({
    where: { id: reviewId, userId, visibleToPlayers: true },
    include: {
      events: { orderBy: { atSeconds: "asc" } },
      comments: { orderBy: { createdAt: "asc" } },
      group: { select: { name: true } },
      season: { select: { name: true } },
    },
  });
  if (!review) return null;

  const [types, jaSam] = await Promise.all([
    prisma.reviewEventType.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } }),
    prisma.player.findFirst({ where: { id: playerId, userId }, select: { name: true } }),
  ]);

  return {
    review: {
      name: review.name,
      opponent: review.opponent,
      playedOn: review.playedOn,
      videoId: review.videoId,
      notes: review.notes,
      groupName: review.group?.name ?? null,
      seasonName: review.season?.name ?? null,
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
    // Cizí zápisy zůstávají v týmových číslech, ale bez jmenovky.
    events: review.events.map((e) => {
      const moje = e.playerId != null && String(e.playerId) === playerId;
      return {
        id: String(e.id),
        typeId: String(e.typeId),
        atSeconds: e.atSeconds,
        playerId: moje ? playerId : null,
        playerName: moje ? (jaSam?.name ?? null) : null,
        note: e.note,
      };
    }),
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
 * Souhrn hráče napříč rozbory — jen jeho vlastní čísla.
 *
 * Cizí zápisy se počítají jako týmové (bez hráče), takže se odsud
 * nedá vyčíst, jak na tom byl kdokoli jiný.
 */
export async function getSummaryForPlayer(
  userId: string,
  playerId: string,
  filtr?: FiltrRozboru,
): Promise<MujSouhrn | null> {
  const [reviews, types, jaSam] = await Promise.all([
    prisma.videoReview.findMany({
      where: kde(userId, filtr),
      orderBy: { playedOn: "desc" },
      include: {
        events: { select: { id: true, typeId: true, atSeconds: true, playerId: true } },
      },
    }),
    prisma.reviewEventType.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } }),
    prisma.player.findFirst({ where: { id: playerId, userId }, select: { name: true } }),
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
      events: r.events.map((e) => {
        const moje = e.playerId != null && String(e.playerId) === playerId;
        return {
          id: String(e.id),
          typeId: String(e.typeId),
          atSeconds: e.atSeconds,
          playerId: moje ? playerId : null,
          playerName: moje ? (jaSam?.name ?? null) : null,
        };
      }) satisfies StatEvent[],
    })),
    statTypes,
  );

  return mujSouhrn(souhrn, playerId);
}
