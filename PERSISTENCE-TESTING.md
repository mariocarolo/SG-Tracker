# Persistence — how it works and how to verify it

**There is no JSON / mock / local-storage source of truth.** The flow is:

- **Read:** the browser calls `GET /api/plan` (route is `force-dynamic`, fetched
  with `cache: "no-store"`) which reads everything from Postgres and assembles
  the tree. A page reload always reads the database.
- **Write:** each add/edit/delete calls `POST/PATCH/DELETE /api/items[...]`,
  which writes to Postgres. The UI then adopts the **server-confirmed record**.
- Nothing reseeds on deploy; `setup.sql`/`db:seed` are manual, one-time.

## Diagnose a live deployment (no tools needed)

1. **`/api/health`** → shows `databaseUrlSet`, the deployed `commit`, and the
   live `itemCount` straight from the database.
2. **`/api/health/write-test`** → performs a REAL write round-trip on the
   production database (insert → version-guarded update → activity insert →
   history upsert → delete) using the same driver the app uses, and returns a
   per-step pass/fail with the exact Postgres error. `{ "ok": true }` means
   persistence works end to end.

Confirm the `commit` shown matches the latest commit on `main` — if it doesn't,
Vercel hasn't finished redeploying and you may be testing an older build.

## Reproduce/verify the save path locally (real Postgres)

```bash
# from the repo, with a local or remote Postgres URL:
DATABASE_URL=postgres://… npm run db:test-save
```

`db/test-save.ts` runs the exact "add a checkpoint" save path step by step and
prints which step fails. On a correctly set-up database it ends with:

```
✓ ALL STEPS PASSED. Item now version N with M checkpoints (persisted).
```

## Manual acceptance checklist (in the browser)

1. Add a checkpoint to a topic → watch the header show **saving… → saved**.
2. Reload the page → the checkpoint is still there.
3. Edit a field → reload → the edit persists.
4. Open the app in a second browser/profile → the same data appears.
5. Delete the checkpoint → reload → it stays gone.
6. (Failure handling) If a save ever fails, you get **one** error toast and a
   **Retry** button in the header — never a stack of duplicates — and your edit
   stays on screen until it saves.
