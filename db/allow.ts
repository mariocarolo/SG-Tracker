/**
 * Manage who is allowed to sign in.
 *
 *   npm run allow -- add alice@company.com bob@company.com
 *   npm run allow -- remove bob@company.com
 *   npm run allow -- list
 *
 * Emails are matched case-insensitively.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { db } from "./index";
import { allowlist } from "./schema";
import { inArray } from "drizzle-orm";

async function main() {
  const [cmd, ...emails] = process.argv.slice(2);
  const norm = emails.map((e) => e.trim().toLowerCase()).filter(Boolean);

  if (cmd === "add") {
    if (!norm.length) return console.error("Usage: npm run allow -- add email1 [email2 …]");
    await db.insert(allowlist).values(norm.map((email) => ({ email }))).onConflictDoNothing();
    console.log(`✓ Allowed: ${norm.join(", ")}`);
  } else if (cmd === "remove") {
    if (!norm.length) return console.error("Usage: npm run allow -- remove email1 [email2 …]");
    await db.delete(allowlist).where(inArray(allowlist.email, norm));
    console.log(`✓ Removed: ${norm.join(", ")}`);
  } else if (cmd === "list") {
    const rows = await db.select().from(allowlist);
    if (!rows.length) console.log("(allowlist is empty — nobody can sign in yet)");
    else rows.forEach((r) => console.log(`• ${r.email}`));
  } else {
    console.error("Commands: add <emails…> | remove <emails…> | list");
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
