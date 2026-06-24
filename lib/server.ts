import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { planMeta, categories, items, activity, history } from "@/db/schema";
import type { ItemRowData } from "@/db/schema";
import { auth } from "@/auth";
import { defaultStart } from "@/lib/plan-template";
import { snapshotOf } from "@/lib/logic";
import type { Plan, Item, ActivityEvent, Category } from "@/lib/types";

type ItemRow = typeof items.$inferSelect;

export function rowToItem(row: ItemRow): Item {
  return { id: row.id, version: row.version, ...(row.data as ItemRowData) } as Item;
}

/** Strip id/version from an Item to get the stored payload. */
export function itemToData(it: Partial<Item>): ItemRowData {
  const { id, version, ...rest } = it as any;
  return rest as ItemRowData;
}

/** Read everything and assemble the nested Plan tree the UI expects. */
export async function assemblePlan(): Promise<Plan> {
  const [meta] = await db.select().from(planMeta).where(eq(planMeta.id, 1));
  const cats = await db.select().from(categories).orderBy(asc(categories.position));
  const its = await db.select().from(items).orderBy(asc(items.position));
  const hist = await db.select().from(history).orderBy(asc(history.week));
  const acts = await db.select().from(activity).orderBy(desc(activity.ts)).limit(200);

  const tree: Category[] = cats.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    items: its.filter((i) => i.categoryId === c.id).map(rowToItem),
  }));

  const activityAsc: ActivityEvent[] = acts
    .slice()
    .reverse()
    .map((a) => ({ id: a.id, ts: a.ts, type: a.type, topic: a.topic, msg: a.msg, actor: a.actor }));

  return {
    version: 1,
    start: meta?.start ?? defaultStart(),
    cats: tree,
    history: hist.map((h) => ({
      week: h.week, date: h.date, overall: h.overall, done: h.done, total: h.total, cats: h.cats,
    })),
    activity: activityAsc,
  };
}

/** Insert activity events (append-only, concurrency-safe). */
export async function appendActivity(events: ActivityEvent[]): Promise<void> {
  if (!events.length) return;
  await db.insert(activity).values(
    events.map((e) => ({ id: e.id, ts: e.ts, type: e.type, topic: e.topic || "", msg: e.msg, actor: e.actor ?? null })),
  );
}

/** Recompute and upsert the current ISO-week progress snapshot. */
export async function refreshSnapshot(plan?: Plan): Promise<void> {
  const p = plan ?? (await assemblePlan());
  const snap = snapshotOf(p);
  await db
    .insert(history)
    .values({ week: snap.week, date: snap.date, overall: snap.overall, done: snap.done, total: snap.total, cats: snap.cats })
    .onConflictDoUpdate({
      target: history.week,
      set: { date: snap.date, overall: snap.overall, done: snap.done, total: snap.total, cats: snap.cats },
    });
}

export async function getActor(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email ?? null;
}

export async function getStart(): Promise<string> {
  const [meta] = await db.select().from(planMeta).where(eq(planMeta.id, 1));
  return meta?.start ?? defaultStart();
}

export { db, items, categories, planMeta, activity, history, and, eq };
