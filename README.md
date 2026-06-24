# SG-Tracker — Operating Plan Implementation Tracker

A shared, browser-based tracker for the firm's operating plan: workstreams,
initiatives, owners, checkpoints, RAG health, a weekly progress trend, a
calendar, per-person briefs, and PDF/Excel exports.

This is a production rebuild of the original single-file prototype. Instead of
saving to a local JSON file (which only one person could safely edit at a
time), all data now lives in a central **Postgres** database, the site is
hosted on **Vercel**, and access is limited to your organization with
**email magic-link sign-in**. Around 10 people can use it at once, edits are
saved centrally and show up for everyone, and nothing is lost on refresh or
redeploy.

---

## What changed vs. the original

| Topic | Original prototype | This version |
|---|---|---|
| Hosting | A local `.html` file | Next.js app on Vercel |
| Data storage | A local `tracker.json` file | Central Postgres database (Neon / Vercel Postgres) |
| Multiple editors | Last person to save wins (data loss risk) | Each initiative is saved on its own; a conflicting save is rejected, not silently overwritten |
| Live updates | None | Everyone's screen refreshes every few seconds |
| Access control | None | Email magic-link sign-in, restricted to an allowlist |
| Backups / exports | PDF, Excel, JSON | Same — all preserved |

Your original files are kept for reference in the **`legacy/`** folder, and the
original data is in **`tracker.json`** (used to seed the database).

---

## The stack (plain English)

- **Next.js** — the web framework that runs the site.
- **Vercel** — where the site is hosted (free Hobby plan works; a business may
  prefer the ~$20/month Pro plan).
- **Neon / Vercel Postgres** — the database that safely stores all the data.
- **Auth.js + Resend** — sends the one-time sign-in links by email.

Everything above has a free tier that comfortably covers ~10 users.

---

## One-time setup

