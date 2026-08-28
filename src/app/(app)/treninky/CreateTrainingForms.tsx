"use client";

import { useState } from "react";
import { createTraining, generateTrainingsFromSchedule } from "@/actions/trainings";
import { formatCzkFromCents } from "@/lib/money";
import { DAY_NAMES_PLURAL } from "@/lib/training-slots";
import type { SlotRow } from "./ScheduleCard";

const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";
const field =
  "mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-club";
const btnOutline =
  "inline-flex items-center justify-center rounded-full border-2 border-slate-300 px-4 py-2 font-heading text-sm font-semibold text-slate-800 transition hover:border-club hover:bg-club-soft";
const btnPrimary =
  "inline-flex items-center justify-center rounded-full border-2 border-club bg-club px-4 py-2 font-heading text-sm font-semibold text-onclub transition hover:bg-club-hover";

export function CreateTrainingForms({
  slots,
  today,
  rangeFrom,
  rangeTo,
  mesic,
}: {
  slots: SlotRow[];
  today: string;
  rangeFrom: string;
  rangeTo: string;
  mesic: string;
}) {
  const activeSlots = slots.filter((s) => s.active);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <GenerateForm
        slots={activeSlots}
        rangeFrom={rangeFrom}
        rangeTo={rangeTo}
        mesic={mesic}
      />
      <SingleForm slots={activeSlots} today={today} />
    </div>
  );
}

function GenerateForm({
  slots,
  rangeFrom,
  rangeTo,
  mesic,
}: {
  slots: SlotRow[];
  rangeFrom: string;
  rangeTo: string;
  mesic: string;
}) {
  // Bez zaškrtnutí se generuje ze všech zapnutých termínů; výběr je
  // pro případ, kdy chce trenér doplnit jen jeden den.
  const [chosen, setChosen] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const used = chosen.size > 0 ? slots.filter((s) => chosen.has(s.id)) : slots;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className={label}>Vygenerovat z rozvrhu</h2>

      {slots.length === 0 ? (
        <p className="mt-4 text-sm italic text-slate-500">
          Nejdřív si nahoře nastav rozvrh — pak z něj půjde generovat.
        </p>
      ) : (
        <form action={generateTrainingsFromSchedule} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="redirectMesic" value={mesic} />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={label}>Od</span>
              <input
                name="startDate"
                required
                defaultValue={rangeFrom}
                placeholder="DD/MM/YYYY"
                className={`${field} tabular-nums`}
              />
            </label>
            <label className="block">
              <span className={label}>Do</span>
              <input
                name="endDate"
                required
                defaultValue={rangeTo}
                placeholder="DD/MM/YYYY"
                className={`${field} tabular-nums`}
              />
            </label>
          </div>

          <div>
            <span className={label}>Které termíny</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {slots.map((s) => (
                <label
                  key={s.id}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-700 has-[:checked]:border-club has-[:checked]:bg-club-soft has-[:checked]:text-slate-900"
                >
                  <input
                    type="checkbox"
                    name="slotIds"
                    value={s.id}
                    checked={chosen.has(s.id)}
                    onChange={() => toggle(s.id)}
                    className="h-3.5 w-3.5"
                  />
                  {DAY_NAMES_PLURAL[s.dayOfWeek]} {s.startTime}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-xs italic text-slate-500">
              Nic nezaškrtnuto = všechny zapnuté termíny.
            </p>
          </div>

          <label className="block">
            <span className={label}>Poznámka (nepovinné)</span>
            <input name="notes" className={field} />
          </label>

          <button type="submit" className={`${btnOutline} self-start`}>
            Vygenerovat
          </button>

          <p className="text-xs text-slate-500">
            Vytvoří{" "}
            {used
              .map(
                (s) =>
                  `${DAY_NAMES_PLURAL[s.dayOfWeek]} ${s.startTime}–${s.endTime} po ${formatCzkFromCents(s.priceCents)}`,
              )
              .join(", ")}
            . Termín, který už v seznamu je, se přeskočí — generovat můžeš
            klidně opakovaně.
          </p>
        </form>
      )}
    </section>
  );
}

function SingleForm({ slots, today }: { slots: SlotRow[]; today: string }) {
  // Předvyplnění z rozvrhu — jednotlivý trénink bývá nejčastěji
  // náhrada za termín, který se nekonal.
  const [start, setStart] = useState(slots[0]?.startTime ?? "19:30");
  const [end, setEnd] = useState(slots[0]?.endTime ?? "21:00");
  const [price, setPrice] = useState(
    slots[0] ? String(slots[0].priceCents / 100) : "",
  );

  function applySlot(s: SlotRow) {
    setStart(s.startTime);
    setEnd(s.endTime);
    setPrice(String(s.priceCents / 100));
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className={label}>Jednotlivý trénink</h2>
      <form action={createTraining} className="mt-4 flex flex-col gap-4">
        {slots.length > 0 && (
          <div>
            <span className={label}>Převzít z rozvrhu</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {slots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => applySlot(s)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-club hover:bg-club-soft hover:text-slate-900"
                >
                  {s.startTime}–{s.endTime} · {formatCzkFromCents(s.priceCents)}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="block">
          <span className={label}>Datum</span>
          <input
            name="startDate"
            required
            defaultValue={today}
            placeholder="DD/MM/YYYY"
            className={`${field} tabular-nums`}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Od</span>
            <input
              name="time"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
              placeholder="HH:mm"
              className={`${field} tabular-nums`}
            />
          </label>
          <label className="block">
            <span className={label}>Do (nepovinné)</span>
            <input
              name="endTime"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              placeholder="HH:mm"
              className={`${field} tabular-nums`}
            />
          </label>
        </div>

        <label className="block">
          <span className={label}>Poznámka (nepovinné)</span>
          <input name="notes" className={field} />
        </label>

        <label className="block">
          <span className={label}>Cena (Kč)</span>
          <input
            name="customPrice"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className={`${field} tabular-nums`}
          />
          <span className="mt-1.5 block text-xs italic text-slate-500">
            Prázdné = automaticky podle dne. Zvýhodněné kategorie platí svou
            sazbu i tady.
          </span>
        </label>

        <button type="submit" className={`${btnPrimary} self-start`}>
          Vytvořit trénink
        </button>
      </form>
    </section>
  );
}
