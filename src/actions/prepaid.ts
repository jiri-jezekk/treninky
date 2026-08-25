"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { parseDateInput, rangesOverlap } from "@/lib/prepaid";
import { variableSymbolPrepayment } from "@/lib/variable-symbol";
import type { IncomeKind } from "@/lib/player-balance";

const INCOME_KINDS = ["MEMBERSHIP", "TRAINING", "EVENT", "GOODS", "OTHER"] as const;

/**
 * Vstup je `unknown` schválně: sem chodí jednou hodnota z formuláře,
 * podruhé výchozí druh ze sezóny (a ten může být undefined). Užší typ
 * by na tomhle rozdílu spadl až při buildu na Vercelu.
 */
function parseIncomeKind(raw: unknown): IncomeKind {
  const value = String(raw ?? "");
  return (INCOME_KINDS as readonly string[]).includes(value)
    ? (value as IncomeKind)
    : "TRAINING";
}

/** Kč z formuláře na haléře. Prázdné pole i nesmysl znamenají nulu. */
function parseAmountCents(raw: unknown): number {
  const value = String(raw ?? "").replace(/\s/g, "").replace(",", ".");
  if (value === "") return 0;
  const kc = Number(value);
  if (!Number.isFinite(kc) || kc < 0) return 0;
  return Math.round(kc * 100);
}

function revalidatePrepaidRelated() {
  revalidatePath("/platby");
  revalidatePath("/platby/predplatne");
  revalidatePath("/platby/ucetnictvi");
  revalidatePath("/hraci");
  revalidatePath("/treninky");
  revalidatePath("/prehled");
}

// ---------------------------------------------------------------- sezóny

/** Nejnižší volné číslo sezóny — je součástí popisu, ne symbolu, ale ať drží řadu. */
async function nextSeasonNumber(userId: string): Promise<number> {
  const taken = await prisma.season.findMany({
    where: { userId },
    select: { number: true },
    orderBy: { number: "asc" },
  });
  let expected = 1;
  for (const { number } of taken) {
    if (number > expected) break;
    if (number === expected) expected++;
  }
  return expected;
}

export async function createSeason(formData: FormData) {
  const userId = await requireUserId();

  const name = String(formData.get("name") ?? "").trim();
  const startsOn = parseDateInput(formData.get("startsOn"));
  const endsOn = parseDateInput(formData.get("endsOn"));
  if (!name || !startsOn || !endsOn) return;
  if (endsOn < startsOn) return;

  await prisma.season.create({
    data: {
      userId,
      name,
      number: await nextSeasonNumber(userId),
      startsOn,
      endsOn,
      defaultPriceCents: parseAmountCents(formData.get("defaultPrice")) || null,
      incomeKind: parseIncomeKind(formData.get("incomeKind")),
    },
  });
  revalidatePrepaidRelated();
}

export async function updateSeason(seasonId: string, formData: FormData) {
  const userId = await requireUserId();
  const owned = await prisma.season.findFirst({
    where: { id: seasonId, userId },
    select: { id: true },
  });
  if (!owned) return;

  const name = String(formData.get("name") ?? "").trim();
  const startsOn = parseDateInput(formData.get("startsOn"));
  const endsOn = parseDateInput(formData.get("endsOn"));
  if (!name || !startsOn || !endsOn) return;
  if (endsOn < startsOn) return;

  await prisma.season.update({
    where: { id: seasonId },
    data: {
      name,
      startsOn,
      endsOn,
      defaultPriceCents: parseAmountCents(formData.get("defaultPrice")) || null,
      incomeKind: parseIncomeKind(formData.get("incomeKind")),
    },
  });

  // Posun sezóny se propíše jen do předplatných, která zatím drží její
  // původní hranice. Ručně upravená období zůstanou, jak si je trenér nastavil.
  if (formData.get("applyToPrepayments") === "on") {
    await prisma.prepayment.updateMany({
      where: { seasonId, userId },
      data: { startsOn, endsOn },
    });
  }

  revalidatePrepaidRelated();
}

/**
 * Smaže sezónu. Předplatná zůstanou i s obdobím — jen ztratí název sezóny.
 * Zrušit hráči zpětně předplacené období by mu obnovilo staré platby.
 */
export async function deleteSeason(seasonId: string) {
  const userId = await requireUserId();
  await prisma.season.deleteMany({ where: { id: seasonId, userId } });
  revalidatePrepaidRelated();
}

// ------------------------------------------------------------ předplatné

/** Nejnižší volné pořadí předplatného u hráče — druhá půlka variabilního symbolu. */
async function nextPrepaymentSequence(playerId: string): Promise<number> {
  const taken = await prisma.prepayment.findMany({
    where: { playerId },
    select: { vs: true },
  });
  const used = new Set(
    taken
      .map((p) => Number(p.vs.slice(5, 7)))
      .filter((n) => Number.isInteger(n) && n > 0),
  );
  let expected = 1;
  while (used.has(expected) && expected < 100) expected++;
  return expected;
}

/**
 * Přidá hráči předplatné. Období se bere ze sezóny, pokud si trenér
 * nevyplní vlastní — hráč, který nastoupí v půlce roku, má jiné datum od.
 */
