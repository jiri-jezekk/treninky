import {
  RatingView,
  type ChallengeRow,
  type DuelRow,
  type MatchRow,
} from "./RatingView";
import { getActiveSeason, getLeaderboard, getRatingHistory } from "@/lib/rating";
import { toDateInputValue } from "@/lib/prepaid";
import { formatDateDdMmYyyy } from "@/lib/date-display";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export default async function RatingPage() {
  const userId = await requireUserId();
  const season = await getActiveSeason(userId);
  const inSeason = season ? { seasonId: season.id } : {};

  const [board, duels, matches, challenges, players, history, trainings] =
    await Promise.all([
      getLeaderboard(userId, season),
      prisma.duel.findMany({
        where: { userId, ...inSeason },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 60,
        include: {
          challenger: { select: { name: true } },
          opponent: { select: { name: true } },
        },
      }),
      prisma.match.findMany({
        where: { userId, ...inSeason },
        orderBy: [{ closedAt: "asc" }, { playedOn: "desc" }],
        take: 40,
        include: {
          teams: {
            orderBy: { sortOrder: "asc" },
            include: { members: { include: { player: { select: { name: true } } } } },
          },
        },
      }),
      prisma.challenge.findMany({
        where: { userId, ...inSeason },
        orderBy: [{ closedAt: "asc" }, { endsOn: "desc" }],
        include: { entries: { include: { player: { select: { name: true } } } } },
      }),
      prisma.player.findMany({
        where: { userId, active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      getRatingHistory(userId, season),
      prisma.training.findMany({
        where: { userId, cancelled: false },
        orderBy: { startsAt: "desc" },
        take: 12,
        select: { id: true, startsAt: true },
      }),
    ]);

  const duelRows: DuelRow[] = duels.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    higherWins: d.higherWins,
    weightPercent: d.weightPercent,
    challengerName: d.challenger.name,
    opponentName: d.opponent.name,
    status: d.status,
    challengerValue: d.challengerValue,
    opponentValue: d.opponentValue,
    challengerDelta: d.challengerDelta,
    opponentDelta: d.opponentDelta,
    note: d.note,
  }));

  const matchRows: MatchRow[] = matches.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    weightPercent: m.weightPercent,
    playedOn: toDateInputValue(m.playedOn),
    closed: m.closedAt != null,
    teams: m.teams.map((t) => ({
      id: t.id,
      name: t.name,
      score: t.score,
      delta: t.delta,
      playerNames: t.members.map((mm) => mm.player.name),
    })),
  }));

  const challengeRows: ChallengeRow[] = challenges.map((c) => {
    // Pořadí se počítá stejně jako při uzavření — u času vede nižší číslo.
    const sorted = [...c.entries].sort((a, b) =>
      c.higherWins ? b.value - a.value : a.value - b.value,
    );
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      unit: c.unit,
      higherWins: c.higherWins,
      weightPercent: c.weightPercent,
      startsOn: toDateInputValue(c.startsOn),
      endsOn: toDateInputValue(c.endsOn),
      closed: c.closedAt != null,
      entries: sorted.map((e, i) => ({
        id: e.id,
        playerName: e.player.name,
        value: e.value,
        note: e.note,
        rank: i + 1,
      })),
    };
  });

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-extrabold uppercase tracking-wide text-slate-800 sm:text-3xl">
          Rating
        </h1>
        <div className="mt-3 h-1 w-14 rounded bg-club" />
        {season && (
          <p className="mt-3 font-heading text-sm font-bold text-slate-800">
            {season.name}
            <span className="ml-2 font-sans text-xs font-normal text-slate-500">
              do {toDateInputValue(season.endsOn)}
            </span>
          </p>
        )}
        <p className="mt-2 max-w-prose text-sm text-slate-600">
          Každý začíná na 1000. Rozhoduje rozdíl ratingů — kdo porazí výrazně
          silnějšího, získá hodně; kdo s ním prohraje, ztratí skoro nic. Váhy
          jdou po sobě: <b className="text-slate-700">duel 100 %</b>,{" "}
          <b className="text-slate-700">zápas 150 %</b>,{" "}
          <b className="text-slate-700">měsíční výzva 200 %</b>. Za každou účast —
          trénink i posilovnu — přibývá 1 bod.
        </p>
      </div>

      <RatingView
        board={board}
        duels={duelRows}
        matches={matchRows}
        challenges={challengeRows}
        players={players.map((p) => ({ id: p.id, name: p.name }))}
        trainings={trainings.map((t) => ({
          id: t.id,
          label: formatDateDdMmYyyy(t.startsAt),
        }))}
        history={history.map((h) => ({
          id: h.id,
          playerName: h.playerName,
          source: h.source,
          delta: h.delta,
          ratingAfter: h.ratingAfter,
          label: h.label,
          createdAt: formatDateDdMmYyyy(h.createdAt),
        }))}
        hasSeason={season != null}
        today={toDateInputValue(new Date())}
      />
    </div>
  );
}
