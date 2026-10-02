"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

type PickerPlayer = { id: string; name: string; number: number };

/** Bez diakritiky a velikosti písmen — „ja“ najde i „Jáchyma“. */
function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Výběr jednoho hráče s našeptávačem. Do formuláře posílá skryté pole
 * s id; viditelné pole je jen hledání. Dokud není nikdo vybraný, prohlížeč
 * formulář neodešle — místo chyby ze serveru se ukáže hláška u pole.
 */
export function PlayerPicker({
  players,
  name,
  defaultId,
  className,
}: {
  players: PickerPlayer[];
  name: string;
  defaultId?: string;
  className?: string;
}) {
  const initial = players.find((p) => p.id === defaultId) ?? null;
  const [selected, setSelected] = useState<PickerPlayer | null>(initial);
  const [query, setQuery] = useState(initial?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const matches = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return players;
    return players.filter(
      (p) => fold(p.name).includes(q) || String(p.number) === q,
    );
  }, [players, query]);

  useEffect(() => {
    inputRef.current?.setCustomValidity(selected ? "" : "Vyberte hráče ze seznamu.");
  }, [selected]);

  function choose(p: PickerPlayer) {
    setSelected(p);
    setQuery(p.name);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Začněte psát jméno…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Zpoždění, aby klik do seznamu stihl proběhnout dřív, než zmizí.
        onBlur={() => {
          // Celé jméno napsané ručně se bere jako výběr.
          if (!selected) {
            const exact = players.filter((p) => fold(p.name) === fold(query.trim()));
            if (exact.length === 1) choose(exact[0]!);
          }
          setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open && matches[active]) {
            e.preventDefault();
            choose(matches[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={className}
      />

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-300 bg-[#0f172a] py-1 shadow-2xl"
        >
          {matches.length === 0 ? (
            <li className="px-4 py-2.5 text-sm italic text-slate-500">
              Nikdo takový mezi aktivními hráči není.
            </li>
          ) : (
            matches.map((p, i) => (
              <li
                key={p.id}
                role="option"
                aria-selected={selected?.id === p.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(p);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm ${
                  i === active ? "bg-club-soft text-slate-900" : "text-slate-700"
                }`}
              >
                <span className="min-w-0 truncate">{p.name}</span>
                <span className="shrink-0 text-xs text-slate-500">č. {p.number}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
