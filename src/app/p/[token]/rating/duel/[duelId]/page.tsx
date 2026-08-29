import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalGate } from "../../../PortalGate";
import { SessionRefresh } from "../../../SessionRefresh";
import { DuelDetail } from "@/components/DuelDetail";
import { hasPortalSession } from "@/lib/player-portal-session";
import { getDuelDetail } from "@/lib/rating";
import { formatDateDdMmYyyy } from "@/lib/date-display";
import { prisma } from "@/lib/prisma";
import { PortalShell } from "../../../PortalShell";

export const metadata: Metadata = {
  title: "Detail duelu",
  robots: { index: false, follow: false },
};

/**
 * Detail duelu v odkazu hráče.
 *
 * Klub se bere z tokenu, ne z id v cestě — jinak by šlo přes cizí id
 * nahlédnout do jiného klubu.
 */
export default async function PortalDuelDetailPage({
  params,
}: {
  params: Promise<{ token: string; duelId: string }>;
}) {
  const { token, duelId } = await params;

  const viewer = await prisma.player.findUnique({
    where: { payToken: token },
    select: {
      name: true,
      passwordHash: true,
      user: { select: { id: true, clubName: true } },
    },
  });
  if (!viewer) notFound();

  const clubName = viewer.user.clubName?.trim() || "DC Liberec";

  if (!viewer.passwordHash) {
    return (
      <PortalShell clubName={clubName} token={token}>
        <PortalGate payToken={token} mode="set" playerName={viewer.name} />
      </PortalShell>
    );
  }
  if (!(await hasPortalSession(token))) {
    return (
      <PortalShell clubName={clubName} token={token}>
        <PortalGate payToken={token} mode="enter" playerName={viewer.name} />
      </PortalShell>
    );
  }

  const duel = await getDuelDetail(String(viewer.user.id), duelId);
  if (!duel) notFound();

  return (
    <PortalShell clubName={clubName} token={token}>
      <SessionRefresh payToken={token} />
      <div className="mx-auto w-full max-w-md">
        <Link
          href={`/p/${token}/rating`}
          className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4"
        >
          ← Rating
        </Link>
        <div className="mt-4">
          <DuelDetail
            duel={{
              ...duel,
              when: formatDateDdMmYyyy(duel.createdAt),
              confirmedWhen:
                duel.confirmedAt == null
                  ? null
                  : formatDateDdMmYyyy(duel.confirmedAt),
            }}
          />
        </div>
      </div>
    </PortalShell>
  );
}
