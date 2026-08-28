import Link from "next/link";
import { notFound } from "next/navigation";
import { AttendanceToggle } from "@/components/AttendanceToggle";
import { GroupFilterNav } from "@/components/GroupFilterNav";
import { listGroups, parseGroupFilter } from "@/lib/groups";
import { getPrepaidRangesByPlayer } from "@/lib/monthly-billing";
import { isPrepaidOn } from "@/lib/prepaid";
import { formatDateTimeDdMmYyyy24h, formatTime24h } from "@/lib/date-display";
import { formatCzkFromCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import {
  discountPriceCentsFor,
  priceCentsForTrainingSession,
} from "@/lib/training-pricing";
import {
  setAttendanceBulkForTraining,
  setTrainingCancelled,
} from "@/actions/trainings";
import { initials } from "@/lib/czech";

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";

export default async function TrainingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ skupina?: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();
  const sp = await searchParams;

  const training = await prisma.training.findFirst({ where: { id, userId } });
  if (!training) notFound();

  const groups = await listGroups(userId);
  const skupina = parseGroupFilter(sp.skupina, groups);

  const [players, totalActive, prepaidByPlayer] = await Promise.all([
    prisma.player.findMany({
      where: {
        userId,
        active: true,
        ...(skupina && { groupMembers: { some: { groupId: skupina } } }),
      },
      orderBy: { name: "asc" },
      include: {
        attendances: { where: { trainingId: id } },
        groupMembers: { include: { group: true } },
      },
    }),
    prisma.player.count({ where: { userId, active: true } }),
    getPrepaidRangesByPlayer(userId),
  ]);

  const rows = players.map((p) => {
    const present = p.attendances[0]?.status === "PRESENT";
    const discount = discountPriceCentsFor(p.groupMembers.map((m) => m.group));
    // Rozhoduje datum tohohle tréninku, ne přepínač u hráče: kdo má
    // předplacenou jinou sezónu, platí tenhle trénink normálně.
    const prepaid = isPrepaidOn(
      prepaidByPlayer.get(String(p.id)) ?? [],
      training.startsAt,
    );
    const chargeCents = prepaid
      ? 0
      : priceCentsForTrainingSession(training, discount);
    return {
      id: p.id,
      name: p.name,
      present,
      prepaid,
      chargeCents,
      discount,
      groupNames: p.groupMembers.map((m) => m.group.name),
    };
  });

  const presentRows = rows.filter((r) => r.present);
  const earned = presentRows.reduce((s, r) => s + r.chargeCents, 0);
  const prepaidPresent = presentRows.filter((r) => r.prepaid).length;

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl">
      <Link
        href="/treninky"
        className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800"
      >
        ← Zpět na Tréninky
      </Link>

      <div className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-extrabold uppercase tracking-wide text-slate-800 sm:text-3xl">
            {formatDateTimeDdMmYyyy24h(training.startsAt)}
            {training.endsAt && (
              <span className="text-slate-500">
                {"–"}
                {formatTime24h(training.endsAt)}
              </span>
            )}
          </h1>
          <div className="mt-3 h-1 w-14 rounded bg-club" />
          {training.notes && (
            <p className="mt-3 text-sm text-slate-600">{training.notes}</p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            {training.defaultPriceCents == null
              ? "Cena podle dne v týdnu. Zvýhodněné kategorie platí svou sazbu."
              : `${training.slotId ? "Termín z rozvrhu" : "Mimořádný trénink"} za ${formatCzkFromCents(training.defaultPriceCents)}. Zvýhodněné kategorie platí dál svou sazbu.`}
          </p>
        </div>
        <form action={setTrainingCancelled.bind(null, id, !training.cancelled)}>
          <button
            type="submit"
            className="inline-flex items-center rounded-full border-2 border-slate-300 px-4 py-2 font-heading text-sm font-semibold text-slate-800 transition hover:border-club hover:bg-club-soft"
          >
            {training.cancelled ? "Označit jako konaný" : "Označit jako zrušený"}
          </button>
        </form>
      </div>

      {training.cancelled && (
        <p className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Trénink je zrušený — docházka se do plateb ani statistik nepočítá.
        </p>
      )}

      <dl className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <dt className={label}>Přítomno</dt>
          <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-slate-800">
            {presentRows.length}
            <span className="ml-1.5 text-sm font-semibold text-slate-500">
              z {totalActive}
            </span>
          </dd>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <dt className={label}>Naúčtováno</dt>
          <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-emerald-800">
            {training.cancelled ? "—" : formatCzkFromCents(earned)}
          </dd>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <dt className={label}>Z toho předplacených</dt>
          <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-slate-800">
            {prepaidPresent}
          </dd>
        </div>
      </dl>

      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
        <GroupFilterNav
          groups={groups}
          basePath={`/treninky/${id}`}
          current={skupina}
        />
        <p className="mt-3 text-xs text-slate-500">
          Klepnutím na řádek zapíšeš účast. Částka se hráči automaticky přičte
          k jeho měsíci — uvidíš ji v{" "}
          <Link href="/platby?zalozka=mesicni" className="underline">
            Platbách
          </Link>
          . Kdo má tenhle den v{" "}
          <Link href="/platby/predplatne" className="underline">
            předplaceném období
          </Link>
          , tomu se nepřičítá nic.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className={label}>Docházka</h2>
          {rows.length > 0 && (
            <form action={setAttendanceBulkForTraining} className="flex flex-wrap gap-2">
              <input type="hidden" name="trainingId" value={id} />
              {rows.map((r) => (
                <input key={r.id} type="hidden" name="playerIds" value={r.id} />
              ))}
              <button
                type="submit"
                name="bulkPresent"
                value="true"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-emerald-600 hover:bg-emerald-50 hover:text-emerald-800"
              >
                Všichni přítomni
              </button>
              <button
                type="submit"
                name="bulkPresent"
                value="false"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-club hover:bg-club-soft hover:text-slate-900"
              >
                Nikdo
              </button>
            </form>
          )}
        </div>

        {skupina && (
          <p className="border-b border-slate-100 px-4 py-2 text-xs italic text-slate-500 sm:px-5">
            Hromadná úprava platí jen pro zobrazené hráče.
          </p>
        )}

        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id}>
              <AttendanceToggle trainingId={id} playerId={r.id} present={r.present}>
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border font-heading text-[11px] font-extrabold ${
                      r.present
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-club-line bg-club-soft text-club"
                    }`}
                  >
                    {initials(r.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">
                      {r.name}
                    </span>
                    {r.groupNames.length > 0 && (
                      <span className="block truncate text-xs text-slate-500">
                        {r.groupNames.join(" · ")}
                      </span>
                    )}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  {r.prepaid ? (
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-amber-900">
                      Předplaceno
                    </span>
                  ) : (
                    <span
                      className={`font-heading text-sm font-bold tabular-nums ${
                        r.present ? "text-emerald-800" : "text-slate-500"
                      }`}
                    >
                      {r.present ? "+" : ""}
                      {formatCzkFromCents(r.chargeCents)}
                    </span>
                  )}
                </span>
              </AttendanceToggle>
            </li>
          ))}
        </ul>

        {rows.length === 0 && (
          <p className="px-5 py-12 text-center text-sm italic text-slate-500">
            Pro tento filtr nejsou žádní hráči.
          </p>
        )}
      </div>
    </div>
  );
}
