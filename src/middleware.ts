import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";

/** Pouze lehká auth.config — bez Prisma, aby Edge bundle zůstal pod limitem Vercelu (~1 MB). */
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
    "/platba/:path*",
    "/statistiky/:path*",
    "/nastaveni/:path*",
    "/skupinove-platby",
    "/skupinove-platby/:path*",
  ],
};
