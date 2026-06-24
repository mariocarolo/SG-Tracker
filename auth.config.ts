import type { NextAuthConfig } from "next-auth";
import Resend from "next-auth/providers/resend";

// Edge-safe config (no database imports) — shared by middleware and the full
// server-side auth in auth.ts.
export default {
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.EMAIL_FROM || "onboarding@resend.dev",
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login?check=1",
    error: "/login",
  },
  session: { strategy: "jwt" },
} satisfies NextAuthConfig;
