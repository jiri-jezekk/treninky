import { auth } from "@/auth";
import { NextResponse } from "next/server";

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
    "/statistiky/:path*",
    "/nastaveni/:path*",
    "/skupinove-platby",
    "/skupinove-platby/:path*",
  ],
};
