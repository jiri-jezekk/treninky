import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalGate } from "../PortalGate";
import { PortalShell } from "../PortalShell";
import { SessionRefresh } from "../SessionRefresh";
import { FiltrRozboruChips } from "@/components/FiltrRozboruChips";
import { hasPortalSession } from "@/lib/player-portal-session";
import {
  filtryRozboru,
  getSummaryForPlayer,
  listReviewsForPlayer,
} from "@/lib/reviews";
import { formatDateDdMmYyyy } from "@/lib/date-display";
import { czPlural } from "@/lib/czech";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Rozbory zápasů",
  robots: { index: false, follow: false },
};

/**
 * Rozbory klubu — jen ke čtení.
 *
 * Vidí je každý přihlášený hráč. Klub se bere z tokenu, ne z id v cestě,
 * takže do cizího klubu se nikdo nedostane. Souhrn nahoře je vždycky
 * jen vlastní: kdo co pokazil, řeší trenér, ne výpis pro celý tým.
 */
export default async function PortalRozboryPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ kategorie?: string; sezona?: string }>;
}) {
  const { token } = await params;
  const { kategorie: groupId, sezona: seasonId } = await searchParams;

  const player = await prisma.player.findUnique({
    where: { payToken: token },
    select: {
      id: true,
      name: true,
      passwordHash: true,
      seesReviews: true,
      user: { select: { id: true, clubName: true } },
    },
  });
  if (!player) notFound();

  const clubName = player.user.clubName?.trim() || "DC Liberec";

  if (!player.passwordHash) {
    return (
      <PortalShell clubName={clubName} token={token}>
        <PortalGate payToken={token} mode="set" playerName={player.name} />
      </PortalShell>
    );
  }
  if (!(await hasPortalSession(token))) {
    return (
      <PortalShell clubName={clubName} token={token}>
        <PortalGate payToken={token} mode="enter" playerName={player.name} />
      </PortalShell>
    );
  }

  // Přístup se ověřuje po přihlášení, ne před ním — jinak by hráč
  // nepoznal, jestli má špatné heslo, nebo mu to trenér zavřel.
  if (!player.seesReviews) {
    return (
      <PortalShell clubName={clubName} token={token}>
        <SessionRefresh payToken={token} />
        <div className="mx-auto w-full min-w-0 max-w-md">
          <Link
            href={`/p/${token}`}
            className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4"
          >
            ← Můj profil
          </Link>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
            <p className="text-sm text-slate-600">
              Rozbory zápasů zatím nemáš zpřístupněné. Kdybys je chtěl vidět,
              řekni trenérovi — zapne ti to.
            </p>
          </div>
        </div>
      </PortalShell>
    );
  }

  const filtr = { groupId, seasonId };
  const [reviews, souhrn, nabidka] = await Promise.all([
    listReviewsForPlayer(String(player.user.id), filtr),
    getSummaryForPlayer(String(player.user.id), String(player.id), filtr),
    filtryRozboru(String(player.user.id)),
  ]);

  return (
    <PortalShell clubName={clubName} token={token}>
      <SessionRefresh payToken={token} />
      <div className="mx-auto w-full min-w-0 max-w-md">
        <Link
          href={`/p/${token}`}
          className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4"
        >
          ← Můj profil
        </Link>

        {/* Napříč zápasy: jeden rozbor řekne, jak dopadl, tohle ukáže,
            co se opakuje. Jen vlastní čísla. */}
        {souhrn && souhrn.zapisu > 0 && (
          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
              Tvůj souhrn
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Počítáno z rozborů ve výběru ({souhrn.zapasu}).
            </p>

            <dl className="mt-3 grid grid-cols-3 gap-2.5">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <dt className="font-heading text-[10.5px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  Pro nás
                </dt>
                <dd className="mt-0.5 font-heading text-lg font-bold tabular-nums text-emerald-800">
                  {souhrn.forCount}
                </dd>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <dt className="font-heading text-[10.5px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  Proti nám
                </dt>
                <dd className="mt-0.5 font-heading text-lg font-bold tabular-nums text-red-800">
                  {souhrn.againstCount}
                </dd>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <dt className="font-heading text-[10.5px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  Rozdíl
                </dt>
                <dd className="mt-0.5 font-heading text-lg font-bold tabular-nums text-slate-900">
                  {souhrn.diff > 0 ? `+${souhrn.diff}` : souhrn.diff}
                </dd>
              </div>
            </dl>

            <ul className="mt-3 flex flex-col gap-1.5">
              {souhrn.akce.map((a) => (
                <li key={a.label} className="flex items-center gap-2.5">
                  <i
                    aria-hidden
                    style={{ background: a.color }}
                    className="inline-block h-1.5 w-1.5 shrink-0 rotate-45 rounded-[2px]"
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-slate-700">
                    {a.label}
                  </span>
                  <span className="shrink-0 font-heading text-sm font-bold tabular-nums text-slate-800">
                    {a.count}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h1 className="font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
            Rozbory zápasů
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Co trenér nakoukal z videa. Časy otevřou záznam na správném místě.
          </p>

          <div className="mt-3">
            <FiltrRozboruChips
              zaklad={`/p/${token}/rozbory`}
              kategorie={nabidka.kategorie}
              sezony={nabidka.sezony}
              groupId={groupId}
              seasonId={seasonId}
            />
          </div>

          {reviews.length === 0 ? (
            <p className="mt-4 text-sm italic text-slate-500">
              {groupId || seasonId
                ? "V tomhle výběru zatím žádný rozbor není."
                : "Zatím tu žádný rozbor není."}
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
                        {r.groupName ? ` · ${r.groupName}` : ""}
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
