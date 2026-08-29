import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalGate } from "../PortalGate";
import { SessionRefresh } from "../SessionRefresh";
import { PortalRating, type PortalDuel } from "./PortalRating";
import { hasPortalSession } from "@/lib/player-portal-session";
import {
  getActiveSeason,
  getEffectiveRatings,
  getLeaderboard,
} from "@/lib/rating";
import { duelOutcome } from "@/lib/elo";
import { standings, type Attempt } from "@/lib/challenge-attempts";
import { toDateInputValue } from "@/lib/prepaid";
import { formatDateDdMmYyyy } from "@/lib/date-display";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Rating a duely",
  robots: { index: false, follow: false },
};

export default async function PortalRatingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const player = await prisma.player.findUnique({
    where: { payToken: token },
    select: {
      id: true,
      name: true,
      passwordHash: true,
      inRating: true,
      user: { select: { id: true, clubName: true } },
    },
  });
  if (!player) notFound();

  const clubName = player.user.clubName?.trim() || "DC Liberec";

  if (!player.passwordHash) {
    return (
      <Shell clubName={clubName}>
        <PortalGate payToken={token} mode="set" playerName={player.name} />
      </Shell>
    );
  }
  if (!(await hasPortalSession(token))) {
    return (
      <Shell clubName={clubName}>
        <PortalGate payToken={token} mode="enter" playerName={player.name} />
      </Shell>
    );
  }

  const userId = String(player.user.id);
  const me = String(player.id);

  const season = await getActiveSeason(userId);

  const [board, duels, players, challenges, solos] = await Promise.all([
    getLeaderboard(userId, season),
    prisma.duel.findMany({
      where: {
        userId,
        ...(season && { seasonId: season.id }),
        OR: [{ challengerId: me }, { opponentId: me }],
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 30,
      include: {
        challenger: { select: { id: true, name: true } },
        opponent: { select: { id: true, name: true } },
      },
    }),
    prisma.player.findMany({
      where: { userId, active: true, id: { not: me } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.challenge.findMany({
      where: { userId, closedAt: null, ...(season && { seasonId: season.id }) },
      orderBy: { endsOn: "asc" },
      include: {
        // Všechny pokusy všech hráčů, ne jen moje číslo — pořadí ve
        // výzvě mají vidět všichni.
        entries: { include: { player: { select: { name: true } } } },
      },
    }),
    prisma.soloSession.findMany({
      where: {
        playerId: me,
        ...(season && {
          performedOn: { gte: season.startsOn, lte: season.endsOn },
        }),
      },
      orderBy: { performedOn: "desc" },
      take: 10,
    }),
  ]);

  // Náhled u zapsaných, ale nepotvrzených duelů — hráč musí před
  // odklepnutím vidět, kolik to komu udělá.
  const previewRatings = await getEffectiveRatings(
    duels
      .filter((d) => d.status === "REPORTED")
      .flatMap((d) => [String(d.challengerId), String(d.opponentId)]),
    season,
  );

  const myDuels: PortalDuel[] = duels.map((d) => {
    const iAmChallenger = String(d.challengerId) === me;

    let preview: PortalDuel["preview"] = null;
    if (
      d.status === "REPORTED" &&
      d.challengerValue != null &&
      d.opponentValue != null
    ) {
      const o = duelOutcome({
        ratingChallenger: previewRatings.get(String(d.challengerId)) ?? 1000,
        ratingOpponent: previewRatings.get(String(d.opponentId)) ?? 1000,
        challengerValue: d.challengerValue,
        opponentValue: d.opponentValue,
        higherWins: d.higherWins,
        weightPercent: d.weightPercent,
      });
      preview = {
        myDelta: iAmChallenger ? o.challengerDelta : o.opponentDelta,
        theirDelta: iAmChallenger ? o.opponentDelta : o.challengerDelta,
        iWin:
          o.challengerWins == null
            ? null
            : iAmChallenger
              ? o.challengerWins
              : !o.challengerWins,
      };
    }

    return {
      id: d.id,
      name: d.name,
      description: d.description,
      status: d.status,
      iAmChallenger,
      opponentName: iAmChallenger ? d.opponent.name : d.challenger.name,
      myValue: iAmChallenger ? d.challengerValue : d.opponentValue,
      theirValue: iAmChallenger ? d.opponentValue : d.challengerValue,
      myDelta: iAmChallenger ? d.challengerDelta : d.opponentDelta,
      // Kdo výsledek zapsal, ten ho nemůže sám potvrdit.
      iReported: d.reportedById != null && String(d.reportedById) === me,
      measure: d.measure,
      note: d.note,
      higherWins: d.higherWins,
      preview,
    };
  });

  const myRow = board.find((r) => r.playerId === me);

  return (
    <Shell clubName={clubName}>
      <SessionRefresh payToken={token} />
      <div className="mx-auto w-full max-w-md">
        <Link
          href={`/p/${token}`}
          className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4"
        >
          ← Moje platby
        </Link>

        <PortalRating
          payToken={token}
          myName={player.name}
          myRating={myRow?.rating ?? null}
          myRank={myRow?.rank ?? null}
          myBand={myRow?.band ?? null}
          seasonName={season?.name ?? null}
          board={board.map((r) => ({
            playerId: r.playerId,
            playerName: r.playerName,
            rating: r.rating,
            rank: r.rank,
            isMe: r.playerId === me,
          }))}
          duels={myDuels}
          opponents={players.map((p) => ({ id: p.id, name: p.name }))}
          challenges={challenges.map((c) => {
            // Stejná funkce jako v aplikaci trenéra i při vyhodnocení,
            // aby pořadí bylo všude stejné.
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
            const mine = poradi.find((r) => r.playerId === me);

            return {
              id: c.id,
              name: c.name,
              description: c.description,
              unit: c.unit,
              higherWins: c.higherWins,
              measure: c.measure,
              endsOn: toDateInputValue(c.endsOn),
              standings: poradi.map((r) => ({
                playerId: r.playerId,
                playerName: r.playerName,
                best: r.best,
                rank: r.rank,
                improvement: r.improvement,
                isMe: r.playerId === me,
              })),
              myAttempts: (mine?.attempts ?? []).map((a) => ({
                id: a.id,
                value: a.value,
                when: formatDateDdMmYyyy(a.createdAt).slice(0, 5),
                isBest: a.id === mine?.bestAttemptId,
              })),
            };
          })}
          inRating={player.inRating}
          today={toDateInputValue(new Date())}
          solos={solos.map((so) => ({
            id: so.id,
            name: so.name,
            performedOn: toDateInputValue(so.performedOn),
          }))}
        />
      </div>
    </Shell>
  );
}

function Shell({
  clubName,
  children,
}: {
  clubName: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-10">
      <p className="mb-6 font-heading text-sm font-extrabold uppercase tracking-[0.2em] text-club">
        {clubName}
      </p>
      {children}
    </main>
  );
}
