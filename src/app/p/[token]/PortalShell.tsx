import Link from "next/link";

/**
 * Rám všech stránek v odkazu hráče.
 *
 * Byl čtyřikrát opsaný — na platbách, v ratingu, v profilu hráče
 * a v detailu duelu. Když se měnil, muselo se to hlídat na čtyřech
 * místech; teď je na jednom.
 *
 * Název klubu nahoře je zároveň cesta zpátky na platby. Šipka „← Moje
 * platby“ je tam pořád, ale nadpis je větší terč a lidi na něj klikají
 * automaticky. Na samotné stránce plateb zůstává obyčejným textem —
 * odkaz sám na sebe nikam nevede a jen mate.
 */
export function PortalShell({
  clubName,
  token,
  home = false,
  children,
}: {
  clubName: string;
  token: string;
  /** true na stránce plateb, kam nadpis vede. */
  home?: boolean;
  children: React.ReactNode;
}) {
  const styl =
    "mb-6 font-heading text-sm font-extrabold uppercase tracking-[0.2em] text-club";

  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-10">
      {home ? (
        <p className={styl}>{clubName}</p>
      ) : (
        <Link
          href={`/p/${token}`}
          className={`${styl} transition hover:opacity-70`}
        >
          {clubName}
        </Link>
      )}
      {children}
    </main>
  );
}
