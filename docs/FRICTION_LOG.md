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

What was built: a webhook route (`app/api/webhooks/resend/route.ts`) that verifies the signature, then for `email.received`:
1. matches `collab+<token>@` in `to` / `cc` / `received_for`
2. skips repeat deliveries
3. calls `emails.receiving.get()` for the body
4. calls `emails.receiving.attachments.list()` and downloads each `download_url`
5. strips the quoted original
6. saves the reply and moves the collab to Discussing

Results:
- 🟢 End-to-end inbound logic works: a reply sent as `luna@` to `collab+<token>@` showed up in Receiving within seconds. A signed `email.received` event to the route fetched the body, downloaded the PNG and showed it on the thread.
- 🟢 Signature verification rejects forged requests with a 400.
- 🟢 `received_for` and the "branch on `to`" tip make plus-addressing routing easy.
- 🟢 `emails.receiving.get()` has a `html_format: 'data_uri' | 'cid'` option for inline images. It's useful, but I only found it in the SDK types, not in the "Get email content" guide.
- 🔴 `resend.webhooks.verify()` takes `headers: { id, timestamp, signature }`, an SDK-specific type that's **also named `Headers`**. The docs pass the Svix header values, so passing `request.headers` (the Fetch `Headers` object) feels natural, and TypeScript rejects it with the confusing message "Type 'Headers' is missing the following properties from type 'Headers'". Suggestions: accept a Fetch `Headers` object directly, or rename the type and show the mapping from `svix-id`, `svix-timestamp` and `svix-signature` in the docs.
- 🟡 The "Create receiving webhook" guide's Next.js example parses `request.json()` and skips verification. Copying it as-is leaves an unauthenticated endpoint. The verify guide warns you need the **raw** body, which the receiving example doesn't use. Showing verification in the receiving example would help.
- 🟡 Retry behavior and expected response codes aren't documented on the receiving pages. I assumed a 5xx triggers a retry and made the handler skip repeats.
- 🟡 Local development needs a public tunnel (the docs suggest ngrok or VS Code port forwarding). There's no way to send a test `email.received` to localhost without one, so I wrote `scripts/simulate-reply.mjs --deliver-locally`, which signs events the Svix way. A built-in "send test event" or CLI forwarding (like `stripe listen`) would remove this step.
- 🟡 The dashboard's **Add webhook** dialog asks for an "Endpoint URL" with no hint about what it should be. A first-time user expected Resend to provide the URL (and the signing secret) up front. It doesn't explain that the URL must be your own publicly reachable route, that localhost won't work, or that the signing secret only appears after the webhook is created. A one-line helper ("The URL on your server Resend will POST events to. Must be public; for local dev use a tunnel.") would fix it.
- 🟡 Easy silent misconfiguration: the webhook was saved with just the tunnel's base URL, without `/api/webhooks/resend`. Resend posted to `/`, the Next.js home page answered **200 with HTML**, and the event shows **success** in the dashboard even though the app never handled it. Only reading the delivery attempt's response body (an HTML page) showed what went wrong. Ideas: warn when the endpoint is a bare domain, or flag 2xx responses with an HTML content type.
- 🟡 Test emails can't be deleted. Neither the API/SDK nor the MCP has a delete for sent or received emails (`emails.cancel()` only stops scheduled ones), so mislabeled test sends stay in the Emails and Receiving lists. Workaround: label subjects per phase from the start (`simulate:reply --label`). A delete or archive option, or filtering by tag in the dashboard, would help keep a test account tidy.
- 🟡 One `emails.send()` call failed with `application_error`, `statusCode: null`, "Unable to fetch data. The request could not be resolved." A plain retry worked. It looks like a local network blip, but the error name doesn't say it's a client-side network failure, and `statusCode: null` is the only clue that the request never reached Resend.
- ℹ️ Sending "as" the cosplayer works because the seeded cosplayers use our own verified domain. That made it easy to simulate realistic replies, including attachments, without a second mailbox.

### Phase 4: Threaded reply with images

What was built: a reply form on each thread page (message, date, location, "mark as confirmed", images). The `replyToCollab` Server Action sends:
- `headers: { "In-Reply-To": <latest Message-ID>, References: <every Message-ID in the thread> }`
- the same `collab+<token>` reply-to, so the next reply lands on the same thread
- image attachments
- `tags: [{ name: "type", value: "collab_reply" }]`
- `idempotencyKey: "collab-reply/<id>"`, with a new id for each reply

Results:
- 🟢 The "Reply to emails" guide is short and clear: set `In-Reply-To` to the received `message_id`, add `References` for longer threads, and start the subject with `Re:`. It worked first try.
- 🟢 The received copy shows `In-Reply-To` set to Luna's reply, `References` listing both earlier emails in order, the `collab+` reply-to, and both PNGs with the right names and sizes. The raw MIME (`raw.download_url`) has a standard folded `References` header.
- 🟢 Custom `headers` and `attachments` work together on a normal `emails.send()`; no special reply API is needed.
- 🟡 The guide only covers replying to a **received** email. For `References` you also need the Message-ID of emails **you sent**, but `emails.send()` returns only the Resend `id`. The Message-ID is only available later through `emails.get(id).message_id`. I look it up when needed and save it. Returning `message_id` from `send()` (or noting this in the guide) would save the extra call.
- 🟡 In `emails.receiving.get()`, multi-value headers come back as a **JSON array string**: `references: '["<a@…>","<b@…>"]'`, while the raw email has the normal space-separated header. The type says `Record<string, string>`, so you have to know to `JSON.parse` it. It isn't documented.
- 🟡 The guide doesn't mention attachments on replies, or whether to keep the same `reply_to`. Both work exactly like a normal send, but a sentence would help.
- ℹ️ The reply to `luna@` is also received by our own domain, and the webhook correctly ignored it (`not addressed to a collab+<token> address`). Routing on the plus-address keeps our own outbound copies out of threads.
- ℹ️ Subject prefixes like `Phase 4 test:` before `Re:` are fine for testing. Mail clients thread on the headers, but some (e.g. Gmail) also look at the subject, so a real app should keep `Re: <original subject>`.

### Phase 5: Send / schedule / batch / idempotency

## Summary
