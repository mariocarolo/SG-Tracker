// ─────────────────────────────────────────────────────────────────────────
// Shared data shapes for the Operating Plan tracker.
// These mirror the original tracker.json structure so existing data migrates
// 1:1, while the database stores each initiative ("item") as its own row for
// safe concurrent editing.
// ─────────────────────────────────────────────────────────────────────────

export type Status = "not_started" | "in_progress" | "blocked" | "done";
export type Priority = "high" | "med" | "low";
export type Health = "auto" | "green" | "amber" | "red";
export type DerivedHealth = "green" | "amber" | "red";

export interface Checkpoint {
  id: string;
  label: string;
  date: string; // YYYY-MM-DD
  done: boolean;
}

export interface Note {
  id: string;
  text: string;
  date: string; // YYYY-MM-DD
}

/** The editable payload of an initiative (everything except id/category). */
export interface ItemData {
  title: string;
  owner: string;
  owner2: string;
  status: Status;
  priority?: Priority;
  phase: number; // 1..3
  start: string; // YYYY-MM-DD
  due: string; // YYYY-MM-DD
  checkpoints: Checkpoint[];
  notes: Note[];
  health?: Health;
  completedAt?: string | null;
}

/** A full initiative as used throughout the UI. */
export interface Item extends ItemData {
  id: string;
  version: number; // optimistic-concurrency token
}

export interface Category {
  id: string;
  name: string;
  color: string;
  items: Item[];
}

export interface ActivityEvent {
  id: string;
  ts: string; // ISO timestamp
  type: string;
  topic: string;
  msg: string;
  actor?: string | null;
}

export interface CatSnapshot {
  name: string;
  color: string;
  pct: number;
}

export interface HistorySnapshot {
  week: string;
  date: string;
  overall: number;
  done: number;
  total: number;
  cats: CatSnapshot[];
}

/** The assembled plan tree returned by GET /api/plan and consumed by the UI. */
export interface Plan {
  version: number;
  start: string;
  cats: Category[];
  history: HistorySnapshot[];
  activity: ActivityEvent[];
}
