import type { GroupOption } from "@/lib/groups";

export const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500";
export const field =
  "mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-base text-slate-900 outline-none focus:border-club sm:text-sm";
export const btnPrimary =
  "inline-flex min-h-10 items-center justify-center rounded-full border-2 border-club bg-club px-4 py-2 font-heading text-sm font-semibold text-onclub transition hover:bg-club-hover";
export const btnOutline =
  "inline-flex min-h-10 items-center justify-center rounded-full border-2 border-slate-300 px-4 py-2 font-heading text-sm font-semibold text-slate-800 transition hover:border-club hover:bg-club-soft";
export const btnSm = "px-4 py-2 text-sm";
export const mini =
  "inline-flex min-h-10 items-center rounded-full border border-slate-200 px-3.5 py-1.5 text-sm text-slate-600 transition hover:border-club hover:bg-club-soft hover:text-slate-900";

export type PlanFieldValues = {
  /** YYYY-MM-DD pro nativní výběr data. */
  date: string;
  time: string;
  durationMinutes: number | null;
  groupId: string | null;
  topic: string | null;
};

/** Hlavička plánu — stejná pro založení i úpravu. */
export function PlanFields({
  values,
  groups,
}: {
  values: PlanFieldValues;
  groups: GroupOption[];
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="col-span-2 block min-w-0 sm:col-span-1">
          <span className={label}>Datum</span>
          <input
            name="date"
            type="date"
            required
            defaultValue={values.date}
            className={`${field} tabular-nums`}
          />
        </label>
        <label className="block min-w-0">
          <span className={label}>Začátek</span>
          <input
            name="time"
            type="time"
            required
            defaultValue={values.time}
            className={`${field} tabular-nums`}
          />
        </label>
        <label className="block min-w-0">
          <span className={label}>Délka (min)</span>
          <input
            name="durationMinutes"
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            defaultValue={values.durationMinutes ?? ""}
            placeholder="90"
            className={`${field} tabular-nums`}
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <label className="block min-w-0">
          <span className={label}>Kategorie</span>
          <select
            name="groupId"
            defaultValue={values.groupId ?? ""}
            className={field}
          >
            <option value="">— bez kategorie —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className={label}>Téma / cíl</span>
          <input
            name="topic"
            defaultValue={values.topic ?? ""}
            placeholder="Protiútok, rychlost"
            className={field}
          />
        </label>
      </div>
    </div>
  );
}
