/** České skloňování po číslovce: 1 → one, 2–4 → few, 0 a 5+ → many. */
export function czPlural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}

/** „12 hráčů“, „3 hráči“, „1 hráč“. */
export function czPlayers(n: number): string {
  return `${n} ${czPlural(n, "hráč", "hráči", "hráčů")}`;
}

/** Iniciály do kolečka u jména — nejvýš dvě písmena. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}
