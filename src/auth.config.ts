import type { NextAuthConfig } from "next-auth";

/**
 * Sdílená konfigurace bez Prisma/bcrypt — používá ji i Edge middleware (limit ~1 MB).
 * Přihlášení přes Credentials je v auth.ts.
 */
export const authConfig = {
  providers: [],
  trustHost: true,
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        if (token.email) session.user.email = token.email as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/prihlaseni",
  },
} satisfies NextAuthConfig;
