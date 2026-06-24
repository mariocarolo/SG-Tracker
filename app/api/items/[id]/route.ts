import { NextRequest, NextResponse } from "next/server";
import {
  db, items, categories, and, eq, getActor, appendActivity, refreshSnapshot, rowToItem,
} from "@/lib/server";
import { diffItemActivity, ev } from "@/lib/logic";
import type { ItemRowData } from "@/db/schema";

export const dynamic = "force-dynamic";

// Update one initiative with optimistic concurrency: the write only lands if
// the client's `version` still matches the row. Otherwise we return 409 plus
// the current server value so the client can refresh instead of overwriting.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const body = await req.json();
    const expected = Number(body.version);
    const newData = body.data as ItemRowData;
    if (!newData || Number.isNaN(expected)) {
      return NextResponse.json({ error: "data and version are required." }, { status: 400 });
    }

    const [oldRow] = await db.select().from(items).where(eq(items.id, id));
    if (!oldRow) return NextResponse.json({ error: "not found" }, { status: 404 });

    const actor = await getActor();
    const result = await db
      .update(items)
      .set({ data: newData, version: expected + 1, updatedAt: new Date(), updatedBy: actor })
      .where(and(eq(items.id, id), eq(items.version, expected)))
      .returning();

    if (!result.length) {
      // Someone else saved first — hand back the current value.
      return NextResponse.json(
        { error: "conflict", current: rowToItem(oldRow) },
        { status: 409 },
      );
    }

    const [cat] = await db.select().from(categories).where(eq(categories.id, oldRow.categoryId));
    const events = diffItemActivity(rowToItem(oldRow), rowToItem(result[0]), cat?.name ?? "", actor);
    await appendActivity(events);
    await refreshSnapshot();

    return NextResponse.json({ item: rowToItem(result[0]) });
  } catch (e) {
    console.error("PATCH /api/items/[id] failed", e);
    return NextResponse.json({ error: "Could not save your change." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const [oldRow] = await db.select().from(items).where(eq(items.id, id));
    if (!oldRow) return NextResponse.json({ ok: true });

    const actor = await getActor();
    await db.delete(items).where(eq(items.id, id));
    const title = (oldRow.data as ItemRowData).title;
    await appendActivity([ev("remove", title, `Removed “${title}”`, actor)]);
    await refreshSnapshot();

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/items/[id] failed", e);
    return NextResponse.json({ error: "Could not delete the topic." }, { status: 500 });
  }
}
