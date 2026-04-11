import Link from "next/link";
import { notFound } from "next/navigation";
import { AttendanceStatus } from "@prisma/client";
import { AttendanceSelect } from "@/components/AttendanceSelect";
import { TrainingQrPanel, type QrLine } from "@/components/TrainingQrPanel";
import { formatCzkFromCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { resolveTrainingPriceCents } from "@/lib/training-price";
import {
  setTrainingCancelled,
  upsertTrainingBilling,
} from "@/actions/trainings";

function fmt(d: Date) {
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(d);
}

export default async function TrainingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();

  const training = await prisma.training.findFirst({
    where: { id, userId },
    include: {
      user: {
        select: {
          bankIban: true,
          bankMessagePrefix: true,
          defaultTrainingPriceCents: true,
        },
      },
    },
  });

  if (!training) notFound();

  const players = await prisma.player.findMany({
    where: { userId, active: true },
    orderBy: { name: "asc" },
    include: {
      attendances: { where: { trainingId: id } },
      billings: { where: { trainingId: id } },
    },
  });

  const prefix = training.user.bankMessagePrefix?.trim() ?? "Trénink";
  const datePart = training.startsAt.toISOString().slice(0, 10);

  const qrLines: QrLine[] = players.map((p) => {
    const att = p.attendances[0];
    const status = att?.status ?? AttendanceStatus.ABSENT;
    const bill = p.billings[0] ?? null;
    const amount = resolveTrainingPriceCents({
      trainingDefault: training.defaultPriceCents,
      userDefault: training.user.defaultTrainingPriceCents,
      billing: bill
        ? { priceCents: bill.priceCents, prepaid: bill.prepaid }
        : null,
    });
    const message = `${prefix} ${datePart} — ${p.name}`.slice(0, 60);
    return {
      playerId: p.id,
      playerName: p.name,
      amountCents: amount,
      message,
    };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/treninky"
            className="text-sm font-medium text-emerald-700 hover:underline"
          >
            ← Tréninky
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            {fmt(training.startsAt)}
          </h1>
          {training.notes && (
            <p className="mt-2 text-slate-600">{training.notes}</p>
          )}
        </div>
        <form action={setTrainingCancelled.bind(null, id, !training.cancelled)}>
          <button
            type="submit"
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              training.cancelled
                ? "border border-emerald-600 text-emerald-800 hover:bg-emerald-50"
                : "border border-amber-300 text-amber-900 hover:bg-amber-50"
            }`}
          >
            {training.cancelled ? "Označit jako konaný" : "Označit jako zrušený"}
          </button>
        </form>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Docházka</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-2 pr-4 font-medium">Hráč</th>
                <th className="py-2 pr-4 font-medium">Stav</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {players.map((p) => {
                const att = p.attendances[0];
                const status = att?.status ?? AttendanceStatus.ABSENT;
                return (
                  <tr key={p.id}>
                    <td className="py-2 pr-4 font-medium text-slate-900">
                      {p.name}
                    </td>
                    <td className="py-2 pr-4">
                      <AttendanceSelect
                        trainingId={id}
                        playerId={p.id}
                        value={status}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {players.length === 0 && (
          <p className="mt-4 text-sm text-slate-600">
            Žádní aktivní hráči — přidejte je v sekci Hráči.
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Platby za trénink</h2>
        <p className="mt-1 text-sm text-slate-600">
          Výchozí cena z tréninku nebo z nastavení účtu; můžete přepsat u hráče nebo
          zaškrtnout předplaceno.
        </p>
        <div className="mt-4 space-y-4">
          {players.map((p) => {
            const bill = p.billings[0];
            const prepaid = bill?.prepaid ?? false;
            const eff = resolveTrainingPriceCents({
              trainingDefault: training.defaultPriceCents,
              userDefault: training.user.defaultTrainingPriceCents,
              billing: bill
                ? { priceCents: bill.priceCents, prepaid: bill.prepaid }
                : null,
            });
            const priceDisplay =
              bill?.priceCents != null
                ? String(bill.priceCents / 100)
                : "";
            return (
              <form
                key={p.id}
                action={upsertTrainingBilling.bind(null, id, p.id)}
                className="flex flex-wrap items-end gap-3 border-b border-slate-100 pb-4 last:border-0"
              >
                <div className="min-w-[140px] font-medium text-slate-900">
                  {p.name}
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="prepaid" defaultChecked={prepaid} />
                  Předplaceno
                </label>
                <label className="text-sm text-slate-700">
                  Vlastní cena (Kč)
                  <input
                    name="price"
                    placeholder="prázdné = výchozí"
                    defaultValue={priceDisplay}
                    className="ml-2 w-28 rounded-md border border-slate-300 px-2 py-1 text-slate-900"
                  />
                </label>
                <span className="text-sm text-slate-500">
                  Účtovat: <strong>{formatCzkFromCents(eff)}</strong>
                </span>
                <button
                  type="submit"
                  className="rounded-md bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-200"
                >
                  Uložit
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">QR platby</h2>
        <div className="mt-4">
          <TrainingQrPanel iban={training.user.bankIban} lines={qrLines} />
        </div>
      </section>
    </div>
  );
}