export async function addPrepayment(formData: FormData) {
  const userId = await requireUserId();

  const playerId = String(formData.get("playerId") ?? "");
  const seasonIdRaw = String(formData.get("seasonId") ?? "");
  const seasonId = seasonIdRaw === "" || seasonIdRaw === "vlastni" ? null : seasonIdRaw;

  const [player, season] = await Promise.all([
    prisma.player.findFirst({
      where: { id: playerId, userId },
      select: { id: true, number: true },
    }),
    seasonId
      ? prisma.season.findFirst({ where: { id: seasonId, userId } })
      : Promise.resolve(null),
  ]);
  if (!player) return;
  if (seasonId && !season) return;

  const startsOn = parseDateInput(formData.get("startsOn")) ?? season?.startsOn ?? null;
  const endsOn = parseDateInput(formData.get("endsOn")) ?? season?.endsOn ?? null;
  if (!startsOn || !endsOn || endsOn < startsOn) return;

  // Dvě předplatná přes stejné dny by znamenala, že hráč zaplatil dvakrát
  // za totéž období — a v účetnictví by seděl příjem bez protipoložky.
  const existing = await prisma.prepayment.findMany({
    where: { playerId: player.id },
    select: { startsOn: true, endsOn: true },
  });
  if (existing.some((e) => rangesOverlap(e, { startsOn, endsOn }))) return;

  const amountRaw = formData.get("amount");
  const amountCents =
    amountRaw == null || String(amountRaw).trim() === ""
      ? (season?.defaultPriceCents ?? 0)
      : parseAmountCents(amountRaw);

  await prisma.prepayment.create({
    data: {
      userId,
      playerId: player.id,
      seasonId,
      startsOn,
      endsOn,
      amountCents,
      vs: variableSymbolPrepayment(
        player.number,
        await nextPrepaymentSequence(player.id),
      ),
      incomeKind: parseIncomeKind(formData.get("incomeKind") ?? season?.incomeKind),
      note: String(formData.get("note") ?? "").trim() || null,
      paidAt: formData.get("paid") === "on" ? new Date() : null,
    },
  });
  revalidatePrepaidRelated();
}

/** Přidá sezónu rovnou několika hráčům najednou. Kdo ji už má, přeskočí se. */
export async function addPrepaymentBulk(formData: FormData) {
  const userId = await requireUserId();

  const seasonId = String(formData.get("seasonId") ?? "");
  const season = await prisma.season.findFirst({ where: { id: seasonId, userId } });
  if (!season) return;

  const playerIds = formData.getAll("playerIds").map(String).filter(Boolean);
  if (playerIds.length === 0) return;

  const players = await prisma.player.findMany({
    where: { id: { in: playerIds }, userId },
    select: { id: true, number: true },
  });

  const amountRaw = formData.get("amount");
  const amountCents =
    amountRaw == null || String(amountRaw).trim() === ""
      ? (season.defaultPriceCents ?? 0)
      : parseAmountCents(amountRaw);

  for (const player of players) {
    const existing = await prisma.prepayment.findMany({
      where: { playerId: player.id },
      select: { startsOn: true, endsOn: true },
    });
    if (
      existing.some((e) =>
        rangesOverlap(e, { startsOn: season.startsOn, endsOn: season.endsOn }),
      )
    ) {
      continue;
    }

    await prisma.prepayment.create({
      data: {
        userId,
        playerId: player.id,
        seasonId: season.id,
        startsOn: season.startsOn,
        endsOn: season.endsOn,
        amountCents,
        vs: variableSymbolPrepayment(
          player.number,
          await nextPrepaymentSequence(player.id),
        ),
        incomeKind: season.incomeKind,
      },
    });
  }
  revalidatePrepaidRelated();
}

export async function updatePrepayment(prepaymentId: string, formData: FormData) {
  const userId = await requireUserId();
  const current = await prisma.prepayment.findFirst({
    where: { id: prepaymentId, userId },
  });
  if (!current) return;

  const startsOn = parseDateInput(formData.get("startsOn")) ?? current.startsOn;
  const endsOn = parseDateInput(formData.get("endsOn")) ?? current.endsOn;
  if (endsOn < startsOn) return;

  const others = await prisma.prepayment.findMany({
    where: { playerId: current.playerId, id: { not: prepaymentId } },
    select: { startsOn: true, endsOn: true },
  });
  if (others.some((e) => rangesOverlap(e, { startsOn, endsOn }))) return;

  await prisma.prepayment.update({
    where: { id: prepaymentId },
    data: {
      startsOn,
      endsOn,
      amountCents: parseAmountCents(formData.get("amount")),
      incomeKind: parseIncomeKind(formData.get("incomeKind")),
      note: String(formData.get("note") ?? "").trim() || null,
    },
  });
  revalidatePrepaidRelated();
}

export async function setPrepaymentPaid(prepaymentId: string, paid: boolean) {
  const userId = await requireUserId();
  await prisma.prepayment.updateMany({
    where: { id: prepaymentId, userId },
    data: { paidAt: paid ? new Date() : null },
  });
  revalidatePrepaidRelated();
}

/**
 * Smaže předplatné. Tréninky z toho období se hráči zase začnou účtovat —
 * proto to stránka hlásí dopředu.
 */
export async function deletePrepayment(prepaymentId: string) {
  const userId = await requireUserId();
  await prisma.prepayment.deleteMany({ where: { id: prepaymentId, userId } });
  revalidatePrepaidRelated();
}
