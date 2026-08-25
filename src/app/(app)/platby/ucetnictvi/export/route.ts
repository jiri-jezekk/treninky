import { NextResponse } from "next/server";
import { getAccountingSummary } from "@/lib/accounting";
import { INCOME_KIND_LABELS } from "@/lib/player-balance";
import { formatDateDdMmYyyy } from "@/lib/date-display";
import { requireUserId } from "@/lib/session";

/** Uvozovky a středníky rozbíjejí CSV, proto se hodnota obalí a uvozovky zdvojí. */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Částka s desetinnou čárkou — český Excel jinak sloupec nevezme jako číslo. */
function csvAmount(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export async function GET(request: Request) {
  const userId = await requireUserId();

  const url = new URL(request.url);
  const parsed = Number.parseInt(url.searchParams.get("rok") ?? "", 10);
  const year =
    Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100
      ? parsed
      : new Date().getFullYear();

  const summary = await getAccountingSummary(userId, year);

  const rows: string[] = [
    ["Datum přijetí", "Hráč", "Číslo hráče", "Za co", "Druh příjmu", "Variabilní symbol", "Částka Kč"]
      .map(csvCell)
      .join(";"),
  ];

  for (const e of summary.entries) {
    rows.push(
      [
        csvCell(formatDateDdMmYyyy(e.paidAt)),
        csvCell(e.playerName),
        csvCell(String(e.playerNumber)),
        csvCell(e.label),
        csvCell(INCOME_KIND_LABELS[e.kind]),
        csvCell(e.variableSymbol),
        csvAmount(e.amountCents),
      ].join(";"),
    );
  }

  rows.push("");
  rows.push([csvCell(`Celkem ${year}`), "", "", "", "", "", csvAmount(summary.total)].join(";"));

  if (summary.batches.length > 0) {
    rows.push("");
    rows.push(csvCell("Rozpad souhrnných plateb"));
    rows.push(
      ["Variabilní symbol", "Hráč", "Datum", "Položka", "Druh příjmu", "Částka Kč"]
        .map(csvCell)
        .join(";"),
    );
    for (const b of summary.batches) {
      for (const i of b.items) {
        rows.push(
          [
            csvCell(b.vs),
            csvCell(b.playerName),
            csvCell(formatDateDdMmYyyy(b.createdAt)),
            csvCell(i.label),
            csvCell(INCOME_KIND_LABELS[i.kind]),
            csvAmount(i.amountCents),
          ].join(";"),
        );
      }
    }
  }

  // Excel pozná UTF-8 jen podle BOM, jinak rozbije diakritiku.
  const body = "﻿" + rows.join("\r\n") + "\r\n";

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="platby-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
