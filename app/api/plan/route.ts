import { NextResponse } from "next/server";
import { assemblePlan } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const plan = await assemblePlan();
    return NextResponse.json(plan);
  } catch (e: any) {
    console.error("GET /api/plan failed", e);
    const hint = !process.env.DATABASE_URL
      ? "DATABASE_URL is not set in Vercel. Add it under Settings → Environment Variables and redeploy."
      : "Couldn't read the database. Check /api/health for details — likely the DATABASE_URL is wrong or setup.sql hasn't been run yet.";
    return NextResponse.json({ error: hint, detail: String(e?.message || e) }, { status: 500 });
  }
}
