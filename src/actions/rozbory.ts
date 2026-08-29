"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { hasPortalSession } from "@/lib/player-portal-session";
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

/**
 * Kategorie a sezóna z formuláře. Cizí id se zahodí — klub hraje
 * ve víc sestavách, ale rozbor patří vždycky do té svojí.
 */
async function zarazeni(
  userId: string,
  formData: FormData,
  playedOn: Date,
): Promise<{ groupId: string | null; seasonId: string | null }> {
  const groupRaw = String(formData.get("groupId") ?? "").trim();
  const seasonRaw = String(formData.get("seasonId") ?? "").trim();

  const group =
    groupRaw === ""
      ? null
      : await prisma.group.findFirst({
          where: { id: groupRaw, userId },
          select: { id: true },
        });

  // Bez výběru se sezóna dopočítá z data zápasu — ručně by to stejně
  // nikdo nevyplňoval a filtr by zůstal prázdný.
  const season =
    seasonRaw === ""
      ? await prisma.season.findFirst({
          where: { userId, startsOn: { lte: playedOn }, endsOn: { gte: playedOn } },
          select: { id: true },
        })
      : await prisma.season.findFirst({
          where: { id: seasonRaw, userId },
          select: { id: true },
        });

  return {
    groupId: group ? String(group.id) : null,
    seasonId: season ? String(season.id) : null,
  };
}

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

    const { groupId, seasonId } = await zarazeni(userId, formData, playedOn);

    const review = await prisma.videoReview.create({
      data: {
        userId,
        name: parsed.data.name,
        opponent: parsed.data.opponent ?? null,
        notes: parsed.data.notes ?? null,
        playedOn,
        videoId,
        groupId,
        seasonId,
        // Zaškrtávátko: nezaškrtnuté pole se v formuláři vůbec neposílá.
        visibleToPlayers: formData.get("visibleToPlayers") === "on",
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

    const datum = parseDateInput(formData.get("playedOn"));
    const puvodni = await prisma.videoReview.findFirst({
      where: { id: reviewId, userId },
      select: { playedOn: true },
    });
    const { groupId, seasonId } = await zarazeni(
      userId,
      formData,
      datum ?? puvodni?.playedOn ?? new Date(),
    );

    await prisma.videoReview.updateMany({
      where: { id: reviewId, userId },
      data: {
        name: parsed.data.name,
        opponent: parsed.data.opponent ?? null,
        notes: parsed.data.notes ?? null,
        videoId,
        groupId,
        seasonId,
        visibleToPlayers: formData.get("visibleToPlayers") === "on",
        ...(datum && { playedOn: datum }),
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


/* -------------------------------------------------- komentáře */

const komentarSchema = z.string().trim().min(1, "Napiš něco.").max(1000);

/**
 * Komentář k rozboru — od trenéra i od hráče.
 *
 * Hráč se hlásí odkazem a heslem, ne účtem, takže se ověřuje token:
 * musí mít platnou session a rozbor musí patřit jeho klubu. Bez druhé
 * podmínky by stačilo tipnout id a napsat do rozboru cizího klubu.
 */
export async function addComment(
  reviewId: string,
  text: unknown,
  payToken?: string,
): Promise<ActionResult> {
  try {
    const parsed = komentarSchema.safeParse(text);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Neplatný komentář." };
    }

    if (payToken) {
      if (!(await hasPortalSession(payToken))) {
        return { ok: false, error: "Přihlas se prosím znovu." };
      }
      const player = await prisma.player.findUnique({
        where: { payToken },
        select: { id: true, name: true, userId: true, seesReviews: true },
      });
      if (!player) return { ok: false, error: "Neznámý hráč." };
      // Komu trenér rozbory zavřel, ten do nich nemá ani psát.
      if (!player.seesReviews) return { ok: false, error: "Rozbor nenalezen." };

      const smi = await prisma.videoReview.findFirst({
        where: { id: reviewId, userId: String(player.userId), visibleToPlayers: true },
        select: { id: true },
      });
      if (!smi) return { ok: false, error: "Rozbor nenalezen." };

      await prisma.reviewComment.create({
        data: {
          reviewId,
          playerId: String(player.id),
          authorName: player.name,
          body: parsed.data,
        },
      });

      revalidatePath(`/p/${payToken}/rozbory/${reviewId}`);
      revalidateReviews(reviewId);
      return { ok: true, message: "Přidáno." };
    }

    const userId = await requireUserId();
    if (!(await ownsReview(userId, reviewId))) {
      return { ok: false, error: "Rozbor nenalezen." };
    }
    const trener = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    await prisma.reviewComment.create({
      data: {
        reviewId,
        playerId: null,
        authorName: trener?.name?.trim() || "Trenér",
        body: parsed.data,
      },
    });

    revalidateReviews(reviewId);
    return { ok: true, message: "Přidáno." };
  } catch (e) {
    console.error("[addComment]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Komentář se neuložil." };
  }
}

/** Hráč smaže svůj komentář, trenér kterýkoli u svého rozboru. */
export async function deleteComment(
  commentId: string,
  payToken?: string,
): Promise<ActionResult> {
  try {
    const komentar = await prisma.reviewComment.findUnique({
      where: { id: commentId },
      select: { id: true, playerId: true, reviewId: true },
    });
    if (!komentar) return { ok: true };

    if (payToken) {
      if (!(await hasPortalSession(payToken))) {
        return { ok: false, error: "Přihlas se prosím znovu." };
      }
      const player = await prisma.player.findUnique({
        where: { payToken },
        select: { id: true },
      });
      // Cizí komentář hráč nesmaže, ani ten trenérův.
      if (!player || komentar.playerId !== String(player.id)) {
        return { ok: false, error: "Smazat jde jen vlastní komentář." };
      }
      await prisma.reviewComment.delete({ where: { id: commentId } });
      revalidatePath(`/p/${payToken}/rozbory/${String(komentar.reviewId)}`);
      revalidateReviews(String(komentar.reviewId));
      return { ok: true };
    }

    const userId = await requireUserId();
    if (!(await ownsReview(userId, String(komentar.reviewId)))) {
      return { ok: false, error: "Rozbor nenalezen." };
    }
    await prisma.reviewComment.delete({ where: { id: commentId } });
    revalidateReviews(String(komentar.reviewId));
    return { ok: true };
  } catch (e) {
    console.error("[deleteComment]", e);
    return { ok: false, error: e instanceof Error ? e.message : "Smazání se nepovedlo." };
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
    /** Podskupina uvnitř skupiny (counter, z útoku…). */
    subLabel: z.string().trim().max(24).optional(),
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
              subLabel: skupina(t.subLabel),
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
              subLabel: skupina(t.subLabel),
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
