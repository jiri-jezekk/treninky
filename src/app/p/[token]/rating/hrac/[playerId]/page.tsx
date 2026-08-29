import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalGate } from "../../../PortalGate";
import { SessionRefresh } from "../../../SessionRefresh";
import { PlayerProfile } from "@/components/PlayerProfile";
import { hasPortalSession } from "@/lib/player-portal-session";
import { getActiveSeason, getPlayerActivity } from "@/lib/rating";
import { formatDateDdMmYyyy } from "@/lib/date-display";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Profil hráče",
  robots: { index: false, follow: false },
};

/**
 * Profil spoluhráče v odkazu hráče.
 *
 * Dřív byl pod žebříčkem jeden dlouhý výpis změn celého týmu, ve kterém
 * nešlo nic najít a kvůli kterému stránka neměla konce. Teď se klikne
 * na jméno v žebříčku a otevře se aktivita toho jednoho hráče.
 *
 * Vidět se dá jen spoluhráč ze stejného klubu — přístup se odvozuje od
 * tokenu v adrese, ne od id v cestě, jinak by šlo přes cizí id nahlédnout
 * do jiného klubu.
 */
export default async function PortalPlayerProfilePage({
  params,
}: {
  params: Promise<{ token: string; playerId: string }>;
}) {
  const { token, playerId } = await params;

  const viewer = await prisma.player.findUnique({
    where: { payToken: token },
    select: {
      id: true,
      name: true,
      passwordHash: true,
      user: { select: { id: true, clubName: true } },
    },
  });
  if (!viewer) notFound();

  const clubName = viewer.user.clubName?.trim() || "DC Liberec";

  // Stejné dveře jako na hlavní stránce odkazu — bez hesla se dovnitř
  // nedostane nikdo, kdo si jen tipne cizí id v adrese.
  if (!viewer.passwordHash) {
    return (
      <Shell clubName={clubName}>
        <PortalGate payToken={token} mode="set" playerName={viewer.name} />
      </Shell>
    );
  }
  if (!(await hasPortalSession(token))) {
    return (
      <Shell clubName={clubName}>
        <PortalGate payToken={token} mode="enter" playerName={viewer.name} />
      </Shell>
    );
  }

  const userId = String(viewer.user.id);
  const season = await getActiveSeason(userId);
  const profile = await getPlayerActivity(userId, season, playerId);
  if (!profile) notFound();

  return (
    <Shell clubName={clubName}>
      <SessionRefresh payToken={token} />
      <div className="mx-auto w-full max-w-md">
        <Link
          href={`/p/${token}/rating`}
          className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4"
        >
          ← Žebříček
        </Link>
        <div className="mt-4">
          <PlayerProfile
            profile={{
              ...profile,
              entries: profile.entries.map((e) => ({
                ...e,
                when: formatDateDdMmYyyy(e.createdAt).slice(0, 5),
              })),
              solos: profile.solos.map((s) => ({
                id: s.id,
                name: s.name,
                when: formatDateDdMmYyyy(s.performedOn).slice(0, 5),
              })),
            }}
          />
        </div>
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
