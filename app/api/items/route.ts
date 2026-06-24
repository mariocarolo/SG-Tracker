import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, items, eq, getActor, getStart, appendActivity, refreshSnapshot, rowToItem } from "@/lib/server";
import { addDays, iso, parse, uid } from "@/lib/dates";
import { ev } from "@/lib/logic";
import type { ItemRowData } from "@/db/schema";

export const dynamic = "force-dynamic";

// Create a new initiative in a workstream.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const categoryId = String(body.categoryId || "");
    const title = String(body.title || "").trim();
    if (!categoryId || !title) {
      return NextResponse.json({ error: "categoryId and title are required." }, { status: 400 });
    }

    const start = await getStart();
    const due = iso(addDays(parse(start), 30));
    const data: ItemRowData = {
      title,
      owner: "",
      owner2: "",
      status: "not_started",
      priority: "med",
      phase: 1,
      start,
      due,
      checkpoints: [],
      notes: [],
      health: "auto",
      completedAt: null,
    };

    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${items.position}), -1)::int` })
      .from(items)
      .where(eq(items.categoryId, categoryId));

    const id = uid();
    const actor = await getActor();
    const [row] = await db
      .insert(items)
      .values({ id, categoryId, position: (max ?? -1) + 1, data, version: 0, updatedBy: actor })
      .returning();

    await appendActivity([ev("add", title, `Added “${title}”`, actor)]);
    await refreshSnapshot();

    console.log(`[items POST] created id=${id} cat=${categoryId} by=${actor ?? "anon"}`);
    return NextResponse.json({ item: rowToItem(row) }, { status: 201 });
  } catch (e) {
    console.error("POST /api/items failed", e);
    return NextResponse.json({ error: "Could not create the topic." }, { status: 500 });
  }
}
