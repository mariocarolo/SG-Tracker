/**
 * Seed / migrate the database from the original tracker.json.
 *
 *   npm run db:seed            # seed only if the plan is empty
 *   npm run db:seed -- --force # wipe plan data and re-seed from tracker.json
 *
 * Auth tables and the allowlist are never touched here.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { db } from "./index";
import { planMeta, categories, items, activity, history } from "./schema";
import { migrate } from "../lib/logic";
import { buildSeed, defaultStart } from "../lib/plan-template";
import { sql } from "drizzle-orm";
import type { Plan } from "../lib/types";

async function loadSource(): Promise<Plan> {
  try {
    const raw = readFileSync(resolve(process.cwd(), "tracker.json"), "utf8");
    const parsed = JSON.parse(raw);
    console.log("→ Using existing tracker.json as the data source.");
    return migrate(parsed);
  } catch {
    console.log("→ tracker.json not found; seeding the default suggested plan.");
    return buildSeed(defaultStart());
  }
}

async function main() {
  const force = process.argv.includes("--force");
  const existing = await db.select({ id: items.id }).from(items).limit(1);
  if (existing.length && !force) {
    console.log("✓ Plan already has data — nothing to do. Use `-- --force` to reset from tracker.json.");
    return;
  }

  const data = await loadSource();

  if (force) {
    console.log("→ --force: clearing existing plan data…");
    await db.delete(items);
    await db.delete(categories);
    await db.delete(activity);
    await db.delete(history);
    await db.delete(planMeta);
  }

  // plan meta (single row, id = 1)
  await db.insert(planMeta).values({ id: 1, start: data.start })
    .onConflictDoUpdate({ target: planMeta.id, set: { start: data.start } });

  // categories + items
  let catPos = 0;
  for (const cat of data.cats) {
    await db.insert(categories).values({ id: cat.id, name: cat.name, color: cat.color, position: catPos++ });
    let itemPos = 0;
    for (const it of cat.items) {
      const { id, version, ...rest } = it as any;
      await db.insert(items).values({
        id,
        categoryId: cat.id,
        position: itemPos++,
        version: typeof version === "number" ? version : 0,
        data: rest,
        updatedBy: "seed",
      });
    }
  }

  // activity log
  if (data.activity?.length) {
    await db.insert(activity).values(
      data.activity.map((a) => ({
        id: a.id,
        ts: a.ts,
        type: a.type,
        topic: a.topic || "",
        msg: a.msg,
        actor: (a as any).actor ?? null,
      })),
    );
  }

  // history snapshots
  if (data.history?.length) {
    for (const h of data.history) {
      await db.insert(history).values({
        week: h.week, date: h.date, overall: h.overall, done: h.done, total: h.total, cats: h.cats,
      }).onConflictDoUpdate({
        target: history.week,
        set: { date: h.date, overall: h.overall, done: h.done, total: h.total, cats: h.cats },
      });
    }
  }

  const counts = await db.select({ n: sql<number>`count(*)::int` }).from(items);
  console.log(`✓ Seed complete — ${counts[0].n} initiatives across ${data.cats.length} workstreams.`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
