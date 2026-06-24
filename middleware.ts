import NextAuth from "next-auth";
import type { NextRequest, NextFetchEvent } from "next/server";
import authConfig from "./auth.config";
import { AUTH_ENABLED } from "./lib/flags";

const { auth } = NextAuth(authConfig);

const protect = auth((req) => {
  const { pathname } = req.nextUrl;
  // Public paths: the login page and the auth API endpoints.
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) return;
  if (!req.auth) {
    const url = new URL("/login", req.nextUrl);
    return Response.redirect(url);
  }
});

// When auth is off (no email key configured), let every request through.
export default function middleware(req: NextRequest, ev: NextFetchEvent) {
  if (!AUTH_ENABLED) return;
  return (protect as unknown as (r: NextRequest, e: NextFetchEvent) => unknown)(req, ev);
}

export const config = {
  // Run on everything except Next.js internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico)$).*)"],
};
