import { signOut } from "@/auth";

/** Volá se redirectem z RSC, když JWT odkazuje na neexistujícího uživatele (signOut smí měnit cookies jen zde). */
export async function GET() {
  return signOut({ redirectTo: "/prihlaseni?session=stale" });
}
