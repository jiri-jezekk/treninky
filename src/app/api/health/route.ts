import { NextResponse } from "next/server";

/** Rychlá kontrola, že nasazení běží (bez DB / auth). Otevři /api/health v prohlížeči. */
export async function GET() {
  return NextResponse.json({ ok: true });
}