> **Want it live fast, without logins?** You can. Email sign-in stays **off
> until you set `AUTH_RESEND_KEY`**, so you only need steps 1, 2, 4 and 5 below
> (skip Resend/step 3 and skip the allowlist/step 6). The site will be open to
> anyone with the link. When you're ready to lock it down, add the email key +
> allowlist and redeploy — no code changes. See
> [Turning on sign-in later](#turning-on-sign-in-later).

You'll need free accounts at **Vercel**, **Neon** (or Vercel Postgres), and —
only when you want logins — **Resend**. Total time: ~10–20 minutes. You do this
once.

### 1. Get the code into your own GitHub
This repository is already on GitHub. Make sure your Vercel account can access
it (you'll connect them in step 4).

### 2. Create the database (Neon)
1. Go to <https://neon.tech> → sign up (free) → **Create a project**.
2. Open the project → **Connection string** → copy the string that looks like:
   `postgresql://user:password@ep-xxx.neon.tech/dbname?sslmode=require`
3. Keep it handy — this is your `DATABASE_URL`.

> Prefer Vercel Postgres? In Vercel: **Storage → Create → Postgres**. It gives
> you the same kind of connection string and is powered by Neon.

### 3. Set up email sending (Resend)
1. Go to <https://resend.com> → sign up (free).
2. **API Keys → Create API Key** → copy it. This is your `AUTH_RESEND_KEY`.
3. For testing you can send from `onboarding@resend.dev`. For real use, add and
   verify your company domain under **Domains**, then use an address like
   `login@yourcompany.com` as `EMAIL_FROM`.

### 4. Deploy on Vercel
1. Go to <https://vercel.com> → **Add New → Project** → import this GitHub repo.
2. Before clicking Deploy, open **Environment Variables** and add the four
   values below (see [Environment variables](#environment-variables)).
3. Click **Deploy**. Vercel gives you a URL like `https://sg-tracker.vercel.app`.

### 5. Create the database tables and load the data
Do this once, from your own computer (you need [Node.js](https://nodejs.org) 18+
installed):

```bash
git clone <your-repo-url>
cd SG-Tracker
npm install

# create a local env file and paste in the same values you set on Vercel
cp .env.example .env.local
#   …edit .env.local…

npm run db:push     # creates all the tables in your database
npm run db:seed     # loads the existing tracker.json data
```

### 6. Add the people who are allowed in
Still from your computer:

```bash
npm run allow -- add you@yourcompany.com colleague@yourcompany.com
npm run allow -- list           # see who currently has access
npm run allow -- remove someone@yourcompany.com
```

Only emails on this list can sign in. That's it — open your Vercel URL, enter
your email, click the link in your inbox, and you're in.

---

## Environment variables

Set these in **Vercel → Settings → Environment Variables** (and in
`.env.local` for local work). See `.env.example` for a template.

| Variable | What it is | Example |
|---|---|---|
| `DATABASE_URL` | Postgres connection string (step 2) | `postgresql://…@…neon.tech/db?sslmode=require` |
| `AUTH_SECRET` | Random secret that encrypts sessions | run `openssl rand -base64 32` |
| `AUTH_RESEND_KEY` | Resend API key (step 3) | `re_xxx` |
| `EMAIL_FROM` | The "from" address for sign-in emails | `onboarding@resend.dev` or `login@yourcompany.com` |

Only **`DATABASE_URL`** is required. Leave `AUTH_RESEND_KEY` blank to run open
(no login). `AUTH_URL` is optional on Vercel (detected automatically); for local
dev keep it as `http://localhost:3000`.

### Turning on sign-in later

1. Do step 3 (create a Resend API key).
2. In Vercel, set `AUTH_RESEND_KEY`, `EMAIL_FROM`, and `AUTH_SECRET`
   (`openssl rand -base64 32`).
3. Add the allowed people: `npm run allow -- add you@yourcompany.com …`.
4. Redeploy (push any commit, or hit "Redeploy" in Vercel). Sign-in is now
   required and limited to the allowlist — your data is untouched.

---

## Running it locally (optional)

```bash
npm install
npm run dev          # then open http://localhost:3000
```

Make sure `.env.local` is filled in first.

---

## Everyday maintenance

Almost everything is done **in the browser** — add/edit/remove initiatives,
checkpoints, owners, notes, statuses, dates; the changes save automatically.

Occasional admin tasks from the command line:

| Task | Command |
|---|---|
| Add / remove who can sign in | `npm run allow -- add email@…` / `… remove email@…` |
| List who can sign in | `npm run allow -- list` |
| Re-load the original template data (overwrites!) | `npm run db:seed -- --force` |
| Apply schema changes after editing `db/schema.ts` | `npm run db:push` |

To deploy a code change: push to GitHub — Vercel redeploys automatically. The
data is in the database, so **redeploys never affect your data**.

---

## How concurrent editing stays safe

- Each initiative is a separate row in the database, so two people editing
  **different** initiatives never interfere.
- Editing the **same** initiative uses a version check: if someone else saved
  first, your stale save is rejected and the app quietly refreshes to the latest
  version (you'll see a small notice) — instead of silently overwriting their
  work.
- Every screen polls for updates every few seconds, so others' changes appear
  on their own.
- The activity log records who changed what, and a weekly snapshot of overall
  progress is kept automatically for the trend chart.

---

## Project layout

```
app/                  Next.js routes
  page.tsx            the tracker (requires sign-in)
  login/              magic-link sign-in screen
  api/                plan + items + auth endpoints
components/           the UI (board, overview, schedule, calendar, people, reports)
lib/                  shared business logic (progress, RAG health, dates, types)
db/                   database schema, client, seed + allowlist scripts
legacy/               the original prototype files, kept for reference
tracker.json          the original data, used to seed the database
```

---

## Troubleshooting

- **"That email isn't on the access list."** — add it with
  `npm run allow -- add <email>`.
- **No sign-in email arrives.** — check `AUTH_RESEND_KEY` and `EMAIL_FROM`. With
  `onboarding@resend.dev` you can only reliably email yourself until you verify
  a domain in Resend.
- **"Could not load the plan."** — usually `DATABASE_URL` is wrong/missing, or
  you haven't run `npm run db:push` and `npm run db:seed` yet.
- **Build fails on Vercel about env vars** — make sure all four variables are
  set in the Vercel project settings, then redeploy.
