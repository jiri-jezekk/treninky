import Link from "next/link";
import { TrainingListBulkSelect } from "@/components/TrainingListBulkSelect";
import { getMonthlyBillingRows } from "@/lib/monthly-billing";
import { formatCzkFromCents } from "@/lib/money";
import { formatDateDdMmYyyy, formatDateTimeDdMmYyyy24h } from "@/lib/date-display";
import { formatMonthLabelCs } from "@/lib/training-pricing";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import {
  bulkDeleteTrainings,
  createTraining,
  generateTuesdayThursdayTrainings,
} from "@/actions/trainings";
import {
  TRAINING_STATUS_LABELS,
  trainingListStatus,
  type TrainingListStatus,
} from "@/lib/training-list-status";

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";
const field =
  "mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-club";
const btnOutline =
  "inline-flex items-center justify-center rounded-full border-2 border-slate-300 px-4 py-2 font-heading text-sm font-semibold text-slate-800 transition hover:border-club hover:bg-club-soft";
const btnPrimary =
  "inline-flex items-center justify-center rounded-full border-2 border-club bg-club px-4 py-2 font-heading text-sm font-semibold text-onclub transition hover:bg-club-hover";

const STATUS_CLASS: Record<TrainingListStatus, string> = {
  cancelled: "bg-slate-50 text-slate-500",
  planned: "bg-sky-50 text-sky-900",
  completed: "bg-emerald-50 text-emerald-800",
  unfilled: "bg-amber-50 text-amber-900",
};

