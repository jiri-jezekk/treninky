"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createReview, saveEventTypes } from "@/actions/rozbory";
import { REVIEW_COLORS } from "@/lib/review-defaults";
import type { ReviewSideValue, StatType } from "@/lib/review-stats";

/**
 * Tlačítka nad seznamem rozborů: nový rozbor a správa počítadel.
 *
 * Obojí v modalu — jsou to krátké formuláře, kvůli kterým nemá smysl
 * odcházet ze seznamu.
 */

const btn =
  "rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 hover:text-slate-800";
const btnPrimary =
  "rounded-md border border-club bg-club px-3.5 py-1.5 text-sm font-medium text-onclub transition hover:bg-club-hover";
const field =
  "mt-1.5 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-club";
const label =
  "font-heading text-[11px] font-bold uppercase tracking-[0.06em] text-slate-700";

const SIDE_LABEL: Record<ReviewSideValue, string> = {
  FOR: "Pro nás",
  AGAINST: "Proti nám",
  NEUTRAL: "Neutrální",
};

export function RozboryActions({
  types,
  today,
}: {
  types: StatType[];
  today: string;
}) {
  const [modal, setModal] = useState<null | "novy" | "tlacitka">(null);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} onClick={() => setModal("tlacitka")}>
          Tlačítka
        </button>
        <button type="button" className={btnPrimary} onClick={() => setModal("novy")}>
          Nový rozbor
        </button>
      </div>

      {modal === "novy" && (
        <Modal title="Nový rozbor" onClose={() => setModal(null)}>
          <NovyRozbor today={today} onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal === "tlacitka" && (
        <Modal title="Tlačítka počítadel" onClose={() => setModal(null)}>
          <SpravaTlacitek types={types} onDone={() => setModal(null)} />
        </Modal>
      )}
    </>
  );
}

/* ------------------------------------------------------ modal */

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(2,6,23,.85)] backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[86vh] w-full max-w-lg min-w-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
        <h2 className="mb-4 text-base font-semibold text-slate-800">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------- nový rozbor */

