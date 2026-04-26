import Link from "next/link";
import { Panel } from "@/components/ui";
import { AttendanceStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import {
  bulkDeleteTrainings,
  createTraining,
  deleteTraining,
  generateTuesdayThursdayTrainings,
} from "@/actions/trainings";
import {
  formatDateDdMmYyyy,
  formatDateTimeDdMmYyyy24h,
} from "@/lib/date-display";
import { TrainingListBulkSelect } from "@/components/TrainingListBulkSelect";
import {
  TRAINING_STATUS_LABELS,
  trainingListStatus,
  type TrainingListStatus,
} from "@/lib/training-list-status";

function parseMesicParam(mesic: string | undefined): { year: number; month: number } {
  if (mesic && /^\d{4}-\d{2}$/.test(mesic)) {
    const [y, m] = mesic.split("-").map(Number);
    if (m >= 1 && m <= 12) return { year: y, month: m };
  }
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function mesicQuery(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthLabelCs(year: number, month: number) {
  return new Intl.DateTimeFormat("cs-CZ", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

const BULK_DELETE_FORM_ID = "bulk-delete-trainings-form";

const INPUT_DATE_TIME_CLASS =
  "mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900 tabular-nums";

const STATUS_CLASS: Record<TrainingListStatus, string> = {
  cancelled: "bg-slate-100 text-slate-700",
  planned: "bg-sky-50 text-sky-900",
  completed: "bg-emerald-50 text-emerald-900",
  unfilled: "bg-amber-50 text-amber-900",
};

export default async function TreninkyPage({
  searchParams,
}: {
  searchParams: Promise<{ mesic?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const { year, month } = parseMesicParam(sp.mesic);

  const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const [trainings, activePlayerCount, now] = await Promise.all([
    prisma.training.findMany({
      where: {
        userId,
        startsAt: { gte: monthStart, lte: monthEnd },
      },
      orderBy: { startsAt: "asc" },
      include: {
        _count: {
          select: {
            attendances: { where: { status: AttendanceStatus.PRESENT } },
          },
        },
      },
    }),
    prisma.player.count({ where: { userId, active: true } }),
    Promise.resolve(new Date()),
  ]);

  const nowClock = new Date();
  const firstDayCurrentMonth = new Date(
    nowClock.getFullYear(),
    nowClock.getMonth(),
    1,
  );
  const lastDayCurrentMonth = new Date(
    nowClock.getFullYear(),
    nowClock.getMonth() + 1,
    0,
  );
  const defaultBulkStartDate = formatDateDdMmYyyy(firstDayCurrentMonth);
  const defaultBulkEndDate = formatDateDdMmYyyy(lastDayCurrentMonth);
  const defaultSingleDate = formatDateDdMmYyyy(nowClock);

  const prev = new Date(year, month - 2, 1);
  const next = new Date(year, month, 1);
  const mesicStr = mesicQuery(year, month);

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Tréninky</h1>
        <p className="mt-1 text-sm text-slate-600">
          Seznam podle měsíce — rychlý přechod na detail. Stav podle data a docházky.
        </p>
      </div>

      <Panel className="!p-0">
        <form
          id={BULK_DELETE_FORM_ID}
          action={bulkDeleteTrainings}
          className="sr-only"
          aria-hidden
        ></form>
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/80 px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-4">
          <h2 className="shrink-0 text-sm font-medium text-slate-800">Seznam</h2>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/treninky?mesic=${mesicQuery(prev.getFullYear(), prev.getMonth() + 1)}`}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
            >
              ← Předchozí měsíc
            </Link>
            <span className="min-w-0 text-sm font-medium capitalize text-slate-800">
              {monthLabelCs(year, month)}
            </span>
            <Link
              href={`/treninky?mesic=${mesicQuery(next.getFullYear(), next.getMonth() + 1)}`}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
            >
              Další měsíc →
            </Link>
            </div>
            {trainings.length > 0 && (
              <>
                <TrainingListBulkSelect
                  formId={BULK_DELETE_FORM_ID}
                  checkboxName="trainingIds"
                />
                <button
                  type="submit"
                  form={BULK_DELETE_FORM_ID}
                  className="rounded-md border border-red-200 bg-white px-2 py-1 text-sm text-red-800 hover:bg-red-50"
                >
                  Smazat vybrané
                </button>
              </>
            )}
          </div>
        </div>
        <div className="table-scroll-wrapper">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
            <tr>
              <th className="w-10 px-2 py-2 text-center font-medium" title="Hromadný výběr">
                <span className="sr-only">Vybrat</span>
              </th>
              <th className="px-2 py-2 text-xs font-medium sm:px-4 sm:text-sm">Termín</th>
              <th className="px-2 py-2 text-xs font-medium sm:px-4 sm:text-sm">Stav</th>
              <th className="px-2 py-2 text-xs font-medium sm:px-4 sm:text-sm">Docházka</th>
              <th className="px-2 py-2 text-right text-xs font-medium sm:px-4 sm:text-sm">Akce</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {trainings.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500 sm:px-4">
                  V tomto měsíci zatím žádné tréninky.
                </td>
              </tr>
            )}
            {trainings.map((t) => {
              const status = trainingListStatus({
                training: t,
                now,
                activePlayerCount,
                presentCount: t._count.attendances,
              });
              return (
                <tr key={t.id}>
                  <td className="px-2 py-2 text-center align-middle">
                    <input
                      form={BULK_DELETE_FORM_ID}
                      type="checkbox"
                      name="trainingIds"
                      value={t.id}
                      className="rounded border-slate-300"
                      aria-label={`Vybrat trénink ${formatDateTimeDdMmYyyy24h(t.startsAt)}`}
                    />
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-xs text-slate-900 sm:px-4 sm:text-sm">
                    {formatDateTimeDdMmYyyy24h(t.startsAt)}
                  </td>
                  <td className="px-2 py-2 sm:px-4">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}
                    >
                      {TRAINING_STATUS_LABELS[status]}
                    </span>
                  </td>
                  <td className="px-2 py-2 tabular-nums text-slate-700 sm:px-4">
                    {t._count.attendances}/{activePlayerCount}
                  </td>
                  <td className="px-2 py-2 text-right sm:px-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/treninky/${t.id}`}
                        className="text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                      >
                        Upravit
                      </Link>
                      <form action={deleteTraining.bind(null, t.id)} className="inline">
                        <button
                          type="submit"
                          title="Smazat trénink"
                          aria-label="Smazat trénink"
                          className="inline-flex rounded-md border border-slate-200 p-1.5 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            className="h-4 w-4"
                            aria-hidden
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34 0a.75.75 0 10-1.42.48l-.3 7.5a.75.75 0 101.42-.48l.3-7.5z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        <p className="border-t border-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-500">
          <span className="font-medium text-slate-600">Stavy:</span> Zrušen — označeno jako
          zrušené. Plánován — datum a čas ještě neproběhly. Dokončen — po termínu a je
          alespoň jeden hráč označen jako přítomen. Nevyplněno — po termínu a nikdo není
          označen jako přítomen. Zaškrtněte řádky a použijte{" "}
          <span className="font-medium text-slate-600">Smazat vybrané</span> pro hromadné
          smazání.
        </p>
      </Panel>

      <Panel>
        <h2 className="text-sm font-medium text-slate-800">Jeden trénink</h2>
        <p className="mt-1 text-xs text-slate-500">
          Datum <span className="font-medium">DD/MM/YYYY</span>, čas v 24 h{" "}
          <span className="font-medium">HH:mm</span> (stejně jako u hromadného zadání).
        </p>
        <form action={createTraining} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Datum
            <input
              type="text"
              name="startDate"
              required
              autoComplete="off"
              placeholder="DD/MM/YYYY"
              defaultValue={defaultSingleDate}
              className={INPUT_DATE_TIME_CLASS}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Čas (24 h)
            <input
              type="text"
              name="time"
              required
              autoComplete="off"
              placeholder="HH:mm"
              defaultValue="19:30"
              className={INPUT_DATE_TIME_CLASS}
            />
          </label>
          <label className="block text-sm text-slate-600 sm:col-span-2">
            Vlastní cena (Kč) — jen u výjimečného tréninku; prázdné = automaticky úterý
            110 Kč / čtvrtek 100 Kč (junioři 60 Kč)
            <input
              name="customPrice"
              placeholder="nechat prázdné"
              className="mt-1 w-full max-w-xs rounded-md border border-slate-200 px-3 py-2 text-slate-900"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Poznámka
            <input
              name="notes"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
            >
              Uložit trénink
            </button>
          </div>
        </form>
      </Panel>

      <Panel>
        <h2 className="text-sm font-medium text-slate-800">
          Hromadně — úterý a čtvrtek
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          V zadaném období (včetně krajních dnů) se vytvoří termín za každý úterý
          a čtvrtek se stejným časem.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Od / Do jako <span className="font-medium">DD/MM/YYYY</span>, čas{" "}
          <span className="font-medium">HH:mm</span> (24 h) — shodné s jedním tréninkem.
        </p>
        <form
          action={generateTuesdayThursdayTrainings}
          className="mt-4 grid gap-4 sm:grid-cols-2"
        >
          <input type="hidden" name="redirectMesic" value={mesicStr} />
          <label className="block text-sm font-medium text-slate-700">
            Od
            <input
              type="text"
              name="startDate"
              required
              autoComplete="off"
              placeholder="DD/MM/YYYY"
              defaultValue={defaultBulkStartDate}
              className={INPUT_DATE_TIME_CLASS}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Do
            <input
              type="text"
              name="endDate"
              required
              autoComplete="off"
              placeholder="DD/MM/YYYY"
              defaultValue={defaultBulkEndDate}
              className={INPUT_DATE_TIME_CLASS}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Čas (24 h)
            <input
              type="text"
              name="time"
              required
              autoComplete="off"
              placeholder="HH:mm"
              defaultValue="19:30"
              className={INPUT_DATE_TIME_CLASS}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Poznámka ke všem
            <input
              name="notes"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-slate-900"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
            >
              Vygenerovat tréninky
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
