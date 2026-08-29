"use client";

import { useState } from "react";
import {
  createTrainingSlot,
  deleteTrainingSlot,
  setTrainingSlotActive,
  updateTrainingSlot,
} from "@/actions/training-slots";
import { formatCzkFromCents } from "@/lib/money";
import { DAY_NAMES } from "@/lib/training-slots";

export type SlotRow = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  priceCents: number;
  active: boolean;
  isGym: boolean;
  trainingCount: number;
};

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";
const field =
  "mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-club";
const btnPrimary =
  "inline-flex items-center justify-center rounded-full border-2 border-club bg-club px-3 py-1.5 font-heading text-xs font-semibold text-onclub transition hover:bg-club-hover";
const btnOutline =
  "inline-flex items-center justify-center rounded-full border-2 border-slate-300 px-3 py-1.5 font-heading text-xs font-semibold text-slate-800 transition hover:border-club hover:bg-club-soft";
const btnDanger =
  "inline-flex items-center justify-center rounded-full border-2 border-red-200 px-3 py-1.5 font-heading text-xs font-semibold text-red-800 transition hover:border-red-600 hover:bg-red-50";
const mini =
  "rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-club hover:bg-club-soft hover:text-slate-900";

/** Dny od pondělí — takhle je čte trenér, i když JS začíná nedělí. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function ScheduleCard({ slots }: { slots: SlotRow[] }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className={label}>Rozvrh</h2>
          <p className="mt-1 text-xs text-slate-500">
            Pravidelné termíny klubu. Podle nich se tréninky generují.
          </p>
        </div>
        {!adding && (
          <button type="button" className={btnOutline} onClick={() => setAdding(true)}>
            + Přidat termín
          </button>
        )}
      </div>

      {adding && (
        <form
          action={createTrainingSlot}
          onSubmit={() => setAdding(false)}
          className="border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-5"
        >
          <SlotFields />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="submit" className={btnPrimary}>
              Přidat
            </button>
            <button
              type="button"
              className={btnOutline}
              onClick={() => setAdding(false)}
            >
              Zrušit
            </button>
          </div>
        </form>
      )}

      {slots.length === 0 && !adding ? (
        <p className="px-5 py-10 text-center text-sm italic text-slate-500">
          Rozvrh je prázdný. Přidej termín a pak z něj vygeneruj tréninky.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {slots.map((s) =>
            editing === s.id ? (
              <li key={s.id} className="bg-slate-50 px-4 py-4 sm:px-5">
                <form
                  action={updateTrainingSlot.bind(null, s.id)}
                  onSubmit={() => setEditing(null)}
                >
                  <SlotFields slot={s} />
                  <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="active"
                      value="on"
                      defaultChecked={s.active}
                    />
                    Nabízet při generování
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="submit" className={btnPrimary}>
                      Uložit
                    </button>
                    <button
                      type="button"
                      className={btnOutline}
                      onClick={() => setEditing(null)}
                    >
                      Zrušit
                    </button>
                    <button
                      type="submit"
                      formAction={deleteTrainingSlot.bind(null, s.id)}
                      className={btnDanger}
                    >
                      Smazat termín
                    </button>
                  </div>
                  {s.trainingCount > 0 && (
                    <p className="mt-2 text-xs italic text-slate-500">
                      Z tohohle termínu vzniklo {s.trainingCount}{" "}
                      {s.trainingCount === 1 ? "trénink" : "tréninků"}. Smazáním
                      termínu se nesmažou — zůstanou i s cenou, za kterou se
                      účtovaly.
                    </p>
                  )}
                </form>
              </li>
            ) : (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5"
              >
                <span className="min-w-0 flex-1">
                  <span
                    className={`block font-medium ${s.active ? "text-slate-800" : "text-slate-500"}`}
                  >
                    {DAY_NAMES[s.dayOfWeek]}{" "}
                    <span className="tabular-nums">
                      {s.startTime}–{s.endTime}
                    </span>
                  </span>
                  <span className="block text-xs text-slate-500">
                    {s.isGym
                      ? "Posilovna — neúčtuje se, počítá se do ratingu"
                      : `${formatCzkFromCents(s.priceCents)} za trénink`}
                    {!s.active && " · vypnuto"}
                  </span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <form action={setTrainingSlotActive.bind(null, s.id, !s.active)}>
                    <button type="submit" className={mini}>
                      {s.active ? "Vypnout" : "Zapnout"}
                    </button>
                  </form>
                  <button
                    type="button"
                    className={mini}
                    onClick={() => setEditing(s.id)}
                  >
                    Upravit
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function SlotFields({ slot }: { slot?: SlotRow }) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <label className="block">
        <span className={label}>Den</span>
        <select
          name="dayOfWeek"
          defaultValue={String(slot?.dayOfWeek ?? 2)}
          className={field}
        >
          {DAY_ORDER.map((d) => (
            <option key={d} value={d}>
              {DAY_NAMES[d]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className={label}>Od</span>
        <input
          name="startTime"
          required
          defaultValue={slot?.startTime ?? "18:00"}
          placeholder="18:00"
          className={`${field} tabular-nums`}
        />
      </label>
      <label className="block">
        <span className={label}>Do</span>
        <input
          name="endTime"
          required
          defaultValue={slot?.endTime ?? "20:00"}
          placeholder="20:00"
          className={`${field} tabular-nums`}
        />
      </label>
      <label className="block">
        <span className={label}>Cena (Kč)</span>
        <input
          name="price"
          required
          inputMode="decimal"
          defaultValue={slot ? String(slot.priceCents / 100) : ""}
          placeholder="110"
          className={`${field} tabular-nums`}
        />
      </label>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700 sm:col-span-4">
        <input type="checkbox" name="gym" defaultChecked={slot?.isGym ?? false} />
        Posilovna — neúčtuje se, ale za účast se počítá do ratingu
      </label>
    </div>
  );
}
