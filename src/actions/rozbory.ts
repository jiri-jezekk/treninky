"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { parseDateInput } from "@/lib/prepaid";
import { parseYouTubeId } from "@/lib/youtube";
import { DEFAULT_EVENT_TYPES, REVIEW_COLORS } from "@/lib/review-defaults";
import type { ActionResult } from "@/lib/action-result";

function revalidateReviews(reviewId?: string) {
  revalidatePath("/rozbory");
  if (reviewId) revalidatePath(`/rozbory/${reviewId}`);
}

/** Rozbor patří přihlášenému trenérovi? Bez toho by šlo sáhnout na cizí. */
async function ownsReview(userId: string, reviewId: string): Promise<boolean> {
  const found = await prisma.videoReview.findFirst({
    where: { id: reviewId, userId },
    select: { id: true },
  });
  return found != null;
}

const reviewSchema = z.object({
  name: z.string().trim().min(1, "Název je povinný").max(120),
  opponent: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(4000).optional(),
});

/* ------------------------------------------------------ rozbor */

export async function createReview(formData: FormData): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const parsed = reviewSchema.safeParse({
      name: formData.get("name"),
      opponent: String(formData.get("opponent") ?? "").trim() || undefined,
      notes: String(formData.get("notes") ?? "").trim() || undefined,
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Neplatný rozbor." };
    }

    const playedOn = parseDateInput(formData.get("playedOn")) ?? new Date();

    // Ukládá se jen ID videa. Odkaz z telefonu s sebou nese čas,
    // playlist a sledovací parametry — celá URL by se měnila pokaždé.
    const videoRaw = String(formData.get("video") ?? "").trim();
    const videoId = videoRaw === "" ? null : parseYouTubeId(videoRaw);
    if (videoRaw !== "" && videoId == null) {
      return {
        ok: false,
        error: "Odkaz na video nevypadá jako YouTube. Rozbor jde založit i bez videa.",
      };
    }

    const review = await prisma.videoReview.create({
      data: {
        userId,
        name: parsed.data.name,
        opponent: parsed.data.opponent ?? null,
        notes: parsed.data.notes ?? null,
        playedOn,
        videoId,
      },
      select: { id: true },
    });

    revalidateReviews();
    return { ok: true, message: String(review.id) };
  } catch (e) {
    console.error("[createReview]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Rozbor se nepovedlo založit." };
  }
}

export async function updateReview(
  reviewId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    if (!(await ownsReview(userId, reviewId))) {
      return { ok: false, error: "Rozbor nenalezen." };
    }

    const parsed = reviewSchema.safeParse({
      name: formData.get("name"),
      opponent: String(formData.get("opponent") ?? "").trim() || undefined,
      notes: String(formData.get("notes") ?? "").trim() || undefined,
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Neplatný rozbor." };
    }

    const videoRaw = String(formData.get("video") ?? "").trim();
    const videoId = videoRaw === "" ? null : parseYouTubeId(videoRaw);
    if (videoRaw !== "" && videoId == null) {
      return { ok: false, error: "Odkaz na video nevypadá jako YouTube." };
    }

    await prisma.videoReview.updateMany({
      where: { id: reviewId, userId },
      data: {
        name: parsed.data.name,
        opponent: parsed.data.opponent ?? null,
        notes: parsed.data.notes ?? null,
        videoId,
        ...(parseDateInput(formData.get("playedOn")) && {
          playedOn: parseDateInput(formData.get("playedOn"))!,
        }),
      },
    });

    revalidateReviews(reviewId);
    return { ok: true, message: "Uloženo." };
  } catch (e) {
    console.error("[updateReview]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Uložení se nepovedlo." };
  }
}

export async function deleteReview(reviewId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    // Kaskáda smaže zápisy i sdílení; typy tlačítek jsou klubové
    // a zůstávají.
    await prisma.videoReview.deleteMany({ where: { id: reviewId, userId } });
    revalidateReviews();
    return { ok: true, message: "Rozbor smazán." };
  } catch (e) {
    console.error("[deleteReview]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Smazání se nepovedlo." };
  }
}

/* ------------------------------------------------------- zápisy */

const batchSchema = z.array(
  z.object({
    typeId: z.string().min(1),
    atSeconds: z.number().int().min(0).max(24 * 3600),
    playerId: z.string().min(1).nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
  }),
).max(200);

/**
 * Uloží dávku zápisů najednou.
 *
 * Dávkově schválně: při rychlé akci naklikáš pět zápisů za deset
 * sekund. Klient je drží v paměti, hned je vykreslí a odešle po
 * chvíli klidu. Kdyby šel na server request za každé kliknutí,
 * sekalo by to přesně ve chvíli, kdy potřebuješ klikat nejrychleji.
 */
