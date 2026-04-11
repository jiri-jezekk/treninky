import { PlayerGroup } from "@prisma/client";

export const PLAYER_GROUP_ORDER: PlayerGroup[] = [
  "MEN",
  "WOMEN",
  "MIX",
  "JUNIORS",
];

export const PLAYER_GROUP_LABELS: Record<PlayerGroup, string> = {
  MEN: "Muži",
  WOMEN: "Ženy",
  MIX: "Mix",
  JUNIORS: "Junioři",
};

export function parsePlayerGroupFilter(
  raw: string | undefined,
): PlayerGroup | null {
  if (!raw) return null;
  if (PLAYER_GROUP_ORDER.includes(raw as PlayerGroup)) {
    return raw as PlayerGroup;
  }
  return null;
}
