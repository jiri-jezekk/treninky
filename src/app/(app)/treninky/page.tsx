import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import {
  createTraining,
  generateTuesdayThursdayTrainings,
} from "@/actions/trainings";

function fmt(d: Date) {
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export default async function TreninkyPage() {
  const userId = await requireUserId();
  const trainings = await prisma.training.findMany({
    where: { userId },
    orderBy: { startsAt: "desc" },
    take: 80,
  });

  const today = new Date();
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);
  const defaultStart = isoDate(today);
  const end = new Date(today);
  end.setMonth(end.getMonth() + 2);
  const defaultEnd = isoDate(end);

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tréninky</h1>
        <p className="mt-1 text-slate-600">
          Přidávejte jednotlivé tréninky nebo je hromadně vygenerujte na úterky a
          čtvrtky v období.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Jeden trénink</h2>
        <form action={createTraining} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Datum a čas
            <input
              type="datetime-local"
              name="startsAt"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Výchozí cena (Kč, volitelné)
            <input
              name="defaultPrice"
              placeholder="např. 100"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Poznámka
            <input
              name="notes"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Uložit trénink
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Hromadně — úterý a čtvrtek
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          V zadaném období (včetně krajních dnů) se vytvoří termín za každý úterý
          a čtvrtek se stejným časem.
        </p>
        <form
          action={generateTuesdayThursdayTrainings}
          className="mt-4 grid gap-4 sm:grid-cols-2"
        >
          <label className="block text-sm font-medium text-slate-700">
            Od
            <input
              type="date"
              name="startDate"
              required
              defaultValue={defaultStart}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Do
            <input
              type="date"
              name="endDate"
              required
              defaultValue={defaultEnd}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Čas
            <input
              type="time"
              name="time"
              required
              defaultValue="17:30"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Výchozí cena (Kč)
            <input
              name="defaultPrice"
              placeholder="např. 100"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
            Poznámka ke všem
            <input
              name="notes"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              Vygenerovat tréninky
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-slate-900">Seznam</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2 font-medium">Termín</th>
                <th className="px-4 py-2 font-medium">Stav</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trainings.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    Zatím žádné tréninky.
                  </td>
                </tr>
              )}
              {trainings.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-2 text-slate-900">{fmt(t.startsAt)}</td>
                  <td className="px-4 py-2">
                    {t.cancelled ? (
                      <span className="text-amber-700">Zrušeno</span>
                    ) : (
                      <span className="text-emerald-800">Plánováno</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/treninky/${t.id}`}
                      className="font-medium text-emerald-700 hover:underline"
                    >
                      Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
