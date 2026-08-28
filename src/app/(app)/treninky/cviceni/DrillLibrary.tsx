"use client";

import { useMemo, useState } from "react";
import {
  createDrill,
  deleteDrill,
  setDrillArchived,
  updateDrill,
} from "@/actions/drills";
import { czPlural } from "@/lib/czech";
import { DRILL_KIND_LABELS, DRILL_KINDS, type DrillKind } from "@/lib/training-plan";

export type DrillRow = {
  id: string;
  name: string;
  description: string | null;
  equipment: string | null;
  defaultMinutes: number | null;
  kind: DrillKind;
  archived: boolean;
  /** V kolika plánech je použité — varuje před smazáním. */
  usedCount: number;
};

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";
const field =
  "mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-club";
const btnPrimary =
  "inline-flex items-center justify-center rounded-full border-2 border-club bg-club px-4 py-2 font-heading text-sm font-semibold text-onclub transition hover:bg-club-hover";
const btnOutline =
  "inline-flex items-center justify-center rounded-full border-2 border-slate-300 px-4 py-2 font-heading text-sm font-semibold text-slate-800 transition hover:border-club hover:bg-club-soft";
const btnSm = "px-3 py-1.5 text-xs";
const btnDanger =
  "inline-flex items-center justify-center rounded-full border-2 border-red-200 px-3 py-1.5 font-heading text-xs font-semibold text-red-800 transition hover:border-red-600 hover:bg-red-50";
const mini =
  "rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-club hover:bg-club-soft hover:text-slate-900";

const KIND_CLASS: Record<DrillKind, string> = {
  WARMUP: "bg-amber-50 text-amber-900",
  DRILL: "bg-club-soft text-club",
  GAME: "bg-emerald-50 text-emerald-800",
  COOLDOWN: "bg-slate-50 text-slate-500",
};

export function DrillLibrary({ drills }: { drills: DrillRow[] }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<DrillKind | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drills.filter((d) => {
      if (!showArchived && d.archived) return false;
      if (kindFilter && d.kind !== kindFilter) return false;
      if (q && !d.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [drills, kindFilter, showArchived, query]);

  const archivedCount = drills.filter((d) => d.archived).length;

  return (
    <>
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat cvičení…"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-club sm:max-w-xs"
          />
          {!adding && (
            <button
              type="button"
              className={`${btnPrimary} ${btnSm}`}
              onClick={() => setAdding(true)}
            >
              + Nové cvičení
            </button>
          )}
        </div>

        <nav className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Druh:</span>
          <button
            type="button"
            onClick={() => setKindFilter(null)}
            className={
              kindFilter === null
                ? "rounded-full border border-club-line bg-club-soft px-3 py-1 text-xs text-slate-900"
                : mini
            }
          >
            Vše
          </button>
          {DRILL_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKindFilter(k)}
              className={
                kindFilter === k
                  ? "rounded-full border border-club-line bg-club-soft px-3 py-1 text-xs text-slate-900"
                  : mini
              }
            >
              {DRILL_KIND_LABELS[k]}
            </button>
          ))}
          {archivedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className={mini}
            >
              {showArchived ? "Skrýt archiv" : `Archiv (${archivedCount})`}
            </button>
          )}
        </nav>
      </div>

      {adding && (
        <form
          action={createDrill}
          onSubmit={() => setAdding(false)}
          className="mb-5 rounded-2xl border border-club-line bg-white p-5"
        >
          <h2 className={label}>Nové cvičení</h2>
          <div className="mt-4">
            <DrillFields />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" className={`${btnPrimary} ${btnSm}`}>
              Uložit
            </button>
            <button
              type="button"
              className={`${btnOutline} ${btnSm}`}
              onClick={() => setAdding(false)}
            >
              Zrušit
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {visible.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm italic text-slate-500">
            {drills.length === 0
              ? "Zatím tu nic není. Přidej první cvičení — příště ho už jen vybereš do plánu."
              : "Pro tenhle filtr nic nemám."}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((d) =>
              editing === d.id ? (
                <li key={d.id} className="bg-slate-50 px-4 py-4 sm:px-5">
                  <form
                    action={updateDrill.bind(null, d.id)}
                    onSubmit={() => setEditing(null)}
                  >
                    <DrillFields drill={d} />
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="submit" className={`${btnPrimary} ${btnSm}`}>
                        Uložit
                      </button>
                      <button
                        type="button"
                        className={`${btnOutline} ${btnSm}`}
                        onClick={() => setEditing(null)}
                      >
                        Zrušit
                      </button>
                      <button
                        type="submit"
                        formAction={setDrillArchived.bind(null, d.id, !d.archived)}
                        className={`${btnOutline} ${btnSm}`}
                      >
                        {d.archived ? "Vrátit z archivu" : "Archivovat"}
                      </button>
                      <button
                        type="submit"
                        formAction={deleteDrill.bind(null, d.id)}
                        className={btnDanger}
                      >
                        Smazat
                      </button>
                    </div>
                    {d.usedCount > 0 && (
                      <p className="mt-2 text-xs italic text-slate-500">
                        Použité v {d.usedCount}{" "}
                        {czPlural(d.usedCount, "plánu", "plánech", "plánech")}. Smazáním
                        se z nich body nevytratí, jen ztratí odkaz na knihovnu —
                        pokud ho chceš jen uklidit, použij Archivovat.
                      </p>
                    )}
                  </form>
                </li>
              ) : (
                <li key={d.id} className="px-4 py-3.5 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider ${KIND_CLASS[d.kind]}`}
                        >
                          {DRILL_KIND_LABELS[d.kind]}
                        </span>
                        <span
                          className={`font-medium ${d.archived ? "text-slate-500" : "text-slate-800"}`}
                        >
                          {d.name}
                        </span>
                        {d.defaultMinutes != null && (
                          <span className="text-xs tabular-nums text-slate-500">
                            {d.defaultMinutes} min
                          </span>
                        )}
                        {d.archived && (
                          <span className="text-xs text-slate-500">· archiv</span>
                        )}
                      </div>
                      {d.description && (
                        <p className="mt-1.5 text-sm text-slate-600">{d.description}</p>
                      )}
                      {d.equipment && (
                        <p className="mt-1 text-xs text-slate-500">
                          Potřeba: {d.equipment}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className={mini}
                      onClick={() => setEditing(d.id)}
                    >
                      Upravit
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </>
  );
}

function DrillFields({ drill }: { drill?: DrillRow }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <label className="block">
          <span className={label}>Název</span>
          <input
            name="name"
            required
            defaultValue={drill?.name}
            placeholder="Nahrávky ve dvojicích"
            className={field}
          />
        </label>
        <label className="block">
          <span className={label}>Druh</span>
          <select name="kind" defaultValue={drill?.kind ?? "DRILL"} className={field}>
            {DRILL_KINDS.map((k) => (
              <option key={k} value={k}>
                {DRILL_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={label}>Délka (min)</span>
          <input
            name="defaultMinutes"
            inputMode="numeric"
            defaultValue={drill?.defaultMinutes ?? ""}
            placeholder="10"
            className={`${field} tabular-nums`}
          />
        </label>
      </div>
      <label className="block">
        <span className={label}>Popis</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={drill?.description ?? ""}
          placeholder="Jak cvičení probíhá, na co si dát pozor…"
          className={field}
        />
      </label>
      <label className="block">
        <span className={label}>Potřeby</span>
        <input
          name="equipment"
          defaultValue={drill?.equipment ?? ""}
          placeholder="6 míčů, kužely"
          className={field}
        />
      </label>
    </div>
  );
}
