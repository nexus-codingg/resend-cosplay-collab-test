# Friction Log: Cosplay Collab app on Resend

Building a Next.js app that sends and receives collaboration emails (with images) via Resend, and exercises send, schedule, batch and idempotency keys. Resend docs (https://resend.com/docs) are the source of truth.

Rating: 🟢 smooth · 🟡 minor friction · 🔴 blocker

## Doc gaps found during planning (2026-11-03)

- 🟡 Batch sending page doesn't mention `scheduledAt`, but the scheduling page says each email in a batch can be scheduled.
- 🟡 Batch sending page doesn't mention idempotency keys, but the idempotency page says `POST /emails/batch` supports them.
- 🟡 No page says whether attachments work with scheduled emails.
- 🟡 Inboxes threads page doesn't explain how to create an inbox, or whether thread replies support attachments.

## Phase log

### Phase 0: GitHub setup

### Phase 1: Project setup

- 🟢 `npm install resend` (v6.37.0) worked first try; API key confirmed with `resend.domains.list()`.
- 🟢 Sending domain `collab.nexuscosplays.com` verified in the dashboard before starting.
- 🟡 The Next.js quickstart (send-with-nextjs) only shows a Route Handler, not Server Actions, which are the default way to handle forms in the App Router.
- 🟡 The quickstart's best-practice notes say not to wrap `emails.send()` in try/catch, but its App Router example does exactly that.
- 🟡 The quickstart says to call templates as `EmailTemplate({...})`, not as JSX. Worth explaining why.
- ℹ️ Receiving is **disabled** on `collab.nexuscosplays.com`. It needs enabling (MX record) before Phase 3, or use the `.resend.app` address.
- 🟢 Enabled receiving: the dashboard gave one MX record (`collab` → `receive.forge.rmta.net`, priority 10), added in Cloudflare. It resolved on public DNS right away.
- 🟡 The dashboard showed the MX as **Pending** after DNS had already propagated. It only turned verified after manually re-triggering verification (via the Resend MCP `verify-domain`).
- 🔴 `dns.email/lookup` flags the MX as **Invalid** because it expects the legacy value `inbound-smtp.us-east-1.amazonaws.com`. The dashboard and API show `receive.forge.rmta.net` as verified, so the lookup tool isn't Forge-aware yet. Confusing, since both are Resend tools giving opposite answers.
- 🟢 Receiving confirmed end to end with `npm run test:receiving`: sent from `hello@` to `test@collab.nexuscosplays.com`, and it appeared in `resend.emails.receiving.list()` within ~8s.
- ❓ The test email's `message_id` ends in `@email.amazonses.com` even though the dashboard shows Forge **Enabled**. Is sending still on the legacy path until Forge onboarding finishes? The dashboard doesn't say which engine sent a given email.
- 🟡 The domain uses Forge (`*.forge.rmta.net` for SPF and MX). The Forge feature page says inbound will route through Forge but doesn't explain how, or whether receiving setup differs.

### Phase 2: Send interest email with images

What was built: a cosplayer gallery, a "Propose a collab" form (Server Action plus `useActionState`) with up to 5 images, and a thread page per collab. Each send uses:
- `replyTo: collab+<token>@collab.nexuscosplays.com`, so replies can be routed back to the thread in Phase 3
- `attachments: [{ filename, content: Buffer, contentType }]`
- `tags: [{ name: "type", value: "collab_interest" }]`
- `idempotencyKey: "collab-interest/<token>"`, where the token is generated when the form renders, so a double-click or retry reuses the same key

Results:
- 🟢 First real send worked: status `delivered`, and the received copy (via `emails.receiving.list()`) shows both PNGs with the right filename, content type and byte size, plus the `collab+…` reply-to.
- 🟢 Passing a Node `Buffer` as `content` just works; no manual base64 needed. The SDK types document `content?: string | Buffer | Uint8Array | ArrayBuffer`.
- 🟢 The SDK's `{ data, error }` return made the Server Action error handling simple: show `error.name` and `error.message` in the form.
- 🟡 The Send Email API reference doesn't show the Node camelCase names (`replyTo`, `scheduledAt`, `contentType`, `contentId`). I had to read the SDK's `.d.mts` types to confirm them.
- 🟡 Not a Resend issue, but it affects anyone sending attachments from a Next.js form: Server Actions cap request bodies at **1MB** by default. Attachments need `experimental.serverActions.bodySizeLimit` raised. The Next.js quickstart could mention this next to attachments.
- 🟡 Inline images (`contentId` with `cid:`) are documented on the attachments page but not in the Next.js guide. I used plain attachments; inline previews could be a nice follow-up.
- ℹ️ Seed cosplayers use `<name>@collab.nexuscosplays.com`, so every test send lands in our own Receiving tab and attachments can be checked through the API.

### Phase 3: Receive email with images

### Phase 4: Threaded reply with images

### Phase 5: Send / schedule / batch / idempotency

## Summary
