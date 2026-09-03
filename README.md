# Buena Vida OS

Internal task app for Buena Vida Specialty Coffee. Next.js 15, Supabase, Anthropic.

The Python Notion/Slack bot stays in `buenavida-chatbot`. This folder is the new product.

## Stack

Next.js 15 (App Router, standalone) on Railway. Supabase Postgres + Auth + Storage. Anthropic for the assistant. Resend for the daily digest. Sentry for errors.

## Setup

1. Install Node 22 and Docker (needed for local Supabase and `supabase test db`).
2. Copy env and fill keys:

```bash
cp .env.example .env.local
```

3. Install and generate types after linking a project:

```bash
npm install
npx supabase start
npx supabase db reset   # runs migrations + seed.sql
npx supabase test db    # P0 gate: rls.test.sql must pass
npm test                # date parsing, title sanitisation, result-card contract
npm run dev
```

Seed logins (local only, password `buenavida-dev`): `gally@buenavida.cr`, `deybid@buenavida.cr`, `david@buenavida.cr`, and the rest of the twelve accounts in `supabase/seed.sql`.

Production logins are email + password. Nobody self-registers. After you have the company list, copy `scripts/people.example.json` to `scripts/people.json` (gitignored) and run `npm run people` against the hosted Supabase project.

## P0 gate

`supabase/tests/rls.test.sql` asserts, for all twelve accounts:

- Gally sees every task, including restricted.
- Angie sees no Dirección tasks.
- Amanda sees exactly one Operaciones task (assigned, not a member).
- Deybid cannot read a restricted task he neither owns nor is assigned (`is_admin` is not read-all).
- David sees exactly one Dirección task despite membership (guest carve-out).
- Inserts into non-member teams fail.

Do not start visual P1 restyling until this file is green.

## Design

Claude Design output goes in [`design/`](design/README.md). Interim tokens live in [`design/tokens.md`](design/tokens.md) and `app/globals.css`. Spec wins on architecture and copy; design wins on layout.

## Deploy

Railway: `railway.json` health-checks `/api/health` and starts `node server.js` (standalone). Cron:

- Digest: `0 13 * * 1-5` → `GET /api/cron/digest` with header `x-cron-secret: $CRON_SECRET`
- Orphan storage sweep: weekly → `GET /api/cron/storage-sweep`

Put Railway and Supabase in the same region. In the hosted Supabase project: turn **off** “Allow new users to sign up”, keep email confirmations off (accounts are created already confirmed). Set Site URL to the Railway URL.

`SUPABASE_SERVICE_ROLE_KEY` is used only under `app/api/cron/**` in the app. Provisioning people is a local script (`npm run people`), not a web route.

## Confirmation contract

Tool rows in `tool_calls` are the source of truth. The chat UI renders `ResultCard` from `status`. Model prose never counts as success. See `scripts/failure-gate.md`.
