import Link from "next/link";
import { PrepaidManager } from "./PrepaidManager";
import { INCOME_KIND_LABELS, type IncomeKind } from "@/lib/player-balance";
import { isPrepaidOn, toDateInputValue } from "@/lib/prepaid";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

export default async function PredplatnePage() {
  const userId = await requireUserId();

  const [seasons, players, prepayments] = await Promise.all([
    prisma.season.findMany({
      where: { userId },
      orderBy: { startsOn: "desc" },
    }),
    prisma.player.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, number: true, active: true },
    }),
    prisma.prepayment.findMany({
      where: { userId },
      orderBy: { startsOn: "desc" },
      include: { season: { select: { id: true, name: true } } },
    }),
  ]);

  const today = new Date();

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl">
      <Link
        href="/platby"
        className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800"
      >
        ← Zpět na Platby
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="font-heading text-2xl font-extrabold uppercase tracking-wide text-slate-800 sm:text-3xl">
          Předplatné
        </h1>
        <div className="mt-3 h-1 w-14 rounded bg-club" />
        <p className="mt-3 max-w-prose text-sm text-slate-600">
          Kdo má předplacené období, tomu se tréninky v těch dnech nepřičítají
          k měsíční platbě — platí místo nich jednu částku. Období je uložené
          u předplatného, takže{" "}
          <b className="text-slate-700">
            nové předplatné nikdy nesáhne na loňské platby
          </b>
          .
        </p>
      </div>

      <PrepaidManager
        seasons={seasons.map((s) => ({
          id: s.id,
          name: s.name,
          startsOn: toDateInputValue(s.startsOn),
          endsOn: toDateInputValue(s.endsOn),
          defaultPriceCents: s.defaultPriceCents,
          incomeKind: s.incomeKind,
          prepaidCount: prepayments.filter((p) => p.seasonId === s.id).length,
        }))}
        players={players.map((p) => ({
          id: p.id,
          name: p.name,
          number: p.number,
          active: p.active,
        }))}
        prepayments={prepayments.map((p) => ({
          id: p.id,
          playerId: p.playerId,
          playerName:
            players.find((pl) => pl.id === p.playerId)?.name ?? "Neznámý hráč",
          seasonId: p.seasonId,
          seasonName: p.season?.name ?? null,
          startsOn: toDateInputValue(p.startsOn),
          endsOn: toDateInputValue(p.endsOn),
          amountCents: p.amountCents,
          incomeKind: p.incomeKind,
          incomeKindLabel: INCOME_KIND_LABELS[p.incomeKind as IncomeKind],
          vs: p.vs,
          note: p.note,
          paid: p.paidAt != null,
          current: isPrepaidOn(
            [{ startsOn: p.startsOn, endsOn: p.endsOn }],
            today,
          ),
        }))}
      />
    </div>
  );
}
