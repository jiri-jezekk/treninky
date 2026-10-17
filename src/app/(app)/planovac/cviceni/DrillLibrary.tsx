"use client";

import { useMemo, useState } from "react";
import {
  createDrill,
  deleteDrill,
  setDrillArchived,
  updateDrill,
} from "@/actions/drills";
import { czPlural } from "@/lib/czech";
import type { GroupOption } from "@/lib/groups";
import { DRILL_KIND_CLASS } from "@/components/drill-kind-styles";
import {
  DEFAULT_DRILL_KIND,
  DRILL_KIND_LABELS,
  DRILL_KINDS,
  suitsGroup,
  type DrillKind,
} from "@/lib/training-plan";

export type DrillRow = {
  id: string;
  name: string;
  description: string | null;
  equipment: string | null;
  focus: string | null;
  link: string | null;
  minPlayers: number | null;
  tags: string[];
  /** Prázdné = hodí se pro všechny kategorie. */
  groupIds: string[];
  defaultMinutes: number | null;
  kind: DrillKind;
  archived: boolean;
  /** V kolika plánech je použité — varuje před smazáním. */
  usedCount: number;
};

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";
const field =
  "mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base text-slate-900 outline-none focus:border-club sm:text-sm";
const btnPrimary =
  "inline-flex items-center justify-center rounded-full border-2 border-club bg-club px-4 py-2 font-heading text-sm font-semibold text-onclub transition hover:bg-club-hover";
const btnOutline =
  "inline-flex items-center justify-center rounded-full border-2 border-slate-300 px-4 py-2 font-heading text-sm font-semibold text-slate-800 transition hover:border-club hover:bg-club-soft";
const btnSm = "min-h-10 px-4 py-2 text-sm";
const btnDanger =
  "inline-flex min-h-10 items-center justify-center rounded-full border-2 border-red-200 px-4 py-2 font-heading text-sm font-semibold text-red-800 transition hover:border-red-600 hover:bg-red-50";
const mini =
  "inline-flex min-h-9 items-center rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:border-club hover:bg-club-soft hover:text-slate-900";
const filterSelect =
  "mt-1 w-full min-h-10 rounded-lg border border-slate-200 px-2.5 py-2 text-base text-slate-900 outline-none focus:border-club sm:w-44 sm:text-sm";
const miniActive =
  "inline-flex min-h-9 items-center rounded-full border border-club-line bg-club-soft px-3 py-1 text-sm text-slate-900";


