import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PayAllPanel } from "./PayAllPanel";
import { PortalGate } from "./PortalGate";
import { PortalQr } from "./PortalQr";
import { SessionRefresh } from "./SessionRefresh";
import { getPlayerBalance } from "@/lib/player-balance";
import { hasPortalSession } from "@/lib/player-portal-session";
import { formatCzkFromCents } from "@/lib/money";
import { countSharedReviews } from "@/lib/reviews";
import { czPlural } from "@/lib/czech";
import { prisma } from "@/lib/prisma";
import { PortalShell } from "./PortalShell";

export const metadata: Metadata = {
  title: "Můj profil",
  // Veřejná adresa s tajným tokenem nemá co dělat ve vyhledávačích.
  robots: { index: false, follow: false },
};

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const player = await prisma.player.findUnique({
    where: { payToken: token },
    select: {
      id: true,
      name: true,
      passwordHash: true,
      user: {
        select: {
          id: true,
          bankIban: true,
          clubName: true,
          playerVisibleFrom: true,
        },
      },
    },
  });
  if (!player) notFound();

  const clubName = player.user.clubName?.trim() || "DC Liberec";

  if (!player.passwordHash) {
    return (
      <PortalShell clubName={clubName} token={token} home>
        <PortalGate payToken={token} mode="set" playerName={player.name} />
      </PortalShell>
    );
  }

  if (!(await hasPortalSession(token))) {
    return (
      <PortalShell clubName={clubName} token={token} home>
        <PortalGate payToken={token} mode="enter" playerName={player.name} />
      </PortalShell>
    );
  }

  // Hráč vidí jen běžící sezónu. Starší dluhy zůstávají trenérovi
  // v jeho výpisu — a nesmí se dostat ani do souhrnné platby.
  const balance = await getPlayerBalance(
    player.user.id,
    player.id,
    undefined,
    player.user.playerVisibleFrom,
  );
  if (!balance) notFound();

  const rozboru = await countSharedReviews(
    String(player.user.id),
    String(player.id),
  );

  const firstName = player.name.split(" ")[0];

  return (
    <PortalShell clubName={clubName} token={token} home>
      <SessionRefresh payToken={token} />

      <div className="mx-auto w-full max-w-md">
        <h1 className="text-center font-heading text-2xl font-extrabold text-slate-800">
          Ahoj {firstName}!
        </h1>
        <p className="mt-1 text-center text-sm text-slate-500">Přehled tvých plateb</p>

        {balance.unpaid.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
            <p className="font-heading text-3xl font-extrabold text-emerald-800">0 Kč</p>
            <p className="mt-2 font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
              Nic nedlužíš
            </p>
            <p className="mt-4 text-sm text-slate-600">Máš vše vyrovnané. Díky!</p>
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-6 py-6 text-center">
              <p className="font-heading text-4xl font-extrabold text-red-800">
                {formatCzkFromCents(balance.totalCents)}
              </p>
              <p className="mt-2 font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
                Celkem k úhradě
              </p>
            </div>

            <PayAllPanel
              payToken={token}
              iban={player.user.bankIban}
              playerName={player.name}
              totalCents={balance.totalCents}
              itemCount={balance.unpaid.length}
            />

            <div className="mt-4 flex flex-col gap-4">
              {balance.unpaid.map((item) => (
                <div
                  key={item.key}
                  className="rounded-2xl border border-slate-200 bg-white p-5"
                >
                  <h2 className="font-heading text-base font-bold text-slate-800">
                    {item.label}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">{item.meta}</p>

                  <div className="mt-4 flex items-center justify-between gap-4">
                    <span className="font-heading text-xl font-extrabold text-slate-800">
                      {formatCzkFromCents(item.amountCents)}
                    </span>
                    <PortalQr
                      iban={player.user.bankIban}
                      amountCents={item.amountCents}
                      message={`${item.label} - ${player.name}`}
                      variableSymbol={item.variableSymbol}
                    />
                  </div>

                  <p className="mt-3 text-center text-xs tabular-nums text-slate-500">
                    Variabilní symbol{" "}
                    <b className="text-slate-800">{item.variableSymbol}</b>
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        {balance.paid.length > 0 && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <h2 className="font-heading text-xs font-bold uppercase tracking-wider text-emerald-800">
              Už zaplaceno
            </h2>
            <ul className="mt-2 flex flex-col gap-1 text-xs text-slate-600">
              {balance.paid.map((item) => (
                <li key={item.key}>
                  {item.label} — {formatCzkFromCents(item.amountCents)}
                </li>
              ))}
            </ul>
          </div>
        )}

        <a
          href={`/p/${token}/rating`}
          className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-club-line bg-club-soft px-5 py-4 transition hover:border-club"
        >
          <span className="min-w-0">
            <span className="block font-heading text-sm font-bold text-slate-800">
              Rating a duely
            </span>
            <span className="block text-xs text-slate-600">
              Žebříček, výzvy, vyzvi spoluhráče
            </span>
          </span>
          <span className="shrink-0 text-club">→</span>
        </a>

        {/* Odkaz jen když je co ukázat — prázdná stránka by mátla. */}
        {rozboru > 0 && (
          <a
            href={`/p/${token}/rozbory`}
            className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-5 py-4 transition hover:border-club"
          >
            <span className="min-w-0">
              <span className="block font-heading text-sm font-bold text-slate-800">
                Rozbory zápasů
              </span>
              <span className="block text-xs text-slate-600">
                {rozboru} {czPlural(rozboru, "rozbor", "rozbory", "rozborů")} od
                trenéra
              </span>
            </span>
            <span className="shrink-0 text-club">→</span>
          </a>
        )}

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
          Naskenuj QR v bankovní aplikaci.
          <br />
          Něco nesedí? Napiš trenérovi.
        </p>
      </div>
    </PortalShell>
  );
}
