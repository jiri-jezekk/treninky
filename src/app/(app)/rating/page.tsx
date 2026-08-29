import {
  RatingView,
  type ChallengeRow,
  type DuelRow,
  type MatchRow,
} from "./RatingView";
import {
  getActiveSeason,
  getEffectiveRatings,
  getLeaderboard,
  getRatingHistory,
  getSoloSessions,
} from "@/lib/rating";
import { duelOutcome, matchPlayerDeltas } from "@/lib/elo";
import { standings, type Attempt } from "@/lib/challenge-attempts";
import { toDateInputValue } from "@/lib/prepaid";
import { formatDateDdMmYyyy } from "@/lib/date-display";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export default async function RatingPage() {
  const userId = await requireUserId();
  const season = await getActiveSeason(userId);
  const inSeason = season ? { seasonId: season.id } : {};

  const [board, duels, matches, challenges, players, history, trainings, solos] =
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
        // Nevyhodnocené nahoru. Bez `nulls: "first"` je Postgres při
        // vzestupném řazení strká nakonec a hotové zápasy je zakryly.
        orderBy: [
          { closedAt: { sort: "asc", nulls: "first" } },
          { playedOn: "desc" },
        ],
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
        // Totéž u výzev — běžící patří nad uzavřené.
        orderBy: [
          { closedAt: { sort: "asc", nulls: "first" } },
          { endsOn: "desc" },
        ],
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
      getSoloSessions(userId, season),
    ]);

  // Náhled „co se stane, když potvrdíš“ — u zapsaných, ale ještě
  // nepotvrzených duelů. Bez toho není při potvrzování poznat,
  // kdo kolik dostane.
  const ratingsForPreview = await getEffectiveRatings(
    duels
      .filter((d) => d.status === "REPORTED")
      .flatMap((d) => [String(d.challengerId), String(d.opponentId)]),
    season,
  );

  const duelRows: DuelRow[] = duels.map((d) => {
    let preview: DuelRow["preview"] = null;
    if (
      d.status === "REPORTED" &&
      d.challengerValue != null &&
      d.opponentValue != null
    ) {
      const o = duelOutcome({
        ratingChallenger: ratingsForPreview.get(String(d.challengerId)) ?? 1000,
        ratingOpponent: ratingsForPreview.get(String(d.opponentId)) ?? 1000,
        challengerValue: d.challengerValue,
        opponentValue: d.opponentValue,
        higherWins: d.higherWins,
        weightPercent: d.weightPercent,
      });
      preview = {
        challengerDelta: o.challengerDelta,
        opponentDelta: o.opponentDelta,
        challengerWins: o.challengerWins,
      };
    }
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      higherWins: d.higherWins,
      measure: d.measure,
      weightPercent: d.weightPercent,
      challengerName: d.challenger.name,
      opponentName: d.opponent.name,
      status: d.status,
      challengerValue: d.challengerValue,
      opponentValue: d.opponentValue,
      challengerDelta: d.challengerDelta,
      opponentDelta: d.opponentDelta,
      note: d.note,
      preview,
    };
  });

  // Náhled u zápasů, které ještě nejsou vyhodnocené: kdo kolik dostane.
  // Bez toho bylo tlačítko „Vyhodnotit“ skok do tmy — rating se rozdal
  // a teprve pak bylo vidět kolik komu.
  const openMatches = matches.filter((m) => m.closedAt == null);
  const matchRatings = await getEffectiveRatings(
    openMatches.flatMap((m) =>
      m.teams.flatMap((t) => t.members.map((mm) => String(mm.playerId))),
    ),
    season,
  );

  const matchRows: MatchRow[] = matches.map((m) => {
    // Stejná funkce jako při vyhodnocení, aby náhled a skutečnost
    // nemohly říct každý něco jiného. Každý hráč má svou změnu —
    // slabší v týmu získá za výhru víc než jeho silnější spoluhráč.
    const outcome =
      m.closedAt == null && m.teams.length >= 2
        ? matchPlayerDeltas(
            m.teams.map((t) => ({
              teamId: String(t.id),
              score: t.score,
              players: t.members.map((mm) => ({
                playerId: String(mm.playerId),
                rating: matchRatings.get(String(mm.playerId)) ?? 1000,
              })),
            })),
            m.weightPercent,
          )
        : null;
    const byTeam = outcome ? new Map(outcome.map((o) => [o.teamId, o])) : null;

    return {
      id: m.id,
      name: m.name,
      description: m.description,
      weightPercent: m.weightPercent,
      playedOn: toDateInputValue(m.playedOn),
      closed: m.closedAt != null,
      teams: m.teams.map((t) => {
        const o = byTeam?.get(String(t.id)) ?? null;
        const deltaByPlayer = new Map(
          (o?.players ?? []).map((p) => [p.playerId, p.delta]),
        );
        return {
          id: t.id,
          name: t.name,
          score: t.score,
          delta: t.delta,
          rating: o?.rating ?? null,
          rank: o?.rank ?? null,
          players: t.members.map((mm) => ({
            playerId: String(mm.playerId),
            name: mm.player.name,
            previewDelta: deltaByPlayer.get(String(mm.playerId)) ?? null,
          })),
        };
      }),
    };
  });

  const challengeRows: ChallengeRow[] = challenges.map((c) => {
    // Stejná funkce jako při uzavření — u času vede nižší číslo a do
    // pořadí jde nejlepší pokus, ne poslední.
    const poradi = standings(
      c.entries.map(
        (e): Attempt => ({
          id: String(e.id),
          playerId: String(e.playerId),
          playerName: e.player.name,
          value: e.value,
          note: e.note,
          createdAt: e.createdAt,
        }),
      ),
      c.higherWins,
    );

    return {
      id: c.id,
      name: c.name,
      description: c.description,
      unit: c.unit,
      higherWins: c.higherWins,
      measure: c.measure,
      weightPercent: c.weightPercent,
      startsOn: toDateInputValue(c.startsOn),
      endsOn: toDateInputValue(c.endsOn),
      closed: c.closedAt != null,
      attemptCount: c.entries.length,
      standings: poradi.map((r) => ({
        playerId: r.playerId,
        playerName: r.playerName,
        best: r.best,
        bestAttemptId: r.bestAttemptId,
        rank: r.rank,
        improvement: r.improvement,
        attempts: r.attempts.map((a) => ({
          id: a.id,
          value: a.value,
          note: a.note,
          when: formatDateDdMmYyyy(a.createdAt).slice(0, 5),
        })),
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
          <b className="text-slate-700">měsíční výzva 200 %</b>. Za každý trénink
          je +1 (klubový, individuální).
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
        solos={solos.map((so) => ({
          id: so.id,
          playerName: so.playerName,
          name: so.name,
          performedOn: formatDateDdMmYyyy(so.performedOn),
        }))}
        hasSeason={season != null}
        today={toDateInputValue(new Date())}
      />
    </div>
  );
}
