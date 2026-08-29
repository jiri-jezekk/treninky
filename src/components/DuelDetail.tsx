import { formatMeasured, type Measure } from "@/lib/duration";
import { initials } from "@/lib/czech";

/**
 * Detail jednoho duelu — kdo, o co hrál, jak to dopadlo a kolik to
 * komu udělalo s ratingem.
 *
 * Z profilu hráče se sem dá prokliknout, aby u každé změny ratingu
 * bylo dohledatelné, odkud se vzala. Bez toho je v profilu jen popisek
 * a číslo, což se nedá zkontrolovat.
 */

export type DuelDetailRow = {
  name: string;
  description: string | null;
  note: string | null;
  measure: Measure;
  higherWins: boolean;
  weightPercent: number;
  status: string;
  when: string;
  confirmedWhen: string | null;
  players: {
    playerId: string;
    name: string;
    value: number | null;
    delta: number | null;
    wins: boolean;
  }[];
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Čeká na přijetí",
  ACCEPTED: "Domluveno",
  REPORTED: "Čeká na potvrzení",
  CONFIRMED: "Potvrzeno",
  DECLINED: "Odmítnuto",
};

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";

export function DuelDetail({ duel }: { duel: DuelDetailRow }) {
  const remiza =
    duel.players.length === 2 &&
    duel.players[0]!.value != null &&
    duel.players[0]!.value === duel.players[1]!.value;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-lg font-extrabold text-slate-900">
            {duel.name}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {duel.when}
            {` · ${duel.measure === "TIME" ? "na čas" : "na body"}`}
            {duel.measure === "TIME"
              ? ", vyhrává kratší"
              : duel.higherWins
                ? ", vyhrává vyšší"
                : ", vyhrává nižší"}
            {` · váha ${duel.weightPercent} %`}
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-slate-700">
          {STATUS_LABEL[duel.status] ?? duel.status}
        </span>
      </div>

      {duel.description && (
        <p className="mt-2 text-sm text-slate-600">{duel.description}</p>
      )}

      <ul className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        {duel.players.map((p) => (
          <li
            key={p.playerId}
            className={`flex items-center gap-3 px-3 py-2.5 ${
              p.wins ? "bg-club-soft" : ""
            } border-b border-slate-100 last:border-0`}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-club-line bg-club-soft font-heading text-[10px] font-extrabold text-club">
              {initials(p.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-slate-800">
                {p.name}
              </span>
              {p.wins && (
                <span className="block font-heading text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  vyhrál
                </span>
              )}
            </span>
            <span className="w-20 shrink-0 text-right text-sm tabular-nums text-slate-700">
              {formatMeasured(p.value, duel.measure)}
            </span>
            <span
              className={`w-14 shrink-0 text-right font-heading text-sm font-bold tabular-nums ${
                (p.delta ?? 0) > 0
                  ? "text-emerald-800"
                  : (p.delta ?? 0) < 0
                    ? "text-red-800"
                    : "text-slate-500"
              }`}
            >
              {p.delta == null
                ? "—"
                : p.delta > 0
                  ? `+${p.delta}`
                  : String(p.delta)}
            </span>
          </li>
        ))}
      </ul>

      {remiza && (
        <p className="mt-2 text-xs italic text-slate-500">
          Remíza — rating se nemění.
        </p>
      )}

      {duel.status !== "CONFIRMED" && (
        <p className="mt-2 text-xs italic text-slate-500">
          Dokud výsledek nepotvrdí druhý hráč, rating se nepropisuje.
        </p>
      )}

      {duel.confirmedWhen && (
        <p className="mt-2 text-xs text-slate-500">
          Potvrzeno {duel.confirmedWhen}.
        </p>
      )}

      {duel.note && (
        <div className="mt-4">
          <h2 className={label}>Poznámka</h2>
          <p className="mt-1 text-sm text-slate-600">{duel.note}</p>
        </div>
      )}
    </section>
  );
}