export async function logEvents(
  reviewId: string,
  events: unknown,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    if (!(await ownsReview(userId, reviewId))) {
      return { ok: false, error: "Rozbor nenalezen." };
    }

    const parsed = batchSchema.safeParse(events);
    if (!parsed.success) {
      return { ok: false, error: "Zápisy mají nečekaný tvar, neuložilo se nic." };
    }
    if (parsed.data.length === 0) return { ok: true };

    // Typ i hráč musí patřit témuž klubu. Bez téhle kontroly by
    // stačilo podstrčit cizí id a zápis by se navázal napříč kluby.
    const [typy, hraci] = await Promise.all([
      prisma.reviewEventType.findMany({
        where: { userId, id: { in: parsed.data.map((e) => e.typeId) } },
        select: { id: true },
      }),
      prisma.player.findMany({
        where: {
          userId,
          id: {
            in: parsed.data
              .map((e) => e.playerId)
              .filter((id): id is string => typeof id === "string"),
          },
        },
        select: { id: true },
      }),
    ]);
    const znameTypy = new Set(typy.map((t) => String(t.id)));
    const znamiHraci = new Set(hraci.map((p) => String(p.id)));

    const data = parsed.data
      .filter((e) => znameTypy.has(e.typeId))
      .map((e) => ({
        reviewId,
        typeId: e.typeId,
        atSeconds: e.atSeconds,
        playerId: e.playerId && znamiHraci.has(e.playerId) ? e.playerId : null,
        note: e.note ?? null,
      }));

    if (data.length === 0) {
      return { ok: false, error: "Žádný ze zápisů nešel přiřadit k tlačítku." };
    }

    await prisma.reviewEvent.createMany({ data });

    revalidateReviews(reviewId);
    return { ok: true, message: `Uloženo ${data.length}.` };
  } catch (e) {
    console.error("[logEvents]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Zápisy se neuložily." };
  }
}

export async function updateEvent(
  eventId: string,
  patch: { note?: string | null; playerId?: string | null; atSeconds?: number },
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const event = await prisma.reviewEvent.findFirst({
      where: { id: eventId, review: { userId } },
      select: { id: true, reviewId: true },
    });
    if (!event) return { ok: false, error: "Zápis nenalezen." };

    // Hráč musí být z klubu — jinak by šlo cizím id navázat zápis
    // na hráče odjinud.
    let playerId: string | null | undefined = undefined;
    if (patch.playerId !== undefined) {
      if (patch.playerId === null || patch.playerId === "") {
        playerId = null;
      } else {
        const owned = await prisma.player.findFirst({
          where: { id: patch.playerId, userId },
          select: { id: true },
        });
        if (!owned) return { ok: false, error: "Hráč nenalezen." };
        playerId = patch.playerId;
      }
    }

    const atSeconds =
      patch.atSeconds != null && Number.isFinite(patch.atSeconds)
        ? Math.max(0, Math.round(patch.atSeconds))
        : undefined;

    await prisma.reviewEvent.updateMany({
      where: { id: eventId },
      data: {
        ...(patch.note !== undefined && {
          note: patch.note?.trim() ? patch.note.trim().slice(0, 500) : null,
        }),
        ...(playerId !== undefined && { playerId }),
        ...(atSeconds !== undefined && { atSeconds }),
      },
    });

    revalidateReviews(String(event.reviewId));
    return { ok: true };
  } catch (e) {
    console.error("[updateEvent]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Úprava se nepovedla." };
  }
}

export async function deleteEvent(eventId: string): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const event = await prisma.reviewEvent.findFirst({
      where: { id: eventId, review: { userId } },
      select: { id: true, reviewId: true },
    });
    if (!event) return { ok: false, error: "Zápis nenalezen." };

    await prisma.reviewEvent.deleteMany({ where: { id: eventId } });
    revalidateReviews(String(event.reviewId));
    return { ok: true };
  } catch (e) {
    console.error("[deleteEvent]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Smazání se nepovedlo." };
  }
}

/* ------------------------------------------------------ sdílení */

export async function setShares(
  reviewId: string,
  playerIds: string[],
  sharedAll: boolean,
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    if (!(await ownsReview(userId, reviewId))) {
      return { ok: false, error: "Rozbor nenalezen." };
    }

    const owned = await prisma.player.findMany({
      where: { userId, id: { in: playerIds } },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.reviewShare.deleteMany({ where: { reviewId } });
      if (owned.length > 0) {
        await tx.reviewShare.createMany({
          data: owned.map((p) => ({ reviewId, playerId: String(p.id) })),
        });
      }
      await tx.videoReview.updateMany({
        where: { id: reviewId, userId },
        data: { sharedAll },
      });
    });

    revalidateReviews(reviewId);
    return {
      ok: true,
      message: sharedAll
        ? "Sdíleno s celým týmem."
        : owned.length === 0
          ? "Sdílení zrušeno."
          : `Sdíleno s ${owned.length} hráči.`,
    };
  } catch (e) {
    console.error("[setShares]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Sdílení se nepovedlo." };
  }
}

/* ---------------------------------------------------- soupiska */

