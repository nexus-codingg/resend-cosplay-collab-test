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

### Phase 2: Send interest email with images

### Phase 3: Receive email with images

### Phase 4: Threaded reply with images

### Phase 5: Send / schedule / batch / idempotency

## Summary