export function DrillLibrary({
  drills,
  groups,
}: {
  drills: DrillRow[];
  groups: GroupOption[];
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<DrillKind | null>(null);
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drills.filter((d) => {
      if (!showArchived && d.archived) return false;
      if (kindFilter && d.kind !== kindFilter) return false;
      if (groupFilter && !suitsGroup(d, groupFilter)) return false;
      if (q) {
        // Hledá se v názvu, zaměření i štítcích.
        const haystack = [d.name, d.focus ?? "", ...d.tags].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [drills, kindFilter, groupFilter, showArchived, query]);

  const groupById = new Map(groups.map((g) => [g.id, g]));
  const allTags = useMemo(
    () =>
      [...new Set(drills.flatMap((d) => d.tags))].sort((a, b) =>
        a.localeCompare(b, "cs"),
      ),
    [drills],
  );

  const archivedCount = drills.filter((d) => d.archived).length;

  return (
    <>
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat název, zaměření, štítek…"
            className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-base text-slate-900 outline-none focus:border-club sm:max-w-xs sm:text-sm"
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

        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
          <label className="block min-w-0">
            <span className="text-xs text-slate-500">Druh</span>
            <select
              value={kindFilter ?? ""}
              onChange={(e) => setKindFilter((e.target.value || null) as DrillKind | null)}
              className={filterSelect}
            >
              <option value="">Vše</option>
              {DRILL_KINDS.map((k) => (
                <option key={k} value={k}>
                  {DRILL_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          {groups.length > 0 && (
            <label className="block min-w-0">
              <span className="text-xs text-slate-500">Kategorie</span>
              <select
                value={groupFilter ?? ""}
                onChange={(e) => setGroupFilter(e.target.value || null)}
                className={filterSelect}
              >
                <option value="">Vše</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {archivedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className={`${showArchived ? miniActive : mini} col-span-2 justify-center sm:col-span-1`}
            >
              {showArchived ? "Skrýt archiv" : `Archiv (${archivedCount})`}
            </button>
          )}
        </div>
      </div>

      {adding && (
        <form
          action={createDrill}
          onSubmit={() => setAdding(false)}
          className="mb-5 rounded-2xl border border-club-line bg-white p-5"
        >
          <h2 className={label}>Nové cvičení</h2>
          <div className="mt-4">
            <DrillFields groups={groups} allTags={allTags} />
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
                    <DrillFields drill={d} groups={groups} allTags={allTags} />
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
                          className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider ${DRILL_KIND_CLASS[d.kind]}`}
                        >
                          {DRILL_KIND_LABELS[d.kind]}
                        </span>
                        <span
                          className={`font-medium ${d.archived ? "text-slate-500" : "text-slate-800"}`}
                        >
                          {d.name}
                        </span>
                        {d.focus && (
                          <span className="text-sm text-slate-500">– {d.focus}</span>
                        )}
                        {d.defaultMinutes != null && (
                          <span className="text-xs tabular-nums text-slate-500">
                            {d.defaultMinutes} min
                          </span>
                        )}
                        {d.minPlayers != null && (
                          <span className="text-xs tabular-nums text-slate-500">
                            od {d.minPlayers} hráčů
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
                      {(d.groupIds.length > 0 || d.tags.length > 0 || d.link) && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {d.groupIds.map((id) => {
                            const g = groupById.get(id);
                            if (!g) return null;
                            return (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600"
                              >
                                <span
                                  aria-hidden
                                  className="inline-block h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: g.color }}
                                />
                                {g.name}
                              </span>
                            );
                          })}
                          {d.tags.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setQuery(t)}
                              className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 transition hover:bg-club-soft"
                            >
                              #{t}
                            </button>
                          ))}
                          {d.link && (
                            <a
                              href={d.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-slate-500 underline decoration-slate-300 underline-offset-4 hover:text-slate-800"
                            >
                              odkaz
                            </a>
                          )}
                        </div>
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

function DrillFields({
  drill,
  groups,
  allTags,
}: {
  drill?: DrillRow;
  groups: GroupOption[];
  allTags: string[];
}) {
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
          <select name="kind" defaultValue={drill?.kind ?? DEFAULT_DRILL_KIND} className={field}>
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
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <label className="block min-w-0">
          <span className={label}>Zaměření</span>
          <input
            name="focus"
            defaultValue={drill?.focus ?? ""}
            placeholder="rychlost obratnost"
            className={field}
          />
        </label>
        <label className="block min-w-0">
          <span className={label}>Min. hráčů</span>
          <input
            name="minPlayers"
            inputMode="numeric"
            defaultValue={drill?.minPlayers ?? ""}
            placeholder="—"
            className={`${field} tabular-nums`}
          />
        </label>
      </div>
      <label className="block">
        <span className={label}>Potřeby</span>
        <input
          name="equipment"
          defaultValue={drill?.equipment ?? ""}
          placeholder="6 míčů, kužely"
          className={field}
        />
      </label>
      {groups.length > 0 && (
        <fieldset>
          <legend className={label}>Pro kategorie (nic = pro všechny)</legend>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-2">
            {groups.map((g) => (
              <label
                key={g.id}
                className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  name="groupIds"
                  value={g.id}
                  defaultChecked={drill?.groupIds.includes(g.id)}
                />
                {g.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <label className="block">
        <span className={label}>Štítky (oddělené čárkou)</span>
        <input
          name="tags"
          list="drill-tags"
          defaultValue={drill?.tags.join(", ") ?? ""}
          placeholder="úvodní hra, nahrávka"
          className={field}
        />
        <datalist id="drill-tags">
          {allTags.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>
      <label className="block">
        <span className={label}>Odkaz (video, nákres)</span>
        <input
          name="link"
          type="url"
          defaultValue={drill?.link ?? ""}
          placeholder="https://…"
          className={field}
        />
      </label>
    </div>
  );
}
