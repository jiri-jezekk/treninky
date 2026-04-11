/** Řazení: nejdřív nezaplacení (jméno), pak zaplacení (jméno). */
export function sortParticipantsForDisplay<
  T extends {
    paidAt: Date | null;
    player: { name: string };
  },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const pa = !!a.paidAt;
    const pb = !!b.paidAt;
    if (pa !== pb) return pa ? 1 : -1;
    return a.player.name.localeCompare(b.player.name, "cs");
  });
}