function parseMesic(mesic: string | undefined): { year: number; month: number } {
  if (mesic && /^\d{4}-\d{2}$/.test(mesic)) {
    const [y, m] = mesic.split("-").map(Number);
    if (y && m && m >= 1 && m <= 12) return { year: y, month: m };
  }
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

const mesicQuery = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

export default async function TreninkyPage({
  searchParams,
}: {
  searchParams: Promise<{ mesic?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const { year, month } = parseMesic(sp.mesic);

  const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const [trainings, activePlayerCount, billing] = await Promise.all([
    prisma.training.findMany({
      where: { userId, startsAt: { gte: monthStart, lte: monthEnd } },
      orderBy: { startsAt: "asc" },
      include: {
        _count: { select: { attendances: { where: { status: "PRESENT" } } } },
      },
    }),
    prisma.player.count({ where: { userId, active: true } }),
    getMonthlyBillingRows(userId, year, month),
  ]);

  const now = new Date();
  const monthTotal = billing.reduce((s, r) => s + r.totalCents, 0);
  const held = trainings.filter(
    (t) => !t.cancelled && t.startsAt.getTime() <= now.getTime(),
  ).length;
  const unfilled = trainings.filter(
    (t) =>
      trainingListStatus({
        training: t,
        now,
        activePlayerCount,
        presentCount: t._count.attendances,
      }) === "unfilled",
  ).length;

  const prev = new Date(year, month - 2, 1);
  const next = new Date(year, month, 1);
  const mesicStr = mesicQuery(year, month);

  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-extrabold uppercase tracking-wide text-slate-800">
            Tréninky
          </h1>
          <div className="mt-3 h-1 w-14 rounded bg-club" />
          <p className="mt-3 max-w-prose text-sm text-slate-600">
            Zapisuj docházku a částky se hráčům samy přičtou k jejich měsíci. Kdo má
            předplacenou sezónu, tomu se neúčtuje nic.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/treninky?mesic=${mesicQuery(prev.getFullYear(), prev.getMonth() + 1)}`}
            className="grid h-9 w-9 place-items-center rounded-full border-2 border-slate-300 text-slate-600 transition hover:border-club hover:bg-club-soft"
            aria-label="Předchozí měsíc"
          >
            ←
          </Link>
          <span className="min-w-[11ch] text-center font-heading text-base font-extrabold uppercase tracking-wide text-slate-800">
            {formatMonthLabelCs(year, month)}
          </span>
          <Link
            href={`/treninky?mesic=${mesicQuery(next.getFullYear(), next.getMonth() + 1)}`}
            className="grid h-9 w-9 place-items-center rounded-full border-2 border-slate-300 text-slate-600 transition hover:border-club hover:bg-club-soft"
            aria-label="Další měsíc"
          >
            →
          </Link>
        </div>
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat title="Tréninků v měsíci" value={String(trainings.length)} />
        <Stat title="Odehráno" value={String(held)} />
        <Stat
          title="Nevyplněná docházka"
          value={String(unfilled)}
          tone={unfilled > 0 ? "warn" : undefined}
        />
        <Stat
          title="Naúčtováno za měsíc"
          value={formatCzkFromCents(monthTotal)}
          tone="good"
        />
      </dl>

      {unfilled > 0 && (
        <p className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {unfilled === 1
            ? "U jednoho odehraného tréninku chybí docházka — dokud ji nedoplníš, nikomu se za něj nic nenaúčtuje."
            : `U ${unfilled} odehraných tréninků chybí docházka — dokud ji nedoplníš, nikomu se za ně nic nenaúčtuje.`}
        </p>
      )}

      <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <h2 className={`border-b border-slate-100 px-5 py-3 ${label}`}>
          Seznam tréninků
        </h2>

        {trainings.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm italic text-slate-500">
            V tomto měsíci není žádný trénink.
          </p>
        ) : (
          <div className="table-scroll-wrapper">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-club bg-slate-50">
                    <th className="w-12 px-4 py-3" />
                    <th className={`px-4 py-3 ${label}`}>Termín</th>
                    <th className={`px-4 py-3 ${label}`}>Stav</th>
                    <th className={`px-4 py-3 ${label}`}>Přítomno</th>
                    <th className={`px-4 py-3 ${label}`}>Poznámka</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trainings.map((t) => {
                    const status = trainingListStatus({
                      training: t,
                      now,
                      activePlayerCount,
                      presentCount: t._count.attendances,
                    });
                    return (
                      <tr key={t.id} className="transition hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            name="trainingIds"
                            value={t.id}
                            form="bulk-delete-trainings-form"
                            aria-label={`Vybrat trénink ${formatDateDdMmYyyy(t.startsAt)}`}
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Link
                            href={`/treninky/${t.id}`}
                            className="font-medium tabular-nums text-slate-800 underline decoration-slate-300 underline-offset-4 hover:text-club"
                          >
                            {formatDateTimeDdMmYyyy24h(t.startsAt)}
                          </Link>
                          {t.defaultPriceCents != null && (
                            <span className="ml-2 rounded-full bg-slate-50 px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              {formatCzkFromCents(t.defaultPriceCents)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider ${STATUS_CLASS[status]}`}
                          >
                            {TRAINING_STATUS_LABELS[status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-heading font-bold tabular-nums text-slate-800">
                          {t._count.attendances}
                          <span className="ml-1 text-xs font-semibold text-slate-500">
                            z {activePlayerCount}
                          </span>
                        </td>
                        <td className="max-w-[18rem] truncate px-4 py-3 text-slate-600">
                          {t.notes ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/treninky/${t.id}`}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-club hover:bg-club-soft hover:text-slate-900"
                          >
                            Docházka
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
          </div>
        )}

        {trainings.length > 0 && (
          <form
            id="bulk-delete-trainings-form"
            action={bulkDeleteTrainings}
            className="border-t border-slate-100 px-5 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <TrainingListBulkSelect
                formId="bulk-delete-trainings-form"
                checkboxName="trainingIds"
              />
              <button
                type="submit"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-red-600 hover:bg-red-50 hover:text-red-800"
              >
                Smazat vybrané
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className={label}>Nový trénink</h2>
          <form action={createTraining} className="mt-4 flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={label}>Datum</span>
                <input
                  name="startDate"
                  required
                  defaultValue={formatDateDdMmYyyy(now)}
                  placeholder="DD/MM/YYYY"
                  className={`${field} tabular-nums`}
                />
              </label>
              <label className="block">
                <span className={label}>Čas</span>
                <input
                  name="time"
                  required
                  defaultValue="19:30"
                  placeholder="HH:mm"
                  className={`${field} tabular-nums`}
                />
              </label>
            </div>
            <label className="block">
              <span className={label}>Poznámka (nepovinné)</span>
              <input name="notes" className={field} />
            </label>
            <label className="block">
              <span className={label}>Vlastní cena (nepovinné)</span>
              <input name="customPrice" inputMode="decimal" className={field} />
              <span className="mt-1.5 block text-xs italic text-slate-500">
                Prázdné = automaticky podle dne. Zvýhodněné kategorie platí svou
                sazbu i tady.
              </span>
            </label>
            <button type="submit" className={`${btnPrimary} self-start`}>
              Vytvořit trénink
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className={label}>Vygenerovat úterky a čtvrtky</h2>
          <form
            action={generateTuesdayThursdayTrainings}
            className="mt-4 flex flex-col gap-4"
          >
            <input type="hidden" name="redirectMesic" value={mesicStr} />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={label}>Od</span>
                <input
                  name="startDate"
                  required
                  defaultValue={formatDateDdMmYyyy(firstOfThisMonth)}
                  placeholder="DD/MM/YYYY"
                  className={`${field} tabular-nums`}
                />
              </label>
              <label className="block">
                <span className={label}>Do</span>
                <input
                  name="endDate"
                  required
                  defaultValue={formatDateDdMmYyyy(lastOfThisMonth)}
                  placeholder="DD/MM/YYYY"
                  className={`${field} tabular-nums`}
                />
              </label>
            </div>
            <label className="block">
              <span className={label}>Čas</span>
              <input
                name="time"
                required
                defaultValue="19:30"
                placeholder="HH:mm"
                className={`${field} tabular-nums sm:max-w-[10rem]`}
              />
            </label>
            <label className="block">
              <span className={label}>Poznámka (nepovinné)</span>
              <input name="notes" className={field} />
            </label>
            <button type="submit" className={`${btnOutline} self-start`}>
              Vygenerovat
            </button>
            <p className="text-xs italic text-slate-500">
              Ceny se řídí dnem v týdnu — úterý 110 Kč, čtvrtek 100 Kč.
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}

function Stat({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone?: "good" | "warn";
}) {
  const cls =
    tone === "good" ? "text-emerald-800" : tone === "warn" ? "text-amber-900" : undefined;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <dt className={label}>{title}</dt>
      <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-slate-800">
        <span className={cls}>{value}</span>
      </dd>
    </div>
  );
}
