import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

// Plain-language diagnostics. Visit /api/health in the browser to see what's
// wrong if the tracker can't load its data.
export async function GET() {
  const databaseUrlSet = !!process.env.DATABASE_URL;
  const out: Record<string, unknown> = { databaseUrlSet };

  if (!databaseUrlSet) {
    return NextResponse.json(
      { ...out, ok: false, problem: "DATABASE_URL is not set in Vercel → Settings → Environment Variables. Add it and redeploy." },
      { status: 500 },
    );
  }

  try {
    await db.execute(sql`select 1`);
    out.canConnectToDatabase = true;
  } catch (e: any) {
    return NextResponse.json(
      { ...out, ok: false, canConnectToDatabase: false, problem: "Could not connect to the database — the DATABASE_URL is probably wrong. Copy it again from Neon.", detail: String(e?.message || e) },
      { status: 500 },
    );
  }

  try {
    const r: any = await db.execute(sql`select count(*)::int as n from items`);
    const n = Array.isArray(r) ? r[0]?.n : r?.rows?.[0]?.n;
    return NextResponse.json({ ...out, ok: true, tablesExist: true, itemCount: n });
  } catch (e: any) {
    return NextResponse.json(
      { ...out, ok: false, tablesExist: false, problem: "Connected, but the tables aren't there yet — run setup.sql in Neon's SQL Editor.", detail: String(e?.message || e) },
      { status: 500 },
    );
  }
}
