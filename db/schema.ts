import {
  pgTable, text, integer, timestamp, jsonb, primaryKey,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
import type { Checkpoint, Note, Status, Priority, Health, CatSnapshot } from "../lib/types";

// ───────────────────────── Auth.js (NextAuth) tables ─────────────────────────
export const users = pgTable("user", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (a) => ({ pk: primaryKey({ columns: [a.provider, a.providerAccountId] }) }),
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({ pk: primaryKey({ columns: [vt.identifier, vt.token] }) }),
);

// ───────────────────────── Access control ─────────────────────────
// Only emails in this table may sign in. Manage with `npm run allow`.
export const allowlist = pgTable("allowlist", {
  email: text("email").primaryKey(),
  addedAt: timestamp("addedAt", { mode: "date" }).notNull().defaultNow(),
});

// ───────────────────────── Plan data ─────────────────────────
// Single-row table holding plan-level settings.
export const planMeta = pgTable("plan_meta", {
  id: integer("id").primaryKey(), // always 1
  start: text("start").notNull(), // YYYY-MM-DD
});

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull(),
  position: integer("position").notNull().default(0),
});

// Each initiative is its own row → two users editing different initiatives
// never collide. `version` enables optimistic-concurrency (last-writer is
// rejected, not silently overwritten) for edits to the SAME initiative.
export type ItemRowData = {
  title: string;
  owner: string;
  owner2: string;
  status: Status;
  priority?: Priority;
  phase: number;
  start: string;
  due: string;
  checkpoints: Checkpoint[];
  notes: Note[];
  health?: Health;
  completedAt?: string | null;
};

export const items = pgTable("items", {
  id: text("id").primaryKey(),
  categoryId: text("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  data: jsonb("data").$type<ItemRowData>().notNull(),
  version: integer("version").notNull().default(0),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
});

// Append-only change log (insert-only → concurrency-safe).
export const activity = pgTable("activity", {
  id: text("id").primaryKey(),
  ts: timestamp("ts", { mode: "string" }).notNull().defaultNow(),
  type: text("type").notNull(),
  topic: text("topic").notNull().default(""),
  msg: text("msg").notNull(),
  actor: text("actor"),
});

// Weekly progress snapshots (upserted by week key).
export const history = pgTable("history", {
  week: text("week").primaryKey(),
  date: text("date").notNull(),
  overall: integer("overall").notNull(),
  done: integer("done").notNull(),
  total: integer("total").notNull(),
  cats: jsonb("cats").$type<CatSnapshot[]>().notNull(),
});
