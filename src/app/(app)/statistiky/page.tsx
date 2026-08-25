import Link from "next/link";
import { GroupFilterNav } from "@/components/GroupFilterNav";
import { StatisticsPeriodControls } from "@/components/StatisticsPeriodControls";
import { czPlural, initials } from "@/lib/czech";
import { formatDateDdMmYyyy } from "@/lib/date-display";
import { listGroups, parseGroupFilter } from "@/lib/groups";
import { toDateInputValue } from "@/lib/prepaid";
import { parseStatisticsPeriod } from "@/lib/statistics-period";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";
const card = "rounded-2xl border border-slate-200 bg-white";

/** Krátký den v týdnu — trenéra zajímá spíš „úterý“ než datum. */
const DOW = ["ne", "po", "út", "st", "čt", "pá", "so"];

export default async function StatistikyPage({
  searchParams,
}: {
  searchParams: Promise<{ skupina?: string; od?: string; do?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const groups = await listGroups(userId);
  const skupina = parseGroupFilter(sp.skupina, groups);
  const period = parseStatisticsPeriod({ od: sp.od, do: sp.do });

  // Stejně dlouhé okno těsně před zvoleným obdobím — kvůli srovnání.
  const spanMs = period.end.getTime() - period.start.getTime();
  const prevStart = new Date(period.start.getTime() - spanMs - 1);
  const prevEnd = new Date(period.start.getTime() - 1);

  const [trainings, players, seasons, prevTrainings] = await Promise.all([
    prisma.training.findMany({
      where: {
        userId,
        cancelled: false,
        startsAt: { gte: period.start, lte: period.end },
      },
      orderBy: { startsAt: "asc" },
      select: { id: true, startsAt: true },
    }),
    prisma.player.findMany({
      where: {
        userId,
        active: true,
        ...(skupina && { groupMembers: { some: { groupId: skupina } } }),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        groupMembers: { select: { group: { select: { name: true } } } },
      },
    }),
    prisma.season.findMany({
      where: { userId },
      orderBy: { startsOn: "desc" },
      take: 3,
      select: { name: true, startsOn: true, endsOn: true },
    }),
    prisma.training.findMany({
      where: {
        userId,
        cancelled: false,
        startsAt: { gte: prevStart, lte: prevEnd },
      },
      select: { id: true },
    }),
  ]);

  const trainingIds = trainings.map((t) => t.id);
  const totalTrainings = trainingIds.length;
  const playerIds = players.map((p) => p.id);

  // Jeden dotaz místo jednoho na každého hráče.
  const [attendances, prevAttendances] = await Promise.all([
    trainingIds.length > 0 && playerIds.length > 0
      ? prisma.attendance.findMany({
          where: {
            status: "PRESENT",
            trainingId: { in: trainingIds },
            playerId: { in: playerIds },
          },
          select: { playerId: true, trainingId: true },
        })
      : Promise.resolve([]),
    prevTrainings.length > 0 && playerIds.length > 0
      ? prisma.attendance.count({
          where: {
            status: "PRESENT",
            trainingId: { in: prevTrainings.map((t) => t.id) },
            playerId: { in: playerIds },
          },
        })
      : Promise.resolve(0),
  ]);

  const presentByPlayer = new Map<string, Set<string>>();
  const presentByTraining = new Map<string, number>();
  for (const a of attendances) {
    const pid = String(a.playerId);
    const tid = String(a.trainingId);
    const set = presentByPlayer.get(pid);
    if (set) set.add(tid);
    else presentByPlayer.set(pid, new Set([tid]));
    presentByTraining.set(tid, (presentByTraining.get(tid) ?? 0) + 1);
  }

  const rows = players
    .map((p) => {
      const mine = presentByPlayer.get(String(p.id)) ?? new Set<string>();
      const present = mine.size;
      const pct =
        totalTrainings > 0 ? Math.round((present / totalTrainings) * 100) : 0;

      // Kolik posledních tréninků v řadě vynechal — to je ten signál,
      // kvůli kterému se na statistiky vůbec kouká.
      let missedStreak = 0;
      for (let i = trainings.length - 1; i >= 0; i--) {
        if (mine.has(trainings[i]!.id)) break;
        missedStreak++;
      }

      return {
        id: p.id,
        name: p.name,
        present,
        pct,
        missedStreak,
        groupNames: p.groupMembers.map((m) => m.group.name),
      };
    })
    .sort((a, b) => b.present - a.present || a.name.localeCompare(b.name, "cs"));

  const totalPresent = attendances.length;
  const avgPerTraining =
    totalTrainings > 0 ? Math.round((totalPresent / totalTrainings) * 10) / 10 : 0;
  const prevAvg =
    prevTrainings.length > 0
      ? Math.round((prevAttendances / prevTrainings.length) * 10) / 10
      : null;
  const avgDelta = prevAvg != null ? Math.round((avgPerTraining - prevAvg) * 10) / 10 : null;

  const best = trainings.reduce(
    (acc, t) => {
      const n = presentByTraining.get(t.id) ?? 0;
      return n > acc.n ? { n, at: t.startsAt } : acc;
    },
    { n: 0, at: null as Date | null },
  );

  const neverCame = rows.filter((r) => r.present === 0);
  const periodEndDay = new Date(
    period.end.getFullYear(),
    period.end.getMonth(),
    period.end.getDate(),
  );
  const periodLabel = `${formatDateDdMmYyyy(period.start)} – ${formatDateDdMmYyyy(periodEndDay)}`;

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-extrabold uppercase tracking-wide text-slate-800 sm:text-3xl">
          Statistiky
        </h1>
        <div className="mt-3 h-1 w-14 rounded bg-club" />
        <p className="mt-3 max-w-prose text-sm text-slate-600">
          Docházka za{" "}
          <span className="font-medium tabular-nums text-slate-800">{periodLabel}</span>
          . Počítají se jen nezrušené tréninky podle dne konání.
        </p>
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat title="Tréninků" value={String(totalTrainings)} />
        <Stat
          title="Průměrně na trénink"
          value={totalTrainings > 0 ? String(avgPerTraining) : "—"}
          note={
            avgDelta == null || avgDelta === 0
              ? undefined
              : `${avgDelta > 0 ? "+" : ""}${avgDelta} oproti minulému období`
          }
          tone={avgDelta == null || avgDelta === 0 ? "plain" : avgDelta > 0 ? "up" : "down"}
          accent
        />
        <Stat
          title="Nejvyšší účast"
          value={best.at ? String(best.n) : "—"}
          note={best.at ? formatDateDdMmYyyy(best.at) : undefined}
        />
        <Stat
          title="Nepřišli ani jednou"
          value={String(neverCame.length)}
          note={`z ${players.length} ${czPlural(players.length, "hráče", "hráčů", "hráčů")}`}
        />
      </dl>

      <div className={`mb-5 ${card} p-4`}>
        <StatisticsPeriodControls
          odIso={period.odIso}
          doIso={period.doIso}
          skupina={skupina}
          seasons={seasons.map((s) => ({
            name: s.name,
            odIso: toDateInputValue(s.startsOn),
            doIso: toDateInputValue(s.endsOn),
          }))}
        />
        <div className="mt-4 border-t border-slate-100 pt-4">
          <GroupFilterNav
            groups={groups}
            basePath="/statistiky"
            current={skupina}
            extraQuery={{ od: period.odIso, do: period.doIso }}
          />
        </div>
      </div>

      {totalTrainings === 0 ? (
        <div className={`${card} px-6 py-16 text-center`}>
          <p className="text-sm italic text-slate-500">
            V tomhle období se nekonal žádný trénink.
          </p>
          <Link
            href="/treninky"
            className="mt-3 inline-block text-sm text-club underline underline-offset-4"
          >
            Přejít na Tréninky
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          {/* ------------------------------------------------ hráči */}
          <section className={`overflow-hidden ${card}`}>
            <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
              <h2 className={label}>Docházka hráčů</h2>
            </div>

            {rows.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm italic text-slate-500">
                Pro tento filtr nejsou žádní hráči.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 px-4 py-3 sm:px-5"
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border font-heading text-[11px] font-extrabold ${
                        r.present === 0
                          ? "border-slate-200 bg-slate-50 text-slate-500"
                          : "border-club-line bg-club-soft text-club"
                      }`}
                    >
                      {initials(r.name)}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate font-medium text-slate-800">
                          {r.name}
                        </span>
                        {r.present > 0 && r.missedStreak >= 3 && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-amber-900">
                            {r.missedStreak}× po sobě chybí
                          </span>
                        )}
                      </span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="h-1.5 w-full max-w-32 overflow-hidden rounded-full bg-slate-200">
                          <span
                            className={`block h-full rounded-full ${
                              r.pct >= 60 ? "bg-club" : "bg-slate-300"
                            }`}
                            style={{ width: `${r.pct}%` }}
                          />
                        </span>
                        <span className="shrink-0 text-xs text-slate-500">
                          {r.present} / {totalTrainings}
                        </span>
                      </span>
                    </span>

                    <span className="shrink-0 font-heading text-sm font-bold tabular-nums text-slate-800">
                      {r.pct} %
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* --------------------------------------------- tréninky */}
          <section className={`overflow-hidden ${card} self-start`}>
            <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
              <h2 className={label}>Účast po trénincích</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {[...trainings].reverse().map((t) => {
                const n = presentByTraining.get(t.id) ?? 0;
                const share =
                  players.length > 0 ? Math.round((n / players.length) * 100) : 0;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/treninky/${t.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-slate-50 sm:px-5"
                    >
                      <span className="w-20 shrink-0 text-xs text-slate-500">
                        {DOW[t.startsAt.getDay()]}{" "}
                        <span className="tabular-nums">
                          {t.startsAt.getDate()}. {t.startsAt.getMonth() + 1}.
                        </span>
                      </span>
                      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <span
                          className={`block h-full rounded-full ${
                            n === 0 ? "bg-red-600" : "bg-club"
                          }`}
                          style={{ width: `${share}%` }}
                        />
                      </span>
                      <span className="w-6 shrink-0 text-right font-heading text-sm font-bold tabular-nums text-slate-800">
                        {n}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <p className="border-t border-slate-100 px-4 py-2.5 text-xs italic text-slate-500 sm:px-5">
              Prázdný trénink může znamenat i nevyplněnou docházku.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({
  title,
  value,
  note,
  accent,
  tone = "plain",
}: {
  title: string;
  value: string;
  note?: string;
  accent?: boolean;
  tone?: "plain" | "up" | "down";
}) {
  return (
    <div className={`${card} px-5 py-4`}>
      <dt className={label}>{title}</dt>
      <dd
        className={`mt-1 font-heading text-2xl font-extrabold tabular-nums ${
          accent ? "text-club" : "text-slate-800"
        }`}
      >
        {value}
      </dd>
      {note && (
        <p
          className={`mt-1 text-xs ${
            tone === "up"
              ? "text-emerald-800"
              : tone === "down"
                ? "text-red-800"
                : "text-slate-500"
          }`}
        >
          {note}
        </p>
      )}
    </div>
  );
}
