import { formatCzkFromCents } from "@/lib/money";

/**
 * Text výzvy k platbě, který trenér zkopíruje a pošle hráči.
 * Zpráva má vypadat jako od člověka, ne jako upomínka z účtárny —
 * proto oslovení křestním jménem a žádné „vyzýváme vás“.
 */
export function buildReminderMessage(input: {
  playerName: string;
  clubName: string;
  items: { label: string; amountCents: number }[];
  totalCents: number;
  url: string;
}): string {
  const firstName = input.playerName.split(/\s+/)[0] ?? input.playerName;

  if (input.items.length === 0) {
    return [
      `Ahoj ${firstName}, u ${input.clubName} máš vše zaplacené.`,
      `Přehled najdeš tady: ${input.url}`,
    ].join("\n");
  }

  const lines = input.items
    .map((i) => `• ${i.label} — ${formatCzkFromCents(i.amountCents)}`)
    .join("\n");

  return [
    `Ahoj ${firstName}, tady je přehled tvých plateb pro ${input.clubName}:`,
    "",
    lines,
    "",
    `Celkem ${formatCzkFromCents(input.totalCents)}. Zaplatit můžeš přes QR tady:`,
    input.url,
  ].join("\n");
}
