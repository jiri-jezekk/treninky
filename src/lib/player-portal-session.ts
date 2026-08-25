import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Přihlášení hráče k jeho platebnímu odkazu.
 *
 * Není to plnohodnotný účet — hráč nemá e-mail ani jméno v systému.
 * Cookie je podepsaná stejným tajemstvím jako trenérská session a platí
 * sedm dní, ale **při každé návštěvě se obnoví**. Kdo se podívá aspoň
 * jednou za týden, heslo znovu nezadá; kdo se týden neukáže, ano.
 */

const COOKIE_PREFIX = "hrac_";
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Chybí AUTH_SECRET.");
  return s;
}

function cookieName(payToken: string): string {
  // Jméno cookie vázané na token, aby na jednom zařízení mohlo být
  // otevřených víc odkazů (třeba dvě děti v jedné rodině).
  return COOKIE_PREFIX + createHmac("sha256", secret()).update(payToken).digest("hex").slice(0, 16);
}

function sign(payToken: string, expiresAt: number): string {
  return createHmac("sha256", secret())
    .update(`${payToken}.${expiresAt}`)
    .digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function hasPortalSession(payToken: string): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(cookieName(payToken))?.value;
  if (!raw) return false;

  const [expiresRaw, signature] = raw.split(".");
  if (!expiresRaw || !signature) return false;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  return safeEqual(signature, sign(payToken, expiresAt));
}

/** Nastaví nebo posune platnost o dalších sedm dní. */
export async function grantPortalSession(payToken: string): Promise<void> {
  const expiresAt = Date.now() + MAX_AGE_SECONDS * 1000;
  const jar = await cookies();
  jar.set(cookieName(payToken), `${expiresAt}.${sign(payToken, expiresAt)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/p/${payToken}`,
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearPortalSession(payToken: string): Promise<void> {
  const jar = await cookies();
  jar.delete(cookieName(payToken));
}
