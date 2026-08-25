"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createGroup,
  deleteGroup,
  renameGroup,
  setGroupColor,
  setGroupDiscount,
  type GroupActionState,
} from "@/actions/groups";
import { GROUP_COLORS } from "@/lib/groups";
import { czPlayers } from "@/lib/czech";
import { formatCzkFromCents } from "@/lib/money";

export type GroupRow = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  discountPriceCents: number | null;
  memberCount: number;
};

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";
const mini =
  "rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-club hover:bg-club-soft hover:text-slate-900";

export function GroupsDialog({
  groups,
  onClose,
}: {
  groups: GroupRow[];
  onClose: () => void;
}) {
  const [createState, createAction] = useActionState(
    createGroup,
    {} as GroupActionState,
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [palette, setPalette] = useState<string | null>(null);
  const [pricing, setPricing] = useState<string | null>(null);
  const newNameRef = useRef<HTMLInputElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (createState.ok && newNameRef.current) newNameRef.current.value = "";
  }, [createState.ok]);

  return (
    <div
      ref={backdrop}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(2,6,23,.85)] p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === backdrop.current) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="presentation"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-club-line bg-[rgba(2,6,23,.97)] shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b-2 border-club px-6 py-5">
          <div>
            <h2 className="font-heading text-xl font-extrabold uppercase tracking-wide text-slate-800">
              Kategorie
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Přejmenujte, obarvěte, přidejte nebo smažte. Změny se projeví všude.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            aria-label="Zavřít"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {deleteError && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
              {deleteError}
            </p>
          )}

          <ul className="divide-y divide-slate-100">
            {groups.map((g) => (
              <li key={g.id} className="py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPalette(palette === g.id ? null : g.id)}
                    className="h-6 w-6 shrink-0 rounded-lg border border-slate-300 transition hover:scale-110"
                    style={{ backgroundColor: g.color }}
                    aria-label={`Barva kategorie ${g.name}`}
                  />

                  <form
                    action={renameGroup.bind(null, g.id)}
                    className="min-w-0 flex-1"
                  >
                    <input
                      name="name"
                      defaultValue={g.name}
                      onBlur={(e) => {
                        if (e.target.value.trim() !== g.name) e.target.form?.requestSubmit();
                      }}
                      className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 font-heading text-sm font-semibold text-slate-800 hover:border-slate-200 focus:border-club focus:outline-none"
                      aria-label="Název kategorie"
                    />
                  </form>

                  <button
                    type="button"
                    onClick={() => setPricing(pricing === g.id ? null : g.id)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs transition ${
                      g.discountPriceCents != null
                        ? "border-amber-300 bg-amber-50 font-semibold text-amber-900"
                        : "border-slate-200 text-slate-500 hover:border-club hover:text-slate-800"
                    }`}
                  >
                    {g.discountPriceCents != null
                      ? formatCzkFromCents(g.discountPriceCents)
                      : "Běžná cena"}
                  </button>

                  <span className="whitespace-nowrap text-xs tabular-nums text-slate-500">
                    {czPlayers(g.memberCount)}
                  </span>

                  <button
                    type="button"
                    onClick={async () => {
                      setDeleteError(null);
                      const res = await deleteGroup(g.id);
                      if (res.error) setDeleteError(res.error);
                    }}
                    className="rounded-full p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-800"
                    aria-label={`Smazat kategorii ${g.name}`}
                  >
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      aria-hidden
                    >
                      <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" />
                    </svg>
                  </button>
                </div>

                {palette === g.id && (
                  <div className="mt-3 flex flex-wrap gap-2 pl-9">
                    {GROUP_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          void setGroupColor(g.id, c);
                          setPalette(null);
                        }}
                        className={`h-6 w-6 rounded-lg border transition hover:scale-110 ${
                          c === g.color ? "border-slate-900 ring-2 ring-slate-900" : "border-slate-300"
                        }`}
                        style={{ backgroundColor: c }}
                        aria-label={`Barva ${c}`}
                      />
                    ))}
                  </div>
                )}

                {pricing === g.id && (
                  <form
                    action={setGroupDiscount.bind(null, g.id)}
                    onSubmit={() => setPricing(null)}
                    className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <label className="min-w-0 flex-1">
                      <span className={label}>Zvýhodněná cena za trénink</span>
                      <input
                        name="discount"
                        defaultValue={
                          g.discountPriceCents != null
                            ? String(g.discountPriceCents / 100)
                            : ""
                        }
                        placeholder="Prázdné = běžná sazba"
                        className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-club"
                      />
                    </label>
                    <button type="submit" className={mini}>
                      Uložit
                    </button>
                    <p className="w-full text-xs italic text-slate-500">
                      Platí místo běžné sazby i u tréninku s ručně zadanou cenou.
                    </p>
                  </form>
                )}
              </li>
            ))}
          </ul>

          <form
            action={createAction}
            className="mt-5 flex flex-wrap gap-3 border-t border-dashed border-slate-200 pt-5"
          >
            <input
              ref={newNameRef}
              name="name"
              placeholder="Název nové kategorie…"
              className="min-w-0 flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-900 outline-none focus:border-club"
              aria-label="Název nové kategorie"
            />
            <button
              type="submit"
              className="rounded-full border-2 border-club bg-club px-4 py-2 font-heading text-sm font-semibold text-onclub transition hover:bg-club-hover"
            >
              Přidat
            </button>
            {createState.error && (
              <p className="w-full text-sm text-red-900">{createState.error}</p>
            )}
          </form>
        </div>

        <footer className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border-2 border-slate-300 px-4 py-2 font-heading text-sm font-semibold text-slate-800 transition hover:border-club hover:bg-club-soft"
          >
            Hotovo
          </button>
        </footer>
      </div>
    </div>
  );
}
