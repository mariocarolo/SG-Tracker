/**
 * Local reproduction harness: runs the EXACT operations a real "add a
 * checkpoint" save performs (the PATCH /api/items/[id] path), step by step,
 * against a real Postgres, printing which step fails and the exact error.
 *
 *   DATABASE_URL=postgresql://postgres@localhost:5433/tracker npx tsx db/test-save.ts
 */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, asc, desc } from "drizzle-orm";
import * as schema from "./schema";
import { planMeta, categories, items, activity, history } from "./schema";
import { diffItemActivity, snapshotOf } from "../lib/logic";
import { uid } from "../lib/dates";
import type { Plan } from "../lib/types";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const rowToItem = (row: any) => ({ id: row.id, version: row.version, ...row.data });

async function assemblePlan(): Promise<Plan> {
  const [meta] = await db.select().from(planMeta).where(eq(planMeta.id, 1));
  const cats = await db.select().from(categories).orderBy(asc(categories.position));
  const its = await db.select().from(items).orderBy(asc(items.position));
  const hist = await db.select().from(history).orderBy(asc(history.week));
  const acts = await db.select().from(activity).orderBy(desc(activity.ts)).limit(200);
  return {
    version: 1,
    start: meta?.start ?? "2026-06-16",
    cats: cats.map((c) => ({ id: c.id, name: c.name, color: c.color, items: its.filter((i) => i.categoryId === c.id).map(rowToItem) })),
    history: hist as any,
    activity: acts.reverse() as any,
  };
}

async function step<T>(name: string, fn: () => Promise<T>): Promise<T> {
  process.stdout.write(`• ${name} … `);
  try {
    const r = await fn();
    console.log("OK");
    return r;
  } catch (e: any) {
    console.log("FAILED");
    console.error(`\n>>> STEP "${name}" THREW:\n`, e?.message || e, "\n");
    throw e;
  }
}

async function main() {
  // pick a real seeded item
  const [target] = await db.select().from(items).limit(1);
  if (!target) throw new Error("no items in DB — run setup.sql first");
  console.log(`Testing save on item id=${target.id} (version ${target.version})\n`);

  const oldRow = await step("SELECT item", async () => (await db.select().from(items).where(eq(items.id, target.id)))[0]);

  // simulate "add a checkpoint"
  const newData = { ...(oldRow.data as any), checkpoints: [...(oldRow.data as any).checkpoints, { id: uid(), label: "REPRO checkpoint", date: "2026-07-01", done: false }] };
  const expected = oldRow.version;

  const result = await step("UPDATE item (version-guarded, returning)", async () =>
    db.update(items).set({ data: newData, version: expected + 1, updatedAt: new Date(), updatedBy: null }).where(and(eq(items.id, target.id), eq(items.version, expected))).returning(),
  );
  if (!result.length) throw new Error("version guard matched 0 rows (unexpected here)");

  const [cat] = await step("SELECT category", async () => db.select().from(categories).where(eq(categories.id, oldRow.categoryId)));

  const events = diffItemActivity(rowToItem(oldRow), rowToItem(result[0]), cat?.name ?? "", null);
  console.log(`  (diffItemActivity produced ${events.length} event(s))`);
  if (events.length) {
    await step("INSERT activity", async () =>
      db.insert(activity).values(events.map((e) => ({ id: e.id, ts: e.ts, type: e.type, topic: e.topic || "", msg: e.msg, actor: e.actor ?? null }))),
    );
  }

  const plan = await step("assemblePlan (refreshSnapshot read)", async () => assemblePlan());
  const snap = snapshotOf(plan);
  await step("UPSERT history snapshot (onConflictDoUpdate)", async () =>
    db.insert(history).values({ week: snap.week, date: snap.date, overall: snap.overall, done: snap.done, total: snap.total, cats: snap.cats })
      .onConflictDoUpdate({ target: history.week, set: { date: snap.date, overall: snap.overall, done: snap.done, total: snap.total, cats: snap.cats } }),
  );

  // verify persistence
  const [after] = await db.select().from(items).where(eq(items.id, target.id));
  const cps = (after.data as any).checkpoints.length;
  console.log(`\n✓ ALL STEPS PASSED. Item now version ${after.version} with ${cps} checkpoints (persisted).`);
}

main().then(() => pool.end()).then(() => process.exit(0)).catch(async (e) => {
  await pool.end().catch(() => {});
  console.error("REPRO RESULT: a step failed (see above).");
  process.exit(1);
});
