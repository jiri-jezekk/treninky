import {
  PLAYER_GROUP_LABELS,
  PLAYER_GROUP_ORDER,
} from "@/lib/player-groups";
import type { PlayerGroup } from "@prisma/client";

export function GroupCheckboxes({
  name = "skupiny",
  defaultSelected,
  form,
}: {
  name?: string;
  defaultSelected?: PlayerGroup[];
  /** Např. sdílený formulář pro hromadné uložení (`form="id"`). */
  form?: string;
}) {
  const sel = new Set(defaultSelected ?? []);
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {PLAYER_GROUP_ORDER.map((g) => (
        <label
          key={g}
          className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
        >
          <input
            type="checkbox"
            form={form}
            name={name}
            value={g}
            defaultChecked={sel.has(g)}
            className="rounded border-slate-300 text-slate-700"
          />
          {PLAYER_GROUP_LABELS[g]}
        </label>
      ))}
    </div>
  );
}
