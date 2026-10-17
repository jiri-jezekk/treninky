"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setPlanAttendees } from "@/actions/roster";
import { SkillDots, type TeamMember } from "@/components/TeamBoard";

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";

/**
 * Kdo dnes přišel — klepnutím se označí. Slouží jen k dělení do týmů,
 * docházka se tu neeviduje. Ukládá se hned po klepnutí.
 */
export function PlanAttendees({
  planId,
  groupId,
  members,
  initialIds,
}: {
  planId: string;
  groupId: string;
  /** Aktivní členové soupisky kategorie. */
  members: TeamMember[];
  initialIds: string[];
}) {
  const [ids, setIds] = useState(() => new Set(initialIds));
  const [, startTransition] = useTransition();

  function save(next: Set<string>) {
    setIds(next);
    startTransition(async () => {
      await setPlanAttendees(planId, [...next]);
    });
  }

  function toggle(id: string) {
    const next = new Set(ids);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    save(next);
  }

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={label}>
          Kdo dnes přišel{" "}
          <span className="tabular-nums text-slate-700">
            {ids.size}/{members.length}
          </span>
        </h2>
        <span className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => save(new Set(members.map((m) => m.id)))}
            className="inline-flex min-h-9 items-center rounded-full border border-slate-200 px-3 text-sm text-slate-600 transition hover:border-club hover:bg-club-soft"
          >
            Všichni
          </button>
          <button
            type="button"
            onClick={() => save(new Set())}
            className="inline-flex min-h-9 items-center rounded-full border border-slate-200 px-3 text-sm text-slate-600 transition hover:border-club hover:bg-club-soft"
          >
            Nikdo
          </button>
        </span>
      </div>

      {members.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          Soupiska kategorie je prázdná.{" "}
          <Link
            href={`/planovac/soupisky?skupina=${groupId}`}
            className="underline decoration-slate-300 underline-offset-4 hover:text-slate-800"
          >
            Doplnit soupisku
          </Link>
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {members.map((m) => {
            const on = ids.has(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                aria-pressed={on}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition ${
                  on
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 text-slate-500 hover:border-club"
                }`}
              >
                {on ? "✓ " : ""}
                {m.name}
                <SkillDots skill={m.skill} />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
