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

## File structure

```
app/
├── layout.tsx
├── page.tsx
├── globals.css
├── actions.ts
├── components/
│   ├── avatar.tsx
│   ├── theme-toggle.tsx
│   └── inline-script.tsx
├── cosplayers/[id]/
│   ├── page.tsx
│   └── propose-form.tsx
└── collabs/
    ├── page.tsx
    ├── status-badge.tsx
    └── [id]/page.tsx
lib/
├── resend.ts
├── data.ts
├── uploads.ts
├── email-html.ts
└── theme.ts
db/
├── schema.ts
└── index.ts
drizzle/
scripts/
├── seed.mjs
└── test-receiving.mjs
docs/
└── FRICTION_LOG.md
```

### Pages (`app/`)

- [app/layout.tsx](app/layout.tsx): the shell around every page: header with logo, nav links and the theme toggle; fonts; the script that applies your saved theme before the page is drawn
- [app/page.tsx](app/page.tsx): home page (`/`): the cosplayer gallery
- [app/cosplayers/[id]/page.tsx](app/cosplayers/[id]/page.tsx): a cosplayer's profile (`/cosplayers/1`) with the propose-a-collab form. Creates the one-time id used as the reply token and idempotency key
- [app/cosplayers/[id]/propose-form.tsx](app/cosplayers/[id]/propose-form.tsx): the form itself (name, subject, message, images), with image previews, errors and a sending state
- [app/collabs/page.tsx](app/collabs/page.tsx): list of every collab you've started (`/collabs`)
- [app/collabs/[id]/page.tsx](app/collabs/[id]/page.tsx): one collab's thread (`/collabs/1`): messages, attached images and Resend email ids
- [app/globals.css](app/globals.css): the color palette and the light and dark colors

### Server logic

- [app/actions.ts](app/actions.ts): the Server Action that runs when you send a collab request. Checks the form, saves images, sends the email through Resend (attachments, `collab+<token>` reply-to, tag, idempotency key) and saves the collab to the database
- [lib/resend.ts](lib/resend.ts): the shared Resend client plus the sender address and receiving domain settings (server-only, so the API key never reaches the browser)
- [lib/data.ts](lib/data.ts): database reads used by the pages: cosplayers, collabs, and a full thread with its messages and attachments
- [lib/uploads.ts](lib/uploads.ts): image upload rules (5 files, 10MB total, images only) and saving files to `public/uploads/`
- [lib/email-html.ts](lib/email-html.ts): builds the HTML body of the collab request email, escaping what you typed

### Shared components

- [app/components/avatar.tsx](app/components/avatar.tsx): round avatar with initials and a palette gradient
- [app/components/theme-toggle.tsx](app/components/theme-toggle.tsx): the sun/moon button
- [app/components/inline-script.tsx](app/components/inline-script.tsx): helper that renders the theme script without a React warning
- [app/collabs/status-badge.tsx](app/collabs/status-badge.tsx): the Pending / Discussing / Confirmed badge
- [lib/theme.ts](lib/theme.ts): the script that applies your saved theme on load

### Database

- [db/schema.ts](db/schema.ts): the tables: `cosplayers`, `collabs`, `messages`, `attachments`
- [db/index.ts](db/index.ts): connects Drizzle to the local SQLite file (server-only)
- [drizzle/](drizzle): generated SQL migrations. Don't edit them; change `db/schema.ts` and run `npm run db:generate`
- [drizzle.config.ts](drizzle.config.ts): tells drizzle-kit where the schema, migrations and database are

### Scripts and docs

- [scripts/seed.mjs](scripts/seed.mjs): adds the sample cosplayers (`npm run db:seed`)
- [scripts/test-receiving.mjs](scripts/test-receiving.mjs): sends a test email to the receiving domain and waits for it to arrive (`npm run test:receiving`)
- [docs/FRICTION_LOG.md](docs/FRICTION_LOG.md): notes on what was smooth or confusing in Resend while building this

### Config

- [next.config.ts](next.config.ts): Next.js settings, including the raised upload limit for Server Actions (11MB)
- [.env.example](.env.example): template for `.env.local`
- [AGENTS.md](AGENTS.md): created by Next.js for AI coding agents; it says to check the Next.js docs bundled in `node_modules` because this version differs from older ones

Not in git: `.env.local` (your keys), `local.db` (the database) and `public/uploads/` (uploaded images).
