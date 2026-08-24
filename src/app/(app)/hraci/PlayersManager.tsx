"use client";

import { useMemo, useRef, useState } from "react";
import {
  bulkPlayerAction,
  createPlayer,
  deletePlayer,
  regeneratePayToken,
  resetPlayerPassword,
  savePlayer,
} from "@/actions/players";
import { GroupsDialog, type GroupRow } from "./GroupsDialog";
import { czPlural, initials } from "@/lib/czech";

export type PlayerRow = {
  id: string;
  name: string;
  number: number;
  active: boolean;
  prepaidSeason: boolean;
  payToken: string;
  hasPassword: boolean;
  groupIds: string[];
};

type StatusFilter = "all" | "active" | "inactive";

const btn =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 px-4 py-2 font-heading text-sm font-semibold transition";
const btnPrimary = `${btn} border-club bg-club text-white hover:bg-club-hover`;
const btnOutline = `${btn} border-slate-300 text-slate-800 hover:border-club hover:bg-club-soft`;
const btnDanger = `${btn} border-red-200 text-red-800 hover:border-red-600 hover:bg-red-50`;
const btnSm = "px-3 py-1.5 text-xs";
const mini =
  "rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-club hover:bg-club-soft hover:text-slate-900";
const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";
const field =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-club";

