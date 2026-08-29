import Link from "next/link";

/**
 * Filtr seznamu rozborů — kategorie a sezóna.
 *
 * Odkazy, ne formulář: filtr se dá poslat druhému, vrátit se na něj
 * zpátky a funguje i bez JavaScriptu. Klub hraje ve víc sestavách
 * a míchat jejich čísla dohromady nedává smysl.
 */

export type Volba = { id: string; name: string; color?: string };

function href(zaklad: string, groupId?: string, seasonId?: string): string {
  const q = new URLSearchParams();
  if (groupId) q.set("kategorie", groupId);
  if (seasonId) q.set("sezona", seasonId);
  const s = q.toString();
  return s === "" ? zaklad : `${zaklad}?${s}`;
}

function chip(vybrano: boolean): string {
  return `rounded-full border px-2.5 py-1 text-[12.5px] transition ${
    vybrano
      ? "border-club-line bg-club-soft font-medium text-club"
      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
  }`;
}

export function FiltrRozboruChips({
  zaklad,
  kategorie,
  sezony,
  groupId,
  seasonId,
}: {
  /** Adresa stránky bez parametrů, třeba `/rozbory` nebo `/p/xyz/rozbory`. */
  zaklad: string;
  kategorie: Volba[];
  sezony: Volba[];
  groupId?: string;
  seasonId?: string;
}) {
  // Bez zařazených rozborů by filtr byl řada tlačítek, která nic nedělá.
  if (kategorie.length === 0 && sezony.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {kategorie.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-xs text-slate-500">Kategorie:</span>
          <Link href={href(zaklad, undefined, seasonId)} className={chip(!groupId)}>
            Vše
          </Link>
          {kategorie.map((k) => (
            <Link
              key={k.id}
              href={href(zaklad, k.id, seasonId)}
              className={chip(groupId === k.id)}
            >
              {k.color && (
                <i
                  aria-hidden
                  style={{ background: k.color }}
                  className="mr-1.5 inline-block h-1.5 w-1.5 rotate-45 rounded-[2px] align-middle"
                />
              )}
              {k.name}
            </Link>
          ))}
        </div>
      )}

      {sezony.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-xs text-slate-500">Sezóna:</span>
          <Link href={href(zaklad, groupId, undefined)} className={chip(!seasonId)}>
            Vše
          </Link>
          {sezony.map((s) => (
            <Link
              key={s.id}
              href={href(zaklad, groupId, s.id)}
              className={chip(seasonId === s.id)}
            >
              {s.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