/**
 * Kdo u tohohle zápasu hrál.
 *
 * Prázdná soupiska znamená „všichni“ — proto se prázdný seznam ukládá
 * jako smazání, ne jako „nikdo“. Jinak by rozbor po odškrtnutí všech
 * zůstal bez jediného hráče a nešlo by za nikoho zapisovat.
 */
export async function setRoster(
  reviewId: string,
  playerIds: string[],
): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    if (!(await ownsReview(userId, reviewId))) {
      return { ok: false, error: "Rozbor nenalezen." };
    }

    // Jen hráči z vlastního klubu; cizí id se tiše zahodí.
    const owned = await prisma.player.findMany({
      where: { userId, id: { in: playerIds } },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.reviewRoster.deleteMany({ where: { reviewId } });
      if (owned.length > 0) {
        await tx.reviewRoster.createMany({
          data: owned.map((p) => ({ reviewId, playerId: String(p.id) })),
        });
      }
    });

    revalidateReviews(reviewId);
    return {
      ok: true,
      message:
        owned.length === 0
          ? "Soupiska zrušena — nabízí se celý klub."
          : `Na soupisce je ${owned.length} hráčů.`,
    };
  } catch (e) {
    console.error("[setRoster]", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Soupisku se nepodařilo uložit.",
    };
  }
}

/* ------------------------------------------------ tlačítka akcí */

const typesSchema = z.array(
  z.object({
    id: z.string().optional(),
    label: z.string().trim().min(1).max(40),
    color: z.string().trim(),
    side: z.enum(["FOR", "AGAINST", "NEUTRAL"]),
    /** Nadřazená skupina (HIT, DEAD…); prázdné = tlačítko stojí samo. */
    groupLabel: z.string().trim().max(24).optional(),
  }),
).max(30);

/** Prázdná skupina se ukládá jako nic — jinak by vznikly dvě „bez skupiny“. */
function skupina(hodnota: string | undefined): string | null {
  const s = (hodnota ?? "").trim();
  return s === "" ? null : s;
}

/**
 * Uloží sadu tlačítek pro celý klub.
 *
 * Odebrané se archivují, nemažou. Kdyby se mazala doopravdy, ztratily
 * by smysl všechny zápisy, které na ně odkazují — a rozbory z minulé
 * sezóny by se rozpadly.
 */
export async function saveEventTypes(types: unknown): Promise<ActionResult> {
  try {
    const userId = await requireUserId();
    const parsed = typesSchema.safeParse(types);
    if (!parsed.success) {
      return { ok: false, error: "Tlačítka mají nečekaný tvar, neuložilo se nic." };
    }
    if (parsed.data.length === 0) {
      return { ok: false, error: "Aspoň jedno tlačítko tam nech." };
    }

    const existing = await prisma.reviewEventType.findMany({
      where: { userId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((t) => String(t.id)));
    const zustavaji = new Set(
      parsed.data.map((t) => t.id).filter((id): id is string => typeof id === "string"),
    );

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < parsed.data.length; i++) {
        const t = parsed.data[i]!;
        // Barva se vybírá ze seznamu, nepíše ručně — cokoli jiného
        // by rozbilo paletu.
        const color = REVIEW_COLORS.includes(t.color) ? t.color : REVIEW_COLORS[0]!;

        if (t.id && existingIds.has(t.id)) {
          await tx.reviewEventType.updateMany({
            where: { id: t.id, userId },
            data: {
              label: t.label,
              color,
              side: t.side,
              groupLabel: skupina(t.groupLabel),
              sortOrder: i,
              archived: false,
            },
          });
        } else {
          await tx.reviewEventType.create({
            data: {
              userId,
              label: t.label,
              color,
              side: t.side,
              groupLabel: skupina(t.groupLabel),
              sortOrder: i,
            },
          });
        }
      }

      const kArchivaci = [...existingIds].filter((id) => !zustavaji.has(id));
      if (kArchivaci.length > 0) {
        await tx.reviewEventType.updateMany({
          where: { id: { in: kArchivaci }, userId },
          data: { archived: true },
        });
      }
    });

    revalidateReviews();
    return { ok: true, message: "Tlačítka uložena." };
  } catch (e) {
    console.error("[saveEventTypes]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Uložení se nepovedlo." };
  }
}

/**
 * Založí výchozí tlačítka, když klub žádná nemá.
 *
 * Volá se při otevření rozborů. Bez tlačítek by byla stránka
 * k ničemu a nutit trenéra, aby si je nejdřív vymyslel, je zbytečná
 * překážka — přejmenovat je může kdykoli.
 */
export async function ensureDefaultEventTypes(userId: string): Promise<void> {
  const pocet = await prisma.reviewEventType.count({ where: { userId } });
  if (pocet > 0) return;

  await prisma.reviewEventType.createMany({
    data: DEFAULT_EVENT_TYPES.map((t, i) => ({
      userId,
      label: t.label,
      color: t.color,
      side: t.side,
      sortOrder: i,
    })),
  });
}
