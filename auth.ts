import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import authConfig from "./auth.config";
import { db } from "./db";
import { users, accounts, sessions, verificationTokens, allowlist } from "./db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  callbacks: {
    // Gate sign-in (and even the sending of the magic-link email) on the
    // organization allowlist. Returning false blocks the attempt entirely.
    async signIn({ user }) {
      const email = user?.email?.toLowerCase();
      if (!email) return false;
      const rows = await db.select().from(allowlist).where(eq(allowlist.email, email));
      return rows.length > 0;
    },
  },
});
