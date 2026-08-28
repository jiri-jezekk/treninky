import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalGate } from "../PortalGate";
import { SessionRefresh } from "../SessionRefresh";
import { PortalRating, type PortalDuel } from "./PortalRating";
import { hasPortalSession } from "@/lib/player-portal-session";
import { getActiveSeason, getLeaderboard } from "@/lib/rating";
import { toDateInputValue } from "@/lib/prepaid";
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

  const [board, duels, disciplines, players, challenges] = await Promise.all([
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
        discipline: { select: { name: true, unit: true } },
        challenger: { select: { id: true, name: true } },
        opponent: { select: { id: true, name: true } },
      },
    }),
    prisma.discipline.findMany({
      where: { userId, archived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, unit: true },
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
        entries: {
          where: { playerId: me },
          select: { value: true },
        },
      },
    }),
  ]);

  const myDuels: PortalDuel[] = duels.map((d) => {
    const iAmChallenger = String(d.challengerId) === me;
    return {
      id: d.id,
      discipline: d.discipline.name,
      unit: d.discipline.unit,
      status: d.status,
      iAmChallenger,
      opponentName: iAmChallenger ? d.opponent.name : d.challenger.name,
      myValue: iAmChallenger ? d.challengerValue : d.opponentValue,
      theirValue: iAmChallenger ? d.opponentValue : d.challengerValue,
      myDelta: iAmChallenger ? d.challengerDelta : d.opponentDelta,
      // Kdo výsledek zapsal, ten ho nemůže sám potvrdit.
      iReported: d.reportedById != null && String(d.reportedById) === me,
      note: d.note,
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
          disciplines={disciplines.map((d) => ({
            id: d.id,
            name: d.name,
            unit: d.unit,
          }))}
          opponents={players.map((p) => ({ id: p.id, name: p.name }))}
          challenges={challenges.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            unit: c.unit,
            endsOn: toDateInputValue(c.endsOn),
            myValue: c.entries[0]?.value ?? null,
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
