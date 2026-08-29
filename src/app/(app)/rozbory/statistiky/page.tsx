import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import { HraciPodleAkci, RozpadAkci } from "@/components/ReviewBreakdown";
import { souhrnRozboru } from "@/lib/review-summary";
import type { StatEvent, StatType } from "@/lib/review-stats";
import { formatDateDdMmYyyy } from "@/lib/date-display";
import { czPlural } from "@/lib/czech";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

/**
 * Statistiky napříč rozbory.
 *
 * Jeden zápas říká, jak dopadl. Teprve pět zápasů ukáže, jestli se něco
 * lepší — a kvůli tomu se rozbory dělají. Počítá se stejnou funkcí jako
 * jednotlivý rozbor, aby čísla nemohla říkat každé něco jiného.
 */
export default async function RozboryStatistikyPage() {
  const userId = await requireUserId();

  const [reviews, types] = await Promise.all([
    prisma.videoReview.findMany({
      where: { userId },
      orderBy: { playedOn: "asc" },
      include: {
        events: {
          select: {
            id: true,
            typeId: true,
            atSeconds: true,
            playerId: true,
            player: { select: { name: true } },
          },
        },
      },
    }),
    prisma.reviewEventType.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } }),
  ]);

  const statTypes: StatType[] = types.map((t) => ({
    id: String(t.id),
    label: t.label,
    color: t.color,
    side: t.side,
    groupLabel: t.groupLabel,
    sortOrder: t.sortOrder,
    archived: t.archived,
  }));

  const souhrn = souhrnRozboru(
    reviews.map((r) => ({
      id: String(r.id),
      name: r.name,
      opponent: r.opponent,
      playedOnLabel: formatDateDdMmYyyy(r.playedOn),
      events: r.events.map((e) => ({
        id: String(e.id),
        typeId: String(e.typeId),
        atSeconds: e.atSeconds,
        playerId: e.playerId == null ? null : String(e.playerId),
        playerName: e.player?.name ?? null,
      })) satisfies StatEvent[],
    })),
    statTypes,
  );

  // Měřítko sloupců: nejhorší i nejlepší zápas se musí vejít.
  const nejvetsi = Math.max(1, ...souhrn.zapasy.map((z) => Math.abs(z.diff)));

  return (
    <div className="min-w-0 max-w-4xl">
      <Link
        href="/rozbory"
        className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4"
      >
        ‹ Rozbory
      </Link>

      <div className="mt-3">
        <PageHeader
          title="Statistiky rozborů"
          description="Všechny zápasy dohromady. Jeden rozbor řekne, jak dopadl zápas; tahle stránka ukáže, co se opakuje."
        />
      </div>

      {souhrn.pocetZapasu === 0 ? (
        <Panel>
          <p className="text-sm italic text-slate-500">
            Zatím není z čeho počítat — založ první rozbor.
          </p>
        </Panel>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <Panel className="!p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
              <span className="font-heading text-[11px] font-bold uppercase tracking-[0.06em] text-slate-700">
                Zápas po zápase
              </span>
              <span className="text-xs text-slate-500">
                {souhrn.pocetZapasu}{" "}
                {czPlural(souhrn.pocetZapasu, "zápas", "zápasy", "zápasů")} od nejstaršího
              </span>
            </div>

            <ul className="divide-y divide-slate-100">
              {souhrn.zapasy.map((z) => (
                <li key={z.id}>
                  <Link
                    href={`/rozbory/${z.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-club-soft sm:px-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {z.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {z.opponent ? `${z.opponent} · ` : ""}
                        {z.playedOnLabel} · {z.forCount}–{z.againstCount}
                      </span>
                    </span>

                    {/* Sloupec od středu: doprava navrch, doleva ztráta.
                        Trend se čte rychleji než sloupec čísel. */}
                    <span
                      aria-hidden
                      className="relative hidden h-4 w-32 shrink-0 sm:block"
                    >
                      <span className="absolute inset-y-0 left-1/2 w-px bg-slate-200" />
                      <span
                        className={`absolute top-1/2 h-2 -translate-y-1/2 rounded-sm ${
                          z.diff >= 0 ? "bg-emerald-800/70" : "bg-red-800/70"
                        }`}
                        style={{
                          left: z.diff >= 0 ? "50%" : undefined,
                          right: z.diff < 0 ? "50%" : undefined,
                          width: `${(Math.abs(z.diff) / nejvetsi) * 50}%`,
                        }}
                      />
                    </span>

                    <span
                      className={`w-10 shrink-0 text-right font-heading text-sm font-bold tabular-nums ${
                        z.diff > 0
                          ? "text-emerald-800"
                          : z.diff < 0
                            ? "text-red-800"
                            : "text-slate-600"
                      }`}
                    >
                      {z.diff > 0 ? `+${z.diff}` : z.diff}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <div className="mb-3 font-heading text-[11px] font-bold uppercase tracking-[0.06em] text-slate-700">
              Rozpad akcí za všechny zápasy
            </div>
            <RozpadAkci stats={souhrn.celkem} />
          </Panel>

          <Panel>
            <div className="mb-3 font-heading text-[11px] font-bold uppercase tracking-[0.06em] text-slate-700">
              Hráči podle akcí
            </div>
            <HraciPodleAkci stats={souhrn.celkem} />
          </Panel>
        </div>
      )}
    </div>
  );
}