export function PlayersManager({
  players,
  groups,
}: {
  players: PlayerRow[];
  groups: GroupRow[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [catFilter, setCatFilter] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<PlayerRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const groupById = useMemo(
    () => new Map(groups.map((g) => [g.id, g])),
    [groups],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players.filter((p) => {
      if (status === "active" && !p.active) return false;
      if (status === "inactive" && p.active) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (catFilter.size > 0 && !p.groupIds.some((id) => catFilter.has(id))) return false;
      return true;
    });
  }, [players, query, status, catFilter]);

  const activeCount = players.filter((p) => p.active).length;
  const prepaidCount = players.filter((p) => p.prepaidSeason).length;
  const allVisibleSelected =
    visible.length > 0 && visible.every((p) => selected.has(p.id));

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCat(id: string) {
    setCatFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function copyLink(p: PlayerRow) {
    const url = `${window.location.origin}/p/${p.payToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(p.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl">
      {/* hlavička */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-extrabold uppercase tracking-wide text-slate-800">
            Hráči
          </h1>
          <div className="mt-3 h-1 w-14 rounded bg-club" />
          <p className="mt-3 max-w-prose text-sm text-slate-600">
            Správa soupisky napříč kategoriemi — členství, aktivita a předplacená sezóna.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnOutline} onClick={() => setShowGroups(true)}>
            Kategorie
          </button>
          <button type="button" className={btnPrimary} onClick={() => setAdding(true)}>
            + Přidat hráče
          </button>
        </div>
      </div>

      {/* přehledová čísla */}
      <dl className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat title="Na soupisce" value={String(players.length)} />
        <Stat title="Aktivních" value={String(activeCount)} note={`z ${players.length}`} accent />
        <Stat title="Kategorií" value={String(groups.length)} />
        <Stat title="Předplaceno" value={String(prepaidCount)} />
      </dl>

      {/* filtry */}
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat hráče…"
            className={`${field} min-w-0 flex-1 rounded-full sm:max-w-md`}
            aria-label="Hledat hráče"
          />
          <div className="flex gap-2" role="group" aria-label="Stav hráče">
            {(
              [
                ["all", "Vše"],
                ["active", "Aktivní"],
                ["inactive", "Neaktivní"],
              ] as const
            ).map(([value, text]) => (
              <button
                key={value}
                type="button"
                aria-pressed={status === value}
                onClick={() => setStatus(value)}
                className={`rounded-full border-2 px-4 py-1.5 font-heading text-xs font-semibold transition ${
                  status === value
                    ? "border-club bg-club text-white"
                    : "border-slate-300 text-slate-600 hover:border-club hover:bg-club-soft"
                }`}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        {groups.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className={label}>Kategorie</span>
            {groups.map((g) => {
              const count = players.filter((p) => p.groupIds.includes(g.id)).length;
              const on = catFilter.has(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleCat(g.id)}
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition"
                  style={{
                    borderColor: on ? g.color : "rgba(255,255,255,.12)",
                    backgroundColor: on ? `${g.color}26` : "transparent",
                    color: on ? "#fff" : undefined,
                  }}
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: g.color }}
                  />
                  {g.name}
                  <span className="tabular-nums opacity-70">{count}</span>
                </button>
              );
            })}
            {catFilter.size > 0 && (
              <button
                type="button"
                onClick={() => setCatFilter(new Set())}
                className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-500 hover:text-slate-800"
              >
                Zrušit filtr
              </button>
            )}
          </div>
        )}
      </div>

      {/* seznam */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white backdrop-blur">
        <div className="hidden md:block">
          <div className="table-scroll-wrapper">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b-2 border-club bg-slate-50">
                  <th className="w-12 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked ? new Set(visible.map((p) => p.id)) : new Set(),
                        )
                      }
                      aria-label="Vybrat vše"
                    />
                  </th>
                  <th className={`px-4 py-3 ${label}`}>Hráč</th>
                  <th className={`px-4 py-3 ${label}`}>Kategorie</th>
                  <th className={`px-4 py-3 ${label}`}>Stav</th>
                  <th className={`px-4 py-3 ${label}`}>Platba</th>
                  <th className={`px-4 py-3 ${label}`}>Odkaz</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((p) => (
                  <tr
                    key={p.id}
                    className={`transition hover:bg-slate-50 ${
                      selected.has(p.id) ? "bg-club-soft" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleSelected(p.id)}
                        aria-label={`Vybrat ${p.name}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setEditing(p)}
                        className="flex min-w-0 items-center gap-3 text-left"
                      >
                        <Avatar name={p.name} dim={!p.active} />
                        <span className="min-w-0">
                          <span
                            className={`block font-medium ${
                              p.active ? "text-slate-800" : "text-slate-500"
                            }`}
                          >
                            {p.name}
                          </span>
                          <span className="block text-xs text-slate-500">č. {p.number}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Tags ids={p.groupIds} groupById={groupById} />
                    </td>
                    <td className="px-4 py-3">
                      {p.active ? (
                        <Badge tone="ok">Aktivní</Badge>
                      ) : (
                        <Badge tone="off">Neaktivní</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.prepaidSeason ? (
                        <Badge tone="warn">Předplaceno</Badge>
                      ) : (
                        <Badge tone="off">Měsíčně</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" className={mini} onClick={() => copyLink(p)}>
                        {copied === p.id ? "Zkopírováno" : "Kopírovat"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className={mini} onClick={() => setEditing(p)}>
                        Upravit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* karty na telefonu */}
        <div className="divide-y divide-slate-100 md:hidden">
          {visible.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setEditing(p)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left"
            >
              <Avatar name={p.name} dim={!p.active} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span
                    className={`font-medium ${p.active ? "text-slate-800" : "text-slate-500"}`}
                  >
                    {p.name}
                  </span>
                  {p.active ? (
                    <Badge tone="ok">Aktivní</Badge>
                  ) : (
                    <Badge tone="off">Neaktivní</Badge>
                  )}
                </span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                  <Tags ids={p.groupIds} groupById={groupById} />
                  {p.prepaidSeason && <Badge tone="warn">Předplaceno</Badge>}
                </span>
              </span>
            </button>
          ))}
        </div>

        {visible.length === 0 && (
          <div className="px-6 py-16 text-center">
            <p className="font-heading font-semibold text-slate-800">
              {players.length === 0 ? "Zatím tu nikdo není" : "Nikdo neodpovídá filtru"}
            </p>
            <p className="mt-1 text-sm italic text-slate-500">
              {players.length === 0
                ? "Přidejte prvního hráče tlačítkem nahoře."
                : "Zkuste jiné hledání nebo kategorii."}
            </p>
          </div>
        )}
      </div>

      {/* hromadné akce */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-3">
          <form
            action={bulkPlayerAction}
            onSubmit={() => setSelected(new Set())}
            className="flex max-w-full flex-wrap items-center gap-2 rounded-full border border-club-line bg-[rgba(2,6,23,.95)] px-4 py-2 shadow-2xl backdrop-blur"
          >
            {[...selected].map((id) => (
              <input key={id} type="hidden" name="playerIds" value={id} />
            ))}
            <span className="font-heading text-xs font-bold text-slate-800">
              {selected.size} {czPlural(selected.size, "vybrán", "vybráni", "vybráno")}
            </span>
            <BulkButton value="activate">Aktivovat</BulkButton>
            <BulkButton value="deactivate">Deaktivovat</BulkButton>
            <BulkButton value="prepaid">Předplaceno</BulkButton>
            <BulkButton value="delete" danger>
              Smazat
            </BulkButton>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-full px-2 py-1 text-xs text-slate-500 hover:text-slate-900"
              aria-label="Zrušit výběr"
            >
              ✕
            </button>
          </form>
        </div>
      )}

      {/* panel detailu */}
      {editing && (
        <Overlay onClose={() => setEditing(null)}>
          <aside className="ml-auto flex h-full w-full max-w-md flex-col border-l border-club-line bg-[rgba(2,6,23,.97)] shadow-2xl">
            <form
              action={savePlayer.bind(null, editing.id)}
              onSubmit={() => setEditing(null)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <header className="flex items-start justify-between gap-3 border-b-2 border-club px-6 py-5">
                <div className="min-w-0">
                  <h2 className="font-heading text-xl font-extrabold uppercase tracking-wide text-slate-800">
                    {editing.name}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Hráč č. {editing.number}
                    {editing.hasPassword ? " · odkaz chráněný heslem" : " · heslo zatím nenastaveno"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-full p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  aria-label="Zavřít"
                >
                  ✕
                </button>
              </header>

              <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-6">
                <div>
                  <label className={label} htmlFor="edit-name">
                    Jméno
                  </label>
                  <input
                    id="edit-name"
                    name="name"
                    defaultValue={editing.name}
                    required
                    className={`${field} mt-2`}
                  />
                </div>

                <div>
                  <span className={label}>Kategorie</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {groups.map((g) => (
                      <label
                        key={g.id}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700 has-[:checked]:border-club has-[:checked]:bg-club-soft has-[:checked]:text-slate-900"
                      >
                        <input
                          type="checkbox"
                          name="skupiny"
                          value={g.id}
                          defaultChecked={editing.groupIds.includes(g.id)}
                          className="h-3.5 w-3.5"
                        />
                        <span
                          aria-hidden
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: g.color }}
                        />
                        {g.name}
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs italic text-slate-500">
                    Hráč může být ve více kategoriích najednou.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <span className={label}>Stav</span>
                  <Switch
                    name="active"
                    defaultChecked={editing.active}
                    title="Aktivní hráč"
                    note="Neaktivní se nenabízí u nových tréninků ani ve vyúčtování."
                  />
                  <Switch
                    name="prepaidSeason"
                    defaultChecked={editing.prepaidSeason}
                    title="Předplacená sezóna"
                    note="Nezobrazuje se v měsíční platbě — má zaplaceno dopředu."
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className={label}>Platební odkaz</span>
                  <p className="mt-2 break-all font-mono text-xs text-slate-600">
                    /p/{editing.payToken}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={mini} onClick={() => copyLink(editing)}>
                      {copied === editing.id ? "Zkopírováno" : "Kopírovat odkaz"}
                    </button>
                    <button
                      type="button"
                      className={mini}
                      onClick={() => {
                        void resetPlayerPassword(editing.id);
                        setEditing(null);
                      }}
                    >
                      Zrušit heslo
                    </button>
                    <button
                      type="button"
                      className={mini}
                      onClick={() => {
                        void regeneratePayToken(editing.id);
                        setEditing(null);
                      }}
                    >
                      Nový odkaz
                    </button>
                  </div>
                  <p className="mt-2 text-xs italic text-slate-500">
                    Nový odkaz starý okamžitě zneplatní.
                  </p>
                </div>
              </div>

              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  className={`${btnDanger} ${btnSm}`}
                  onClick={() => {
                    void deletePlayer(editing.id);
                    setEditing(null);
                  }}
                >
                  Smazat hráče
                </button>
                <button type="submit" className={`${btnPrimary} ${btnSm}`}>
                  Uložit změny
                </button>
              </footer>
            </form>
          </aside>
        </Overlay>
      )}

      {/* přidání hráče */}
      {adding && (
        <Overlay onClose={() => setAdding(false)} center>
          <form
            action={createPlayer}
            onSubmit={() => setAdding(false)}
            className="w-full max-w-lg rounded-2xl border border-club-line bg-[rgba(2,6,23,.97)] shadow-2xl"
          >
            <header className="flex items-start justify-between gap-3 border-b-2 border-club px-6 py-5">
              <div>
                <h2 className="font-heading text-xl font-extrabold uppercase tracking-wide text-slate-800">
                  Přidat hráče
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Kategorie i platbu můžete doplnit i později.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                aria-label="Zavřít"
              >
                ✕
              </button>
            </header>
            <div className="flex flex-col gap-5 px-6 py-6">
              <div>
                <label className={label} htmlFor="new-name">
                  Jméno
                </label>
                <input
                  id="new-name"
                  name="name"
                  required
                  autoFocus
                  placeholder="Např. Tomáš Vávra"
                  className={`${field} mt-2`}
                />
              </div>
              <div>
                <span className={label}>Kategorie</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {groups.map((g) => (
                    <label
                      key={g.id}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700 has-[:checked]:border-club has-[:checked]:bg-club-soft has-[:checked]:text-slate-900"
                    >
                      <input type="checkbox" name="skupiny" value={g.id} className="h-3.5 w-3.5" />
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: g.color }}
                      />
                      {g.name}
                    </label>
                  ))}
                </div>
              </div>
              <Switch
                name="prepaidSeason"
                title="Předplacená sezóna"
                note="Nezobrazuje se v měsíční platbě."
              />
            </div>
            <footer className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                className={`${btnOutline} ${btnSm}`}
                onClick={() => setAdding(false)}
              >
                Zrušit
              </button>
              <button type="submit" className={`${btnPrimary} ${btnSm}`}>
                Přidat hráče
              </button>
            </footer>
          </form>
        </Overlay>
      )}

      {showGroups && <GroupsDialog groups={groups} onClose={() => setShowGroups(false)} />}
    </div>
  );
}

/* ---------------------------------------------------------------- pomocné */

function Stat({
  title,
  value,
  note,
  accent,
}: {
  title: string;
  value: string;
  note?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 backdrop-blur">
      <dt className={label}>{title}</dt>
      <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-slate-800">
        <span className={accent ? "text-club" : undefined}>{value}</span>
        {note && <span className="ml-1.5 text-sm font-semibold text-slate-500">{note}</span>}
      </dd>
    </div>
  );
}

function Avatar({ name, dim }: { name: string; dim?: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border font-heading text-[10px] font-extrabold ${
        dim
          ? "border-slate-200 bg-slate-50 text-slate-500"
          : "border-club-line bg-club-soft text-club"
      }`}
    >
      {initials(name)}
    </span>
  );
}

function Tags({
  ids,
  groupById,
}: {
  ids: string[];
  groupById: Map<string, GroupRow>;
}) {
  if (ids.length === 0) {
    return (
      <span className="rounded-full border border-dashed border-slate-200 px-2 py-0.5 text-xs italic text-slate-500">
        bez kategorie
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      {ids.map((id) => {
        const g = groupById.get(id);
        if (!g) return null;
        return (
          <span
            key={id}
            className="rounded-full border px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider"
            style={{
              color: g.color,
              borderColor: `${g.color}66`,
              backgroundColor: `${g.color}26`,
            }}
          >
            {g.name}
          </span>
        );
      })}
    </span>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "ok" | "off" | "warn";
  children: React.ReactNode;
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-800"
      : tone === "warn"
        ? "bg-amber-50 text-amber-900"
        : "bg-slate-50 text-slate-500";
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider ${cls}`}
    >
      {children}
    </span>
  );
}

function Switch({
  name,
  title,
  note,
  defaultChecked,
}: {
  name: string;
  title: string;
  note: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-club-line">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-800">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{note}</span>
      </span>
    </label>
  );
}

function BulkButton({
  value,
  danger,
  children,
}: {
  value: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      name="action"
      value={value}
      className={`rounded-full border border-slate-200 px-3 py-1 text-xs transition ${
        danger
          ? "text-red-800 hover:border-red-600 hover:bg-red-50"
          : "text-slate-700 hover:border-club hover:bg-club-soft"
      }`}
    >
      {children}
    </button>
  );
}

function Overlay({
  children,
  onClose,
  center,
}: {
  children: React.ReactNode;
  onClose: () => void;
  center?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      className={`fixed inset-0 z-50 flex bg-[rgba(2,6,23,.85)] backdrop-blur-sm ${
        center ? "items-center justify-center p-4" : ""
      }`}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="presentation"
    >
      {children}
    </div>
  );
}
