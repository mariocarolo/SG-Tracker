import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { items, categories, activity, history } from "@/db/schema";
import { uid } from "@/lib/dates";

export const dynamic = "force-dynamic";

// Performs a REAL write round-trip against the production database using the
// same driver the app uses, running each step independently and reporting the
// exact error per step. Visit /api/health/write-test in the browser.
// It cleans up after itself (the temp row is deleted).
export async function GET() {
  const steps: { step: string; ok: boolean; error?: string }[] = [];
  const run = async (step: string, fn: () => Promise<void>) => {
    try {
      await fn();
      steps.push({ step, ok: true });
    } catch (e: any) {
      steps.push({ step, ok: false, error: String(e?.message || e) });
    }
  };

  const tempId = "__diag_" + uid();
  let categoryId = "";

  await run("find a category", async () => {
    const [c] = await db.select().from(categories).limit(1);
    if (!c) throw new Error("no categories — run setup.sql");
    categoryId = c.id;
  });

  if (categoryId) {
    await run("INSERT temp item", async () => {
      await db.insert(items).values({
        id: tempId, categoryId, position: 9999, version: 0, updatedBy: "diagnostic",
        data: { title: "diagnostic", owner: "", owner2: "", status: "not_started", phase: 1, start: "2026-01-01", due: "2026-01-02", checkpoints: [], notes: [], health: "auto", completedAt: null },
      });
    });

    await run("UPDATE temp item (version-guarded, returning)", async () => {
      const r = await db.update(items)
        .set({ data: { title: "diagnostic-2", owner: "", owner2: "", status: "in_progress", phase: 1, start: "2026-01-01", due: "2026-01-02", checkpoints: [{ id: uid(), label: "x", date: "2026-01-02", done: false }], notes: [], health: "auto", completedAt: null }, version: 1, updatedAt: new Date(), updatedBy: "diagnostic" })
        .where(and(eq(items.id, tempId), eq(items.version, 0)))
        .returning();
      if (!r.length) throw new Error("version-guarded update matched 0 rows");
    });

    await run("INSERT activity row", async () => {
      await db.insert(activity).values({ id: uid(), ts: new Date().toISOString(), type: "diag", topic: "", msg: "diagnostic", actor: null });
    });

    await run("UPSERT history (onConflictDoUpdate)", async () => {
      const wk = "9999-W99";
      await db.insert(history).values({ week: wk, date: "2026-01-01", overall: 0, done: 0, total: 0, cats: [] })
        .onConflictDoUpdate({ target: history.week, set: { date: "2026-01-01", overall: 0, done: 0, total: 0, cats: [] } });
      await db.delete(history).where(eq(history.week, wk));
    });

    await run("DELETE temp item (cleanup)", async () => {
      await db.delete(items).where(eq(items.id, tempId));
    });
  }

  const ok = steps.every((s) => s.ok);
  return NextResponse.json(
    {
      ok,
      summary: ok ? "All write operations succeeded — persistence works." : "A write step failed — see steps[].error below.",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
      steps,
    },
    { status: ok ? 200 : 500 },
  );
}
