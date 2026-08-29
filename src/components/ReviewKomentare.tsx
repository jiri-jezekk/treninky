"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addComment, deleteComment } from "@/actions/rozbory";
import { czPlural } from "@/lib/czech";

/**
 * Komentáře k rozboru.
 *
 * Rozbor je debata, ne vývěska: hráč, co u toho byl, ví věci, které
 * z videa vidět nejsou. Jedna komponenta pro trenéra i pro hráčský
 * odkaz — liší se jen tím, kdo se ověřuje (`payToken`) a kdo smí mazat.
 *
 * Komentář patří celému rozboru, ne jednotlivému zápisu. U zápisu je
 * poznámka trenéra a míchat obojí by znamenalo, že se v tom nikdo
 * nevyzná.
 */

export type Komentar = {
  id: string;
  authorName: string;
  body: string;
  createdLabel: string;
  /** Null u trenéra — ten hráčský záznam nemá. */
  playerId: string | null;
};

export function ReviewKomentare({
  reviewId,
  komentare,
  payToken,
  viewerId,
  trener = false,
}: {
  reviewId: string;
  komentare: Komentar[];
  /** V hráčském odkazu; trenér ho nemá a ověřuje se přihlášením. */
  payToken?: string;
  /** Kdo se dívá — svůj komentář smí smazat. */
  viewerId?: string;
  /** Trenér smaže kterýkoli. */
  trener?: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [chyba, setChyba] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const posli = () => {
    const cisty = text.trim();
    if (cisty === "") return;
    setChyba(null);
    start(async () => {
      const res = await addComment(reviewId, cisty, payToken);
      if (!res.ok) {
        setChyba(res.error);
        return;
      }
      setText("");
      router.refresh();
    });
  };

  return (
    <div>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="font-heading text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
          Komentáře
        </span>
        <span className="flex-1" />
        <span className="text-xs text-slate-500">
          {komentare.length}{" "}
          {czPlural(komentare.length, "komentář", "komentáře", "komentářů")}
        </span>
      </div>

      {komentare.length === 0 ? (
        <p className="text-sm italic text-slate-500">
          Zatím nic. Napiš, co jsi u toho viděl — z videa není poznat všechno.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {komentare.map((k) => {
            const smiSmazat = trener || (viewerId != null && k.playerId === viewerId);
            return (
              <li
                key={k.id}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 truncate text-[13px] font-medium text-slate-800">
                    {k.authorName}
                    {k.playerId == null && (
                      <span className="ml-1.5 text-[11px] font-normal text-club">trenér</span>
                    )}
                  </span>
                  <span className="flex-1" />
                  <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                    {k.createdLabel}
                  </span>
                  {smiSmazat && (
                    <button
                      type="button"
                      aria-label="Smazat komentář"
                      className="shrink-0 rounded px-1 text-slate-500 transition hover:bg-red-50 hover:text-red-800"
                      onClick={() =>
                        start(async () => {
                          const res = await deleteComment(k.id, payToken);
                          if (!res.ok) setChyba(res.error);
                          else router.refresh();
                        })
                      }
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-line text-[13.5px] leading-snug text-slate-700">
                  {k.body}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Napiš komentář k rozboru…"
          aria-label="Nový komentář"
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-club"
        />
        {chyba && (
          <p role="alert" className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {chyba}
          </p>
        )}
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={posli}
            disabled={pending || text.trim() === ""}
            className="rounded-md border border-club bg-club px-3.5 py-1.5 text-sm font-medium text-onclub transition hover:bg-club-hover disabled:opacity-60"
          >
            {pending ? "Ukládám…" : "Přidat komentář"}
          </button>
        </div>
      </div>
    </div>
  );
}
