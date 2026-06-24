import { NextRequest, NextResponse } from "next/server";
import { db, items, planMeta, eq, getActor, getStart, appendActivity, refreshSnapshot, assemblePlan } from "@/lib/server";
import { addDays, dayGap, fmtShort, iso, parse } from "@/lib/dates";
import { ev } from "@/lib/logic";
import type { ItemRowData } from "@/db/schema";

export const dynamic = "force-dynamic";

// Move the whole plan to a new start date. Non-destructive: every item start,
// due, and checkpoint date is shifted by the same number of days, so titles,
// owners, statuses, checkpoints and notes are all preserved.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const newStart = String(body.start || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newStart)) {
      return NextResponse.json({ error: "A valid start date is required." }, { status: 400 });
    }
    const oldStart = await getStart();
    const delta = dayGap(oldStart, newStart);

    if (delta !== 0) {
      const shift = (d: string) => iso(addDays(parse(d), delta));
      const rows = await db.select().from(items);
      for (const row of rows) {
        const data = row.data as ItemRowData;
        const next: ItemRowData = {
          ...data,
          start: shift(data.start),
          due: shift(data.due),
          checkpoints: data.checkpoints.map((cp) => ({ ...cp, date: shift(cp.date) })),
        };
        await db.update(items).set({ data: next, version: row.version + 1, updatedAt: new Date() }).where(eq(items.id, row.id));
      }
    }

    await db.insert(planMeta).values({ id: 1, start: newStart })
      .onConflictDoUpdate({ target: planMeta.id, set: { start: newStart } });

    const actor = await getActor();
    await appendActivity([ev("date", "", `Plan start set to ${fmtShort(newStart)}; dates shifted ${delta} day(s)`, actor)]);
    await refreshSnapshot();

    return NextResponse.json(await assemblePlan());
  } catch (e) {
    console.error("POST /api/plan/start failed", e);
    return NextResponse.json({ error: "Could not update the plan start." }, { status: 500 });
  }
}
