import { RatingView, type ChallengeRow, type DisciplineRow, type DuelRow } from "./RatingView";
import { getLeaderboard } from "@/lib/rating";
import { toDateInputValue } from "@/lib/prepaid";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export default async function RatingPage() {
  const userId = await requireUserId();

  const [board, disciplines, duels, challenges, players] = await Promise.all([
    getLeaderboard(userId),
    prisma.discipline.findMany({
      where: { userId },
      orderBy: [{ archived: "asc" }, { name: "asc" }],
    }),
    prisma.duel.findMany({
      where: { userId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 60,
      include: {
        discipline: { select: { name: true, unit: true, higherWins: true } },
        challenger: { select: { name: true } },
        opponent: { select: { name: true } },
      },
    }),
    prisma.challenge.findMany({
      where: { userId },
      orderBy: [{ closedAt: "asc" }, { endsOn: "desc" }],
      include: {
        entries: {
          orderBy: { value: "desc" },
          include: { player: { select: { name: true } } },
        },
      },
    }),
    prisma.player.findMany({
      where: { userId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const duelRows: DuelRow[] = duels.map((d) => ({
    id: d.id,
    discipline: d.discipline.name,
    unit: d.discipline.unit,
    challengerName: d.challenger.name,
    opponentName: d.opponent.name,
    status: d.status,
    challengerValue: d.challengerValue,
    opponentValue: d.opponentValue,
    challengerDelta: d.challengerDelta,
    opponentDelta: d.opponentDelta,
    note: d.note,
    createdAt: d.createdAt.toISOString(),
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

  const disciplineRows: DisciplineRow[] = disciplines.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    unit: d.unit,
    higherWins: d.higherWins,
    archived: d.archived,
  }));

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-extrabold uppercase tracking-wide text-slate-800 sm:text-3xl">
          Rating
        </h1>
        <div className="mt-3 h-1 w-14 rounded bg-club" />
        <p className="mt-3 max-w-prose text-sm text-slate-600">
          Každý začíná na 1000. Rozhoduje rozdíl ratingů, ne absolutní číslo —
          kdo porazí výrazně silnějšího, získá hodně; kdo s ním prohraje,
          ztratí skoro nic. Za odchozený trénink přibývá{" "}
          <span className="text-slate-800">1 bod</span>.
        </p>
      </div>

      <RatingView
        board={board}
        duels={duelRows}
        challenges={challengeRows}
        disciplines={disciplineRows}
        players={players.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}
