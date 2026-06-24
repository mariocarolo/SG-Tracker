import { DAY, dayGap, iso, parse, todayISO, addDays, uid } from "./dates";
import { STATUSES, RAG } from "./plan-template";
import type {
  Item, ItemData, Plan, Category, ActivityEvent, HistorySnapshot, DerivedHealth, Status,
} from "./types";

export const MAX_ACTIVITY = 500;

/* ---- progress ---- */
export function pctOf(item: { checkpoints: { done: boolean }[]; status: string }): number {
  if (!item.checkpoints.length) return item.status === "done" ? 100 : 0;
  return Math.round((item.checkpoints.filter((c) => c.done).length / item.checkpoints.length) * 100);
}

export function weightedPct(items: { checkpoints: { done: boolean }[]; status: string }[]): number {
  if (!items.length) return 0;
  return Math.round(items.reduce((a, it) => a + pctOf(it), 0) / items.length);
}

/* combined assignee label: "PIC · Co-responsible" */
export const assignLabel = (it: { owner: string; owner2?: string }): string =>
  [it.owner, it.owner2].filter(Boolean).join(" · ") || "Unassigned";

export const stLabel = (v: string): string => (STATUSES.find((s) => s.v === v) || ({} as any)).l || v;

/* normalize older data: split "X e Y" owners into PIC + co-responsible, cap phases at 3 */
export function migrate(d: any): Plan {
  if (!d || !Array.isArray(d.cats)) return d;
  d.cats.forEach((c: any) =>
    c.items.forEach((it: any) => {
      if (!it.owner2) {
        const m = (it.owner || "").match(/^(.*\S)\s+e\s+(\S.*)$/);
        if (m) {
          it.owner = m[1].trim();
          it.owner2 = m[2].trim();
        } else it.owner2 = "";
      }
      if (typeof it.phase === "number" && it.phase > 3) it.phase = 3;
      if (typeof it.version !== "number") it.version = 0;
      if (it.completedAt === undefined) it.completedAt = null;
    }),
  );
  if (!Array.isArray(d.history)) d.history = [];
  if (!Array.isArray(d.activity)) d.activity = [];
  if (typeof d.version !== "number") d.version = 1;
  return d as Plan;
}

/* ---- RAG health: auto-derived from the schedule ---- */
export function autoHealth(it: Item | ItemData): DerivedHealth {
  const today = todayISO();
  if (it.status === "done") return "green";
  if (it.status === "blocked") return "red";
  const overdueCp = it.checkpoints.some((cp) => !cp.done && cp.date < today);
  if (overdueCp || it.due < today) return "red";
  const soon = it.checkpoints.some((cp) => !cp.done && cp.date >= today && dayGap(today, cp.date) <= 14);
  const p = pctOf(it);
  let behind = false;
  if (it.start <= today && it.due > it.start) {
    const total = Math.max(1, dayGap(it.start, it.due));
    const elapsed = Math.max(0, Math.min(total, dayGap(it.start, today)));
    behind = p < (elapsed / total) * 100 - 25;
  }
  if (behind || (soon && p < 50)) return "amber";
  return "green";
}

export function healthOf(it: Item | ItemData): DerivedHealth {
  const h = it.health || "auto";
  return h === "auto" ? autoHealth(it) : (h as DerivedHealth);
}

export function healthReason(it: Item | ItemData): string {
  const today = todayISO();
  if (it.status === "blocked") return "blocked";
  const od = it.checkpoints.filter((cp) => !cp.done && cp.date < today);
  if (od.length) return `${od.length} checkpoint${od.length > 1 ? "s" : ""} overdue`;
  if (it.due < today && it.status !== "done") return "past target date";
  const soon = it.checkpoints.some((cp) => !cp.done && cp.date >= today && dayGap(today, cp.date) <= 14);
  if (soon && pctOf(it) < 50) return "due soon, low progress";
  return "behind schedule";
}

/* ---- activity log: only major changes ---- */
export const ev = (type: string, topic: string, msg: string, actor?: string | null): ActivityEvent => ({
  id: uid(),
  ts: new Date().toISOString(),
  type,
  topic,
  msg,
  actor: actor ?? null,
});

