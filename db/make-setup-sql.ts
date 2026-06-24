/**
 * Generates a single, paste-ready `setup.sql` that creates every table and
 * loads the existing tracker.json data — so the database can be set up entirely
 * from Neon's web SQL editor, with no local tooling. Run with:  npx tsx db/make-setup-sql.ts
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { migrate } from "../lib/logic";
import type { Plan } from "../lib/types";

const q = (s: unknown) => "'" + String(s).replace(/'/g, "''") + "'";
const jb = (o: unknown) => q(JSON.stringify(o)) + "::jsonb";

// 1) DDL from the generated drizzle migration (CREATE TABLE … + foreign keys)
const drizzleDir = resolve(process.cwd(), "drizzle");
const ddlFile = readdirSync(drizzleDir).filter((f) => f.endsWith(".sql")).sort().pop();
if (!ddlFile) throw new Error("No drizzle migration found — run `npx drizzle-kit generate` first.");
let ddl = readFileSync(resolve(drizzleDir, ddlFile), "utf8");
// Make it safe to paste more than once.
ddl = ddl.replace(/CREATE TABLE "/g, 'CREATE TABLE IF NOT EXISTS "');

// 2) Seed data from tracker.json
const data: Plan = migrate(JSON.parse(readFileSync(resolve(process.cwd(), "tracker.json"), "utf8")));

const lines: string[] = [];
lines.push(`INSERT INTO "plan_meta" ("id","start") VALUES (1, ${q(data.start)}) ON CONFLICT ("id") DO NOTHING;`);

let catPos = 0;
for (const cat of data.cats) {
  lines.push(
    `INSERT INTO "categories" ("id","name","color","position") VALUES (${q(cat.id)}, ${q(cat.name)}, ${q(cat.color)}, ${catPos++}) ON CONFLICT ("id") DO NOTHING;`,
  );
}

let itemRows: string[] = [];
for (const cat of data.cats) {
  let pos = 0;
  for (const it of cat.items) {
    const { id, version, ...rest } = it as any;
    itemRows.push(
      `(${q(id)}, ${q(cat.id)}, ${pos++}, ${jb(rest)}, ${typeof version === "number" ? version : 0}, 'seed')`,
    );
  }
}
if (itemRows.length) {
  lines.push(
    `INSERT INTO "items" ("id","category_id","position","data","version","updated_by") VALUES\n${itemRows.join(",\n")}\nON CONFLICT ("id") DO NOTHING;`,
  );
}

if (data.activity?.length) {
  const rows = data.activity.map(
    (a) => `(${q(a.id)}, ${q(a.ts)}, ${q(a.type)}, ${q(a.topic || "")}, ${q(a.msg)}, ${(a as any).actor ? q((a as any).actor) : "NULL"})`,
  );
  lines.push(
    `INSERT INTO "activity" ("id","ts","type","topic","msg","actor") VALUES\n${rows.join(",\n")}\nON CONFLICT ("id") DO NOTHING;`,
  );
}

if (data.history?.length) {
  const rows = data.history.map(
    (h) => `(${q(h.week)}, ${q(h.date)}, ${h.overall}, ${h.done}, ${h.total}, ${jb(h.cats)})`,
  );
  lines.push(
    `INSERT INTO "history" ("week","date","overall","done","total","cats") VALUES\n${rows.join(",\n")}\nON CONFLICT ("week") DO NOTHING;`,
  );
}

const header = `-- ============================================================================
-- SG-Tracker — one-time database setup
-- Paste this whole file into the Neon SQL Editor and click "Run".
-- It creates all tables and loads the existing tracker data.
-- Safe to run more than once (won't duplicate or overwrite data).
-- ============================================================================

`;

const out = header + ddl.trim() + "\n\n-- ----- seed data -----\n" + lines.join("\n") + "\n";
writeFileSync(resolve(process.cwd(), "setup.sql"), out);
console.log(`✓ Wrote setup.sql (${data.cats.reduce((a, c) => a + c.items.length, 0)} initiatives, ${data.activity?.length || 0} activity, ${data.history?.length || 0} history rows).`);
