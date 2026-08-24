import { prisma } from "@/lib/prisma";

/** Kategorie tak, jak ji potřebuje UI — bez zbytku modelu. */
export type GroupOption = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  /** Není-li null, hráči v této kategorii platí tuto cenu za trénink. */
  discountPriceCents: number | null;
};

/** Barvy nabízené při zakládání kategorie. Klubová modrá a oranžová napřed. */
export const GROUP_COLORS = [
  "#0ea5e9",
  "#f97316",
  "#4ade80",
  "#a78bfa",
  "#fb7185",
  "#fbbf24",
  "#2dd4bf",
  "#818cf8",
] as const;

export const DEFAULT_GROUP_COLOR = GROUP_COLORS[0];

export async function listGroups(userId: string): Promise<GroupOption[]> {
  return prisma.group.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      color: true,
      sortOrder: true,
      discountPriceCents: true,
    },
  });
}

/**
 * Z formuláře přijdou id kategorií jako text. Nechá projít jen ta,
 * která opravdu patří tomuhle uživateli — jinak by šlo cizí id podstrčit.
 */
export async function sanitizeGroupIds(
  userId: string,
  rawIds: string[],
): Promise<string[]> {
  const wanted = [...new Set(rawIds.map((s) => s.trim()).filter(Boolean))];
  if (wanted.length === 0) return [];
  const rows = await prisma.group.findMany({
    where: { userId, id: { in: wanted } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Hodnota z `?skupina=` — vrátí id jen když taková kategorie existuje. */
export function parseGroupFilter(
  raw: string | undefined,
  groups: GroupOption[],
): string | null {
  if (!raw) return null;
  const t = raw.trim();
  return groups.some((g) => g.id === t) ? t : null;
}

export function groupById(
  groups: GroupOption[],
  id: string,
): GroupOption | undefined {
  return groups.find((g) => g.id === id);
}