/** Diff two versions of one item and produce activity events for major changes. */
export function diffItemActivity(
  oldIt: Item | null,
  newIt: Item | null,
  catName: string,
  actor?: string | null,
): ActivityEvent[] {
  const out: ActivityEvent[] = [];
  if (!oldIt && newIt) {
    out.push(ev("add", newIt.title, `Added “${newIt.title}” to ${catName}`, actor));
    return out;
  }
  if (oldIt && !newIt) {
    out.push(ev("remove", oldIt.title, `Removed “${oldIt.title}”`, actor));
    return out;
  }
  if (!oldIt || !newIt) return out;
  if (oldIt.title !== newIt.title)
    out.push(ev("rename", newIt.title, `Task changed from “${oldIt.title}” to “${newIt.title}”`, actor));
  if (oldIt.status !== newIt.status) {
    out.push(
      newIt.status === "done"
        ? ev("done", newIt.title, `Completed “${newIt.title}”`, actor)
        : ev("status", newIt.title, `“${newIt.title}”: ${stLabel(oldIt.status)} → ${stLabel(newIt.status)}`, actor),
    );
  }
  if (assignLabel(oldIt) !== assignLabel(newIt)) {
    out.push(
      assignLabel(newIt) === "Unassigned"
        ? ev("owner", newIt.title, `“${newIt.title}”: unassigned`, actor)
        : ev("owner", newIt.title, `Assigned “${newIt.title}” to ${assignLabel(newIt)}`, actor),
    );
  }
  return out;
}

/* ---- history: weekly progress snapshots ---- */
export function weekKey(isoDate: string): string {
  const d = parse(isoDate);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7; // Mon = 0
  t.setUTCDate(t.getUTCDate() - day + 3); // shift to that week's Thursday
  const firstThu = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const fday = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - fday + 3);
  const week = 1 + Math.round((t.getTime() - firstThu.getTime()) / (7 * DAY));
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function snapshotOf(d: Plan): HistorySnapshot {
  const items = d.cats.flatMap((c) => c.items);
  const total = items.length;
  const done = items.filter((it) => it.status === "done").length;
  const overall = weightedPct(items);
  return {
    week: weekKey(todayISO()),
    date: todayISO(),
    overall,
    done,
    total,
    cats: d.cats.map((c) => ({ name: c.name, color: c.color, pct: weightedPct(c.items) })),
  };
}

/** Upsert the current ISO-week snapshot into a history list (returns a new list). */
export function upsertSnapshot(history: HistorySnapshot[], snap: HistorySnapshot): HistorySnapshot[] {
  const next = [...(history || [])];
  const idx = next.findIndex((h) => h.week === snap.week);
  if (idx >= 0) next[idx] = snap;
  else next.push(snap);
  next.sort((a, b) => a.week.localeCompare(b.week));
  return next;
}

/* ---- people aggregation ---- */
export interface OwnerSummary {
  owner: string;
  items: (Item & { cat: Category; role: "PIC" | "Co" })[];
  done: (Item & { cat: Category; role: "PIC" | "Co" })[];
  open: (Item & { cat: Category; role: "PIC" | "Co" })[];
  prog: number;
  overdue: { label: string; date: string; topic: string; color: string; late: number }[];
  upcoming: { label: string; date: string; topic: string; color: string }[];
}

export function ownerView(data: Plan): OwnerSummary[] {
  const today = todayISO();
  const map: Record<string, any[]> = {};
  const add = (name: string, it: any, role: "PIC" | "Co") => {
    (map[name] = map[name] || []).push({ ...it, role });
  };
  data.cats.forEach((c) =>
    c.items.forEach((it) => {
      const wc = { ...it, cat: c };
      if (it.owner) add(it.owner, wc, "PIC");
      if (it.owner2) add(it.owner2, wc, "Co");
      if (!it.owner && !it.owner2) add("Unassigned", wc, "PIC");
    }),
  );
  return Object.keys(map)
    .sort((a, b) => (a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b)))
    .map((owner) => {
      const items = map[owner];
      const done = items.filter((it) => it.status === "done");
      const open = items.filter((it) => it.status !== "done");
      const prog = weightedPct(items);
      const overdue = items
        .flatMap((it) =>
          it.checkpoints
            .filter((cp: any) => !cp.done && cp.date < today)
            .map((cp: any) => ({ label: cp.label, date: cp.date, topic: it.title, color: it.cat.color, late: dayGap(cp.date, today) })),
        )
        .sort((a: any, b: any) => b.late - a.late);
      const upcoming = items
        .flatMap((it) =>
          it.checkpoints
            .filter((cp: any) => !cp.done && cp.date >= today)
            .map((cp: any) => ({ label: cp.label, date: cp.date, topic: it.title, color: it.cat.color })),
        )
        .sort((a: any, b: any) => a.date.localeCompare(b.date));
      return { owner, items, done, open, prog, overdue, upcoming };
    });
}

export const initials = (name: string): string =>
  name === "Unassigned" ? "—" : name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

/** Distinct owner names across the plan, sorted. */
export function ownerNames(data: Plan): string[] {
  return [...new Set(data.cats.flatMap((c) => c.items.flatMap((it) => [it.owner, it.owner2])).filter(Boolean))].sort() as string[];
}

export { RAG };
