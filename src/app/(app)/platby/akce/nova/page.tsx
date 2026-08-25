import Link from "next/link";
import { createSharedPayment } from "@/actions/shared-payments";
import { INCOME_KINDS } from "@/lib/accounting";
import { INCOME_KIND_LABELS } from "@/lib/player-balance";
import { listGroups, parseGroupFilter } from "@/lib/groups";
import { GroupFilterNav } from "@/components/GroupFilterNav";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";
const field =
  "mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-club";

export default async function NovaAkcePage({
  searchParams,
}: {
  searchParams: Promise<{ skupina?: string }>;
}) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const groups = await listGroups(userId);
  const skupina = parseGroupFilter(sp.skupina, groups);

  const players = await prisma.player.findMany({
    where: {
      userId,
      active: true,
      ...(skupina && { groupMembers: { some: { groupId: skupina } } }),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, number: true },
  });

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl">
      <Link
        href="/platby?zalozka=akce"
        className="text-sm text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800"
      >
        ← Zpět na Platby
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="font-heading text-3xl font-extrabold uppercase tracking-wide text-slate-800">
          Nová akce
        </h1>
        <div className="mt-3 h-1 w-14 rounded bg-club" />
        <p className="mt-3 max-w-prose text-sm text-slate-600">
          Turnaj, dresy, soustředění — cokoli, co se platí mimo tréninky. Částka se
          rozdělí rovným dílem, jednotlivé podíly pak jde upravit.
        </p>
      </div>

      <form
        action={createSharedPayment}
        className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6"
      >
        <label className="block">
          <span className={label}>Název</span>
          <input
            name="title"
            required
            maxLength={120}
            placeholder="Např. Turnaj Ústí nad Labem"
            className={field}
          />
        </label>

        <label className="block">
          <span className={label}>Popis (nepovinné)</span>
          <textarea
            name="description"
            rows={2}
            maxLength={500}
            placeholder="Startovné + doprava"
            className={`${field} resize-y`}
          />
        </label>

        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Celková částka</span>
            <input
              name="totalKc"
              required
              inputMode="decimal"
              placeholder="2700"
              className={field}
            />
            <span className="mt-1.5 block text-xs italic text-slate-500">
              V korunách. Podíly se zaokrouhlují nahoru na celé koruny.
            </span>
          </label>

          <label className="block">
            <span className={label}>Účetní druh příjmu</span>
            <select name="incomeKind" defaultValue="EVENT" className={field}>
              {INCOME_KINDS.map((k) => (
                <option key={k} value={k}>
                  {INCOME_KIND_LABELS[k]}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-xs italic text-slate-500">
              Rozhoduje o zařazení v sestavě pro účetní.
            </span>
          </label>
        </div>

        <div>
          <span className={label}>Kdo se podílí</span>
          <div className="mt-3">
            <GroupFilterNav
              groups={groups}
              basePath="/platby/akce/nova"
              current={skupina}
            />
          </div>

          {players.length === 0 ? (
            <p className="mt-4 text-sm italic text-slate-500">
              Pro tento filtr nejsou žádní aktivní hráči.
            </p>
          ) : (
            <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {players.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-3 text-sm text-slate-700"
                >
                  <input type="checkbox" name="playerIds" value={p.id} />
                  <span className="min-w-0 truncate">
                    {p.name}
                    <span className="ml-1.5 text-xs text-slate-500">č. {p.number}</span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
          <Link
            href="/platby?zalozka=akce"
            className="inline-flex items-center rounded-full border-2 border-slate-300 px-4 py-2 font-heading text-sm font-semibold text-slate-800 transition hover:border-club hover:bg-club-soft"
          >
            Zrušit
          </Link>
          <button
            type="submit"
            className="inline-flex items-center rounded-full border-2 border-club bg-club px-4 py-2 font-heading text-sm font-semibold text-onclub transition hover:bg-club-hover"
          >
            Vytvořit akci
          </button>
        </div>
      </form>
    </div>
  );
}
