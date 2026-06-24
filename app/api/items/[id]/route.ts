import { NextRequest, NextResponse } from "next/server";
import {
  db, items, categories, and, eq, getActor, appendActivity, refreshSnapshot, rowToItem,
} from "@/lib/server";
import { diffItemActivity, ev } from "@/lib/logic";
import type { ItemRowData } from "@/db/schema";

export const dynamic = "force-dynamic";

// Secondary bookkeeping (activity log + weekly snapshot) must NEVER fail a save.
// The item row write is the source of truth; if these throw, the data is still
// safely persisted, so we log and move on.
async function bookkeepUpdate(oldRow: any, newRow: any, actor: string | null) {
  try {
    const [cat] = await db.select().from(categories).where(eq(categories.id, oldRow.categoryId));
    const events = diffItemActivity(rowToItem(oldRow), rowToItem(newRow), cat?.name ?? "", actor);
    await appendActivity(events);
    await refreshSnapshot();
  } catch (e) {
    console.error("[items PATCH] non-fatal bookkeeping error (item WAS saved):", e);
  }
}

// Update one initiative with optimistic concurrency: the write only lands if
// the client's `version` still matches the row. Otherwise we return 409 plus
// the current server value so the client can refresh instead of overwriting.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  try {
    const body = await req.json();
    const expected = Number(body.version);
    const newData = body.data as ItemRowData;
    if (!newData || Number.isNaN(expected)) {
      return NextResponse.json({ error: "data and version are required." }, { status: 400 });
    }

    const [oldRow] = await db.select().from(items).where(eq(items.id, id));
    if (!oldRow) {
      console.warn(`[items PATCH] not found id=${id}`);
      return NextResponse.json({ error: "That item no longer exists." }, { status: 404 });
    }

    const actor = await getActor();
    const result = await db
      .update(items)
      .set({ data: newData, version: expected + 1, updatedAt: new Date(), updatedBy: actor })
      .where(and(eq(items.id, id), eq(items.version, expected)))
      .returning();

    if (!result.length) {
      console.warn(`[items PATCH] conflict id=${id} expected=${expected} actual=${oldRow.version}`);
      return NextResponse.json({ error: "conflict", current: rowToItem(oldRow) }, { status: 409 });
    }

    // Item is persisted at this point — success is guaranteed regardless of bookkeeping.
    console.log(`[items PATCH] saved id=${id} ${expected}->${result[0].version} by=${actor ?? "anon"}`);
    await bookkeepUpdate(oldRow, result[0], actor);

    return NextResponse.json({ item: rowToItem(result[0]) });
  } catch (e: any) {
    const detail = String(e?.message || e);
    console.error(`[items PATCH] FAILED id=${id}:`, detail);
    return NextResponse.json({ error: "Could not save your change.", detail }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  try {
    const [oldRow] = await db.select().from(items).where(eq(items.id, id));
    if (!oldRow) return NextResponse.json({ ok: true });

    const actor = await getActor();
    await db.delete(items).where(eq(items.id, id));
    console.log(`[items DELETE] id=${id} by=${actor ?? "anon"}`);

    // non-fatal bookkeeping
    try {
      const title = (oldRow.data as ItemRowData).title;
      await appendActivity([ev("remove", title, `Removed “${title}”`, actor)]);
      await refreshSnapshot();
    } catch (e) {
      console.error("[items DELETE] non-fatal bookkeeping error (item WAS deleted):", e);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const detail = String(e?.message || e);
    console.error(`[items DELETE] FAILED id=${id}:`, detail);
    return NextResponse.json({ error: "Could not delete the topic.", detail }, { status: 500 });
  }
}
