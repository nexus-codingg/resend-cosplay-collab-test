# Resend Cosplay Collab (test app)

A Next.js app for setting up cosplay collaborations over email, built to test [Resend](https://resend.com/docs): sending and receiving email with image attachments, scheduled sends, batch sends and idempotency keys.

Friction notes are in [docs/FRICTION_LOG.md](docs/FRICTION_LOG.md).

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind)
- [Resend Node SDK](https://resend.com/docs/send-with-nextjs)
- SQLite via Drizzle ORM (a local `local.db` file, no database account or key needed)

## Prerequisites

- Node.js 20+ (built with Node 24) and npm
- A Resend account with:
  - an **API key** ([resend.com/api-keys](https://resend.com/api-keys))
  - a **verified domain** with **sending** enabled
  - **receiving** enabled on that domain, with its MX record added at your DNS provider (needed for inbound email)

## Setup

1. Clone the repo and install dependencies:

   ```bash
   git clone https://github.com/nexus-codingg/resend-cosplay-collab-test.git
   cd resend-cosplay-collab-test
   npm install
   ```

2. Create your env file from the example:

   ```bash
   cp .env.example .env.local
   ```

   Then fill in `.env.local`:

   | Variable | Required | What it is |
   |---|---|---|
   | `RESEND_API_KEY` | Yes | Your Resend API key |
   | `RESEND_FROM` | No | Sender on your verified domain. Defaults to `Nexus Cosplays <hello@collab.nexuscosplays.com>` |
| `RESEND_INBOUND_DOMAIN` | No | Domain with receiving enabled, used for `collab+<token>@…` reply-to addresses. Defaults to `collab.nexuscosplays.com` |
   | `DATABASE_URL` | No | Defaults to `file:local.db` |

   `.env.local` is git-ignored. Never commit it.

3. Create the local database and add sample cosplayers:

   ```bash
   npm run db:migrate
   ```

   ```bash
   npm run db:seed
   ```

   Seeded cosplayers get addresses on the receiving domain (e.g. `luna@collab.nexuscosplays.com`), so test emails land in your Resend Receiving tab. Set `SEED_EMAIL_DOMAIN` to use another domain.

## Using the app

1. Open a cosplayer from the gallery on the home page.
2. Fill in **Propose a collab**: your name, a subject, a message, and up to 5 reference images (10MB total).
3. Click **Send collab request**. The email goes out through Resend with the images attached, and you land on the collab's thread page.
4. **Collabs** in the header lists every collab you've started.

## Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate a migration after changing `db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `local.db` |
| `npm run db:seed` | Add sample cosplayers (safe to re-run) |
| `npm run db:studio` | Browse the database in Drizzle Studio |
| `npm run test:receiving` | Send a test email to your receiving domain and confirm it arrives via the Receiving API |

`test:receiving` sends to `test@collab.nexuscosplays.com` by default. Set `TEST_INBOUND_TO` to use another address on your receiving domain.

## Project layout

```
app/            Next.js routes and pages
db/schema.ts    Tables: cosplayers, collabs, messages, attachments
db/index.ts     Drizzle client (server-only)
lib/resend.ts   Resend client (server-only)
drizzle/        Generated SQL migrations
scripts/        One-off test scripts
docs/           Friction log
```
