import Link from "next/link";
import { PageHeader, Panel } from "@/components/ui";
import { RozboryActions } from "./RozboryList";
import { ensureDefaultEventTypes } from "@/actions/rozbory";
import { computeStats, type StatEvent, type StatType } from "@/lib/review-stats";
import { formatDateDdMmYyyy } from "@/lib/date-display";
import { czPlural } from "@/lib/czech";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export default async function RozboryPage() {
  const userId = await requireUserId();

  // Bez tlačítek by byla stránka k ničemu a nutit trenéra, aby si je
  // nejdřív vymyslel, je zbytečná překážka.
  await ensureDefaultEventTypes(userId);

  const [reviews, types] = await Promise.all([
    prisma.videoReview.findMany({
      where: { userId },
      orderBy: { playedOn: "desc" },
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
        shares: { select: { playerId: true } },
      },
    }),
    prisma.reviewEventType.findMany({
      where: { userId },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const statTypes: StatType[] = types.map((t) => ({
    id: String(t.id),
    label: t.label,
    color: t.color,
    side: t.side,
    sortOrder: t.sortOrder,
    archived: t.archived,
  }));

  // Tabulka napříč rozbory — stejná funkce jako v detailu, aby čísla
  // nemohla říkat každé něco jiného.
  const vsechny: StatEvent[] = reviews.flatMap((r) =>
    r.events.map((e) => ({
      id: String(e.id),
      typeId: String(e.typeId),
      atSeconds: e.atSeconds,
      playerId: e.playerId == null ? null : String(e.playerId),
      playerName: e.player?.name ?? null,
    })),
  );
  const napric = computeStats(vsechny, statTypes);

  const rows = reviews.map((r) => {
    const s = computeStats(
      r.events.map((e) => ({
        id: String(e.id),
        typeId: String(e.typeId),
        atSeconds: e.atSeconds,
        playerId: e.playerId == null ? null : String(e.playerId),
        playerName: e.player?.name ?? null,
      })),
      statTypes,
    );
    return {
      id: String(r.id),
      name: r.name,
      opponent: r.opponent,
      playedOn: formatDateDdMmYyyy(r.playedOn),
      hasVideo: r.videoId != null,
      eventCount: r.events.length,
      forCount: s.balance.forCount,
      againstCount: s.balance.againstCount,
      shareCount: r.sharedAll ? -1 : r.shares.length,
    };
  });

  return (
    <div className="min-w-0 max-w-5xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <PageHeader
            title="Rozbory"
            description="Zápasy nakoukané z videa. Klikáním se zapisují akce s přesným časem, takže se k nim tým může vrátit a nemusí video hledat znovu."
          />
        </div>
        <div className="shrink-0">
          <RozboryActions
            types={statTypes.filter((t) => !t.archived)}
            today={new Date().toISOString().slice(0, 10)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Panel className="!p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
            <span className="font-heading text-[11px] font-bold uppercase tracking-[0.06em] text-slate-700">
              Zápasy
            </span>
            <span className="text-xs text-slate-500">
              {rows.length} {czPlural(rows.length, "rozbor", "rozbory", "rozborů")}
            </span>
          </div>

          {rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm italic text-slate-500">
              Zatím žádný rozbor. Založ první — video není povinné, bez něj
              běží stopky.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/rozbory/${r.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-club-soft sm:px-5"
                  >
                    <span className="inline-grid h-9 min-w-9 shrink-0 place-items-center rounded-full border border-club-line bg-club-soft px-2 font-heading text-[11px] font-extrabold tabular-nums text-club">
                      {r.forCount}–{r.againstCount}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-800">
                        {r.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {r.opponent ? `${r.opponent} · ` : ""}
                        {r.playedOn} · {r.eventCount}{" "}
                        {czPlural(r.eventCount, "zápis", "zápisy", "zápisů")}
                        {r.hasVideo ? "" : " · bez videa"}
                      </span>
                    </span>
                    <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 sm:inline-flex">
                      {r.shareCount === -1
                        ? "celý tým"
                        : r.shareCount === 0
                          ? "jen moje"
                          : `sdíleno s ${r.shareCount}`}
                    </span>
                    <span aria-hidden className="shrink-0 text-slate-400">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="!p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
            <span className="font-heading text-[11px] font-bold uppercase tracking-[0.06em] text-slate-700">
              Hráči napříč rozbory
            </span>
            <span className="text-xs text-slate-500">
              {napric.balance.total}{" "}
              {czPlural(napric.balance.total, "zápis", "zápisy", "zápisů")} celkem
            </span>
          </div>

          {napric.players.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm italic text-slate-500">
              Zatím žádné zápisy s určeným hráčem.
            </p>
          ) : (
            <div className="table-scroll-wrapper">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <Th>Hráč</Th>
                    <Th num>Pro nás</Th>
                    <Th num>Proti nám</Th>
                    <Th num>Rozdíl</Th>
                    <Th num>Zápisů</Th>
                  </tr>
                </thead>
                <tbody>
                  {napric.players.map((p) => (
                    <tr key={p.playerId} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2.5 text-slate-800">{p.playerName}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-emerald-800">
                        {p.forCount}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-red-800">
                        {p.againstCount}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-800">
                        {p.diff > 0 ? `+${p.diff}` : p.diff}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                        {p.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Bez téhle věty čísla nesedí a nikdo nepozná proč. */}
          <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500 sm:px-5">
            Počítá se jen ze zápisů, u kterých je určený hráč.
            {napric.withoutPlayer > 0 && (
              <>
                {" "}
                {napric.withoutPlayer}{" "}
                {czPlural(napric.withoutPlayer, "zápis", "zápisy", "zápisů")} hráče
                nemá — zůstávají v týmové bilanci.
              </>
            )}
          </p>
        </Panel>
      </div>
    </div>
  );
}

function Th({ children, num }: { children: React.ReactNode; num?: boolean }) {
  return (
    <th
      className={`whitespace-nowrap border-b border-slate-200 px-3 py-2 font-heading text-[10.5px] font-bold uppercase tracking-[0.06em] text-slate-500 ${
        num ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}
