import Link from "next/link";
import { getDebtors } from "@/lib/player-balance";
import { formatCzkFromCents } from "@/lib/money";
import { formatDateTimeDdMmYyyy24h } from "@/lib/date-display";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { czPlural, initials } from "@/lib/czech";

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";

export default async function PrehledPage() {
  const userId = await requireUserId();
  const now = new Date();

  const [activePlayers, nextTraining, debtors, user] = await Promise.all([
    prisma.player.count({ where: { userId, active: true } }),
    prisma.training.findFirst({
      where: { userId, cancelled: false, startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      select: { id: true, startsAt: true, notes: true },
    }),
    getDebtors(userId),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { bankIban: true },
    }),
  ]);

  const owed = debtors.reduce((s, d) => s + d.totalCents, 0);
  const topDebtors = debtors.slice(0, 5);

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-extrabold uppercase tracking-wide text-slate-800">
          Přehled
        </h1>
        <div className="mt-3 h-1 w-14 rounded bg-club" />
        <p className="mt-3 text-sm text-slate-600">
          Co je potřeba vyřídit a co se blíží.
        </p>
      </div>

      {!user.bankIban && (
        <p className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          V <Link href="/nastaveni" className="underline">Nastavení</Link> chybí IBAN —
          bez něj se hráčům nevykreslí QR kódy.
        </p>
      )}

      <dl className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <dt className={label}>K inkasu</dt>
          <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-red-800">
            {formatCzkFromCents(owed)}
          </dd>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <dt className={label}>Dlužníků</dt>
          <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-slate-800">
            {debtors.length}
          </dd>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <dt className={label}>Aktivních hráčů</dt>
          <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-slate-800">
            {activePlayers}
          </dd>
        </div>
      </dl>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <h2 className={`border-b border-slate-100 px-5 py-3 ${label}`}>
            Nejvíc dluží
          </h2>
          {topDebtors.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm italic text-slate-500">
              Nikdo nic nedluží.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {topDebtors.map((d) => (
                <li
                  key={d.playerId}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-club-line bg-club-soft font-heading text-[10px] font-extrabold text-club">
                      {initials(d.playerName)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-slate-800">
                        {d.playerName}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {d.unpaid.length}{" "}
                        {czPlural(d.unpaid.length, "položka", "položky", "položek")}
                      </span>
                    </span>
                  </span>
                  <span className="font-heading font-bold tabular-nums text-red-800">
                    {formatCzkFromCents(d.totalCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-slate-100 px-5 py-3">
            <Link
              href="/platby"
              className="text-sm text-club underline decoration-club-line underline-offset-4"
            >
              Otevřít Platby
            </Link>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <h2 className={`border-b border-slate-100 px-5 py-3 ${label}`}>
            Nejbližší trénink
          </h2>
          {nextTraining ? (
            <div className="px-5 py-5">
              <p className="font-heading text-lg font-bold text-slate-800">
                {formatDateTimeDdMmYyyy24h(nextTraining.startsAt)}
              </p>
              {nextTraining.notes && (
                <p className="mt-1 text-sm text-slate-600">{nextTraining.notes}</p>
              )}
              <Link
                href={`/treninky/${nextTraining.id}`}
                className="mt-4 inline-flex rounded-full border-2 border-club bg-club px-4 py-2 font-heading text-sm font-semibold text-onclub transition hover:bg-club-hover"
              >
                Zapsat docházku
              </Link>
            </div>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-sm italic text-slate-500">
                Žádný nadcházející trénink.
              </p>
              <Link
                href="/treninky"
                className="mt-4 inline-flex rounded-full border-2 border-slate-300 px-4 py-2 font-heading text-sm font-semibold text-slate-800 transition hover:border-club hover:bg-club-soft"
              >
                Naplánovat
              </Link>
            </div>
          )}

          <div className="border-t border-slate-100 px-5 py-4">
            <p className={label}>Rychlé odkazy</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <QuickLink href="/hraci">Hráči</QuickLink>
              <QuickLink href="/treninky">Tréninky</QuickLink>
              <QuickLink href="/platby/ucetnictvi">Pro účetní</QuickLink>
              <QuickLink href="/statistiky">Statistiky</QuickLink>
              <QuickLink href="/nastaveni">Nastavení</QuickLink>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:border-club hover:bg-club-soft hover:text-slate-900"
    >
      {children}
    </Link>
  );
}
