import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalGate } from "../PortalGate";
import { PortalShell } from "../PortalShell";
import { SessionRefresh } from "../SessionRefresh";
import { hasPortalSession } from "@/lib/player-portal-session";
import { listSharedReviews } from "@/lib/reviews";
import { formatDateDdMmYyyy } from "@/lib/date-display";
import { czPlural } from "@/lib/czech";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Rozbory zápasů",
  robots: { index: false, follow: false },
};

/** Rozbory, které trenér nasdílel — jen ke čtení. */
export default async function PortalRozboryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

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

  const reviews = await listSharedReviews(
    String(viewer.user.id),
    String(viewer.id),
  );

  return (
    <PortalShell clubName={clubName} token={token}>
      <SessionRefresh payToken={token} />
      <div className="mx-auto w-full min-w-0 max-w-md">
        <Link
          href={`/p/${token}`}
          className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4"
        >
          ← Moje platby
        </Link>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h1 className="font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
            Rozbory zápasů
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Co trenér nakoukal z videa. Časy otevřou záznam na správném místě.
          </p>

          {reviews.length === 0 ? (
            <p className="mt-4 text-sm italic text-slate-500">
              Zatím ti nikdo žádný rozbor nenasdílel.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {reviews.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/p/${token}/rozbory/${r.id}`}
                    className="flex items-center gap-3 py-2.5 transition hover:bg-club-soft"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {r.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {r.opponent ? `${r.opponent} · ` : ""}
                        {formatDateDdMmYyyy(r.playedOn)} · {r.eventCount}{" "}
                        {czPlural(r.eventCount, "zápis", "zápisy", "zápisů")}
                      </span>
                    </span>
                    <span aria-hidden className="shrink-0 text-slate-400">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PortalShell>
  );
}
