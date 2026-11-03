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
- 🟡 The domain uses Forge (`*.forge.rmta.net` for SPF and MX). The Forge feature page says inbound will route through Forge but doesn't explain how, or whether receiving setup differs.

### Phase 2: Send interest email with images

### Phase 3: Receive email with images

### Phase 4: Threaded reply with images

### Phase 5: Send / schedule / batch / idempotency

## Summary
