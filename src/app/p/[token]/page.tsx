import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortalGate } from "./PortalGate";
import { PortalQr } from "./PortalQr";
import { SessionRefresh } from "./SessionRefresh";
import { getPlayerBalance } from "@/lib/player-balance";
import { hasPortalSession } from "@/lib/player-portal-session";
import { formatCzkFromCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Moje platby",
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
      user: { select: { id: true, bankIban: true, clubName: true } },
    },
  });
  if (!player) notFound();

  const clubName = player.user.clubName?.trim() || "DC Liberec";

  if (!player.passwordHash) {
    return (
      <Shell clubName={clubName}>
        <PortalGate payToken={token} mode="set" playerName={player.name} />
      </Shell>
    );
  }

  if (!(await hasPortalSession(token))) {
    return (
      <Shell clubName={clubName}>
        <PortalGate payToken={token} mode="enter" playerName={player.name} />
      </Shell>
    );
  }

  const balance = await getPlayerBalance(player.user.id, player.id);
  if (!balance) notFound();

  const firstName = player.name.split(" ")[0];

  return (
    <Shell clubName={clubName}>
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

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
          Naskenuj QR v bankovní aplikaci.
          <br />
          Sedí něco jinak? Napiš trenérovi.
        </p>
      </div>
    </Shell>
  );
}

function Shell({
  clubName,
  children,
}: {
  clubName: string;
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-10">
      <p className="mb-6 font-heading text-sm font-extrabold uppercase tracking-[0.2em] text-club">
        {clubName}
      </p>
      {children}
    </main>
  );
}