function NovyRozbor({ today, onDone }: { today: string; onDone: () => void }) {
  const router = useRouter();
  const [chyba, setChyba] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      action={(fd) => {
        setChyba(null);
        start(async () => {
          const res = await createReview(fd);
          if (!res.ok) {
            setChyba(res.error);
            return;
          }
          onDone();
          // message nese id nového rozboru — rovnou se do něj skočí,
          // protože další krok je vždycky koukat na video.
          if (res.message) router.push(`/rozbory/${res.message}`);
          else router.refresh();
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={label}>Název</span>
          <input name="name" required placeholder="Liberec Open — semifinále" className={field} />
        </label>
        <label className="block">
          <span className={label}>Soupeř</span>
          <input name="opponent" placeholder="Prague Rebels" className={field} />
        </label>
        <label className="block">
          <span className={label}>Datum</span>
          <input type="date" name="playedOn" defaultValue={today} className={field} />
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>Odkaz na video</span>
          <input name="video" placeholder="https://youtu.be/…" className={field} />
          <span className="mt-1 block text-xs italic text-slate-500">
            Nepovinné. Bez videa běží stopky a zapisovat jde stejně.
          </span>
        </label>
      </div>

      {chyba && (
        <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {chyba}
        </p>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className={btn} onClick={onDone}>
          Zrušit
        </button>
        <button type="submit" className={btnPrimary} disabled={pending}>
          {pending ? "Zakládám…" : "Založit"}
        </button>
      </div>
    </form>
  );
}

/* --------------------------------------------- správa tlačítek */

type Radek = {
  id?: string;
  label: string;
  color: string;
  side: ReviewSideValue;
  /** Nadřazená skupina (HIT, DEAD…); prázdné = tlačítko stojí samo. */
  groupLabel: string;
  /** Podskupina uvnitř skupiny (counter, z útoku…). */
  subLabel: string;
};

function SpravaTlacitek({ types, onDone }: { types: StatType[]; onDone: () => void }) {
  const router = useRouter();
  const [rows, setRows] = useState<Radek[]>(
    types.map((t) => ({
      id: t.id,
      label: t.label,
      color: t.color,
      side: t.side,
      groupLabel: t.groupLabel ?? "",
      subLabel: t.subLabel ?? "",
    })),
  );
  const [chyba, setChyba] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const uprav = (i: number, patch: Partial<Radek>) =>
    setRows((r) => r.map((x, j) => (i === j ? { ...x, ...patch } : x)));

  return (
    <div>
      <p className="mb-4 text-xs text-slate-500">
        Platí pro celý klub, ne pro jeden rozbor — jinak by stejná akce měla
        v každém zápase jiný název a porovnávat by se nedalo. Odebrané tlačítko
        se schová z počítadel, ale ve starých zápisech zůstane.
      </p>
      <p className="mb-4 text-xs text-slate-500">
        Skupina (třeba HIT nebo DEAD) tlačítka spojí dohromady. Ve statistice
        pak vedle počtu vyjde i podíl uvnitř skupiny — teprve ten řekne, co
        z toho funguje. Prázdná skupina znamená, že tlačítko stojí samo.
      </p>
      <p className="mb-4 text-xs text-slate-500">
        Podskupina spojí tlačítka, která jsou tentýž herní moment zahraný
        jinak — „Hit counter fast“ a „Hit counter slow“ dej obojí do
        podskupiny <em>counter</em> a ve statistice uvidíš, kolik z hitů
        padlo z counteru dohromady.
      </p>

      {/* Nabídka už použitých skupin: ať se HIT nezapíše třikrát jinak. */}
      <datalist id="skupiny-tlacitek">
        {[...new Set(rows.map((r) => r.groupLabel.trim()).filter((g) => g !== ""))].map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <datalist id="podskupiny-tlacitek">
        {[...new Set(rows.map((r) => r.subLabel.trim()).filter((g) => g !== ""))].map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      <div className="flex flex-col gap-3">
        {rows.map((t, i) => (
          <div key={t.id ?? `novy-${i}`} className="rounded-lg border border-slate-200 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={t.label}
                onChange={(e) => uprav(i, { label: e.target.value })}
                aria-label="Název tlačítka"
                className="min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900 outline-none focus:border-club"
              />
              <select
                value={t.side}
                onChange={(e) => uprav(i, { side: e.target.value as ReviewSideValue })}
                aria-label="Strana"
                className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-club"
              >
                {(["FOR", "AGAINST", "NEUTRAL"] as const).map((s) => (
                  <option key={s} value={s}>
                    {SIDE_LABEL[s]}
                  </option>
                ))}
              </select>
              <input
                value={t.groupLabel}
                onChange={(e) => uprav(i, { groupLabel: e.target.value })}
                list="skupiny-tlacitek"
                placeholder="skupina"
                aria-label="Skupina"
                className="w-24 shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-club"
              />
              <input
                value={t.subLabel}
                onChange={(e) => uprav(i, { subLabel: e.target.value })}
                list="podskupiny-tlacitek"
                placeholder="podskupina"
                aria-label="Podskupina"
                className="w-28 shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-club"
              />
              <button
                type="button"
                aria-label="Odebrat tlačítko"
                className="shrink-0 rounded px-2 py-1 text-slate-500 transition hover:bg-red-50 hover:text-red-800"
                onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {REVIEW_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Barva ${c}`}
                  aria-pressed={c === t.color}
                  onClick={() => uprav(i, { color: c })}
                  style={{ background: c }}
                  className={`h-6 w-6 rounded-md border-2 ${
                    c === t.color ? "border-slate-700" : "border-transparent"
                  }`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className={`${btn} mt-3`}
        onClick={() =>
          setRows((r) => [
            ...r,
            {
              label: "Nová akce",
              color: REVIEW_COLORS[0]!,
              side: "NEUTRAL",
              groupLabel: "",
              subLabel: "",
            },
          ])
        }
      >
        + Přidat tlačítko
      </button>

      {chyba && (
        <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {chyba}
        </p>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className={btn} onClick={onDone}>
          Zrušit
        </button>
        <button
          type="button"
          className={btnPrimary}
          disabled={pending}
          onClick={() => {
            setChyba(null);
            start(async () => {
              const res = await saveEventTypes(
                rows.map((r) => ({
                  id: r.id,
                  label: r.label.trim(),
                  color: r.color,
                  side: r.side,
                  groupLabel: r.groupLabel.trim(),
                  subLabel: r.subLabel.trim(),
                })),
              );
              if (!res.ok) {
                setChyba(res.error);
                return;
              }
              onDone();
              router.refresh();
            });
          }}
        >
          {pending ? "Ukládám…" : "Uložit"}
        </button>
      </div>
    </div>
  );
}
