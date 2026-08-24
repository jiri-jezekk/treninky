import type { GroupOption } from "@/lib/groups";

/** Zaškrtávátka kategorií. Kategorie přicházejí z databáze, ne z pevného seznamu. */
export function GroupCheckboxes({
  groups,
  name = "skupiny",
  defaultSelected,
  form,
}: {
  groups: GroupOption[];
  name?: string;
  defaultSelected?: string[];
  /** Např. sdílený formulář pro hromadné uložení (`form="id"`). */
  form?: string;
}) {
  const sel = new Set(defaultSelected ?? []);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Zatím nemáte žádné kategorie — založte první tlačítkem „Kategorie“.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {groups.map((g) => (
        <label
          key={g.id}
          className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"
        >
          <input
            type="checkbox"
            form={form}
            name={name}
            value={g.id}
            defaultChecked={sel.has(g.id)}
            className="rounded border-slate-300 text-slate-700"
          />
          <span
            aria-hidden
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: g.color }}
          />
          {g.name}
        </label>
      ))}
    </div>
  );
}
