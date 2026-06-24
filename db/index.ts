import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// A syntactically valid placeholder keeps `next build` from crashing when no
// DATABASE_URL is present (all DB routes are dynamic, so no query runs at
// build time). At runtime a missing/invalid URL surfaces on the first query.
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== "production") {
  console.warn("⚠ DATABASE_URL is not set — copy .env.example to .env.local and fill it in.");
}

const sql = neon(process.env.DATABASE_URL || "postgresql://user:pass@localhost/placeholder");
export const db = drizzle(sql, { schema });
export { schema };
