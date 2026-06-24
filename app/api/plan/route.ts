import { NextResponse } from "next/server";
import { assemblePlan } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const plan = await assemblePlan();
    return NextResponse.json(plan);
  } catch (e) {
    console.error("GET /api/plan failed", e);
    return NextResponse.json({ error: "Could not load the plan." }, { status: 500 });
  }
}
