import { NextResponse } from "next/server";
import { db, items, categories, getActor, getStart, appendActivity, refreshSnapshot, assemblePlan } from "@/lib/server";
import { buildSeed } from "@/lib/plan-template";
import { ev } from "@/lib/logic";
import { itemToData } from "@/lib/server";

export const dynamic = "force-dynamic";

// Reset the board back to the original suggested plan. Destructive for
// initiatives (always behind a confirmation dialog in the UI), but the
// progress history and activity log are preserved.
export async function POST() {
  try {
    const start = await getStart();
    const seed = buildSeed(start);

    await db.delete(items);
    await db.delete(categories);

    let catPos = 0;
    for (const cat of seed.cats) {
      await db.insert(categories).values({ id: cat.id, name: cat.name, color: cat.color, position: catPos++ });
      let itemPos = 0;
      for (const it of cat.items) {
        await db.insert(items).values({
          id: it.id,
          categoryId: cat.id,
          position: itemPos++,
          version: 0,
          data: itemToData(it),
          updatedBy: "reset",
        });
      }
    }

    const actor = await getActor();
    await appendActivity([ev("reset", "", "Reset plan to the suggested template", actor)]);
    await refreshSnapshot();

    return NextResponse.json(await assemblePlan());
  } catch (e) {
    console.error("POST /api/reset failed", e);
    return NextResponse.json({ error: "Could not reset the plan." }, { status: 500 });
  }
}
