import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalGate } from "../../PortalGate";
import { PortalShell } from "../../PortalShell";
import { SessionRefresh } from "../../SessionRefresh";
import { ReviewReadOnly } from "@/components/ReviewReadOnly";
import { hasPortalSession } from "@/lib/player-portal-session";
import { getSharedReview } from "@/lib/reviews";
import { formatDateDdMmYyyy } from "@/lib/date-display";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Rozbor zápasu",
  robots: { index: false, follow: false },
};

/**
 * Rozbor v odkazu hráče — jen ke čtení.
 *
 * Sdílení se ověřuje na serveru: hráč, kterému rozbor nikdo nenasdílel,
 * dostane 404, ne cizí data. Klub se bere z tokenu, ne z id v cestě.
 */
export default async function PortalRozborDetailPage({
  params,
}: {
  params: Promise<{ token: string; id: string }>;
}) {
  const { token, id } = await params;

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

  const data = await getSharedReview(
    String(viewer.user.id),
    String(viewer.id),
    id,
  );
  if (!data) notFound();

  return (
    <PortalShell clubName={clubName} token={token}>
      <SessionRefresh payToken={token} />
      <div className="mx-auto w-full min-w-0 max-w-md">
        <Link
          href={`/p/${token}/rozbory`}
          className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4"
        >
          ← Rozbory
        </Link>
        <div className="mt-4">
          <ReviewReadOnly
            review={{
              name: data.review.name,
              opponent: data.review.opponent,
              playedOnLabel: formatDateDdMmYyyy(data.review.playedOn),
              videoId: data.review.videoId,
              notes: data.review.notes,
            }}
            types={data.types}
            events={data.events}
            comments={data.comments}
            reviewId={id}
            payToken={token}
            viewerId={String(viewer.id)}
          />
        </div>
      </div>
    </PortalShell>
  );
}
