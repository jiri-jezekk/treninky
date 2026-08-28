import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

/**
 * Dřív src/middleware.ts — Next 16 tu konvenci přejmenoval na `proxy`.
 *
 * Pouze lehká auth.config, bez Prisma. Proxy sice běží nově na Node.js,
 * takže limit velikosti Edge bundle už netlačí, ale rozdělení má smysl
 * dál: sem nemá co lézt databáze.
 *
 * Matcher chrání stránky, NE serverové akce — ty se volají jako POST na
 * adresu, kde jsou použité. Autorizaci si proto hlídá každá akce sama
 * přes requireUserId().
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  if (!req.auth) {
    const login = new URL("/prihlaseni", req.url);
    login.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/prehled/:path*",
    "/hraci/:path*",
    "/treninky",
    "/treninky/:path*",
    "/platba",
    "/platby",
    "/platby/:path*",
    "/statistiky",
    "/statistiky/:path*",
    "/rating",
    "/rating/:path*",
    "/nastaveni/:path*",
    "/skupinove-platby",
    "/skupinove-platby/:path*",
  ],
};
