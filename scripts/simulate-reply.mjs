// Simulates a cosplayer replying to the latest collab, with an image attached.
//
// 1. Sends a real email from the cosplayer's address to collab+<token>@<inbound domain>
//    (seeded cosplayers live on our own verified domain, so we can send as them).
// 2. Waits for it to show up in Resend's Receiving API.
// 3. With --deliver-locally: also POSTs a signed email.received event to the local
//    webhook route, the same way Resend would. Use this when no public tunnel is
//    running. Signs with RESEND_WEBHOOK_SECRET from .env.local.
//
// Run: npm run simulate:reply                      (real webhook delivers it)
//      npm run simulate:reply -- --deliver-locally  (sign and deliver it yourself)
//      npm run simulate:reply -- --collab 2         (pick a collab, default: latest)
import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@libsql/client";
import { Resend } from "resend";

const args = process.argv.slice(2);
const deliverLocally = args.includes("--deliver-locally");
const collabArg = args.indexOf("--collab");
const appUrl = process.env.APP_URL ?? "http://localhost:3000";

const resend = new Resend(process.env.RESEND_API_KEY);
const db = createClient({ url: process.env.DATABASE_URL ?? "file:local.db" });
const inboundDomain = process.env.RESEND_INBOUND_DOMAIN ?? "collab.nexuscosplays.com";

const { rows } = await db.execute({
  sql: `SELECT c.id, c.reply_token, p.name, p.email,
          (SELECT subject FROM messages WHERE collab_id = c.id ORDER BY id LIMIT 1) AS subject,
          (SELECT a.storage_path FROM attachments a JOIN messages m ON m.id = a.message_id
             WHERE m.collab_id = c.id ORDER BY a.id LIMIT 1) AS image
        FROM collabs c JOIN cosplayers p ON p.id = c.cosplayer_id
        ${collabArg !== -1 ? "WHERE c.id = ?" : ""}
        ORDER BY c.id DESC LIMIT 1`,
  args: collabArg !== -1 ? [Number(args[collabArg + 1])] : [],
});
const collab = rows[0];
if (!collab) {
  console.error("No collab found. Send a collab request from the app first.");
  process.exit(1);
}

const to = `collab+${collab.reply_token}@${inboundDomain}`;
const subject = `Re: ${collab.subject} (${new Date().toISOString().slice(11, 19)})`;
const firstName = String(collab.name).split(" ")[0];
const attachments = collab.image
  ? [
      {
        filename: "my-costume-progress.png",
        content: await readFile(path.join("public", String(collab.image))),
      },
    ]
  : [];

const { data: sent, error } = await resend.emails.send({
  from: `${collab.name} <${collab.email}>`,
  to: [to],
  subject,
  text: `Yes, I'd love to! Next month works for me.\n\nHere's my costume progress so far.\n\n${firstName}\n\nOn Mon, Nov 3, 2026 at 5:11 PM Nexus Cosplays wrote:\n> Hi! I love your Sailor Moon builds.`,
  attachments,
});
if (error) {
  console.error("Send failed:", error);
  process.exit(1);
}
console.log(`Sent reply ${sent.id}: ${collab.email} -> ${to} (${attachments.length} attachment)`);

let received;
for (let attempt = 1; attempt <= 12 && !received; attempt++) {
  await new Promise((r) => setTimeout(r, 5000));
  const { data } = await resend.emails.receiving.list();
  received = data?.data.find((e) => e.subject === subject);
  if (!received) console.log(`Waiting for it in Receiving (${attempt}/12)…`);
}
if (!received) {
  console.error("Reply never showed up in Receiving after 60s");
  process.exit(1);
}
console.log(`Received as ${received.id}`);

if (!deliverLocally) {
  console.log("Your Resend webhook should now deliver it to the app.");
  process.exit(0);
}

// Build the same email.received event Resend sends, signed the Svix way:
// base64(HMAC-SHA256(secret, `${id}.${timestamp}.${body}`)) in the svix-signature header
const secret = process.env.RESEND_WEBHOOK_SECRET;
if (!secret?.startsWith("whsec_")) {
  console.error("RESEND_WEBHOOK_SECRET (whsec_...) is needed for --deliver-locally");
  process.exit(1);
}
const body = JSON.stringify({
  type: "email.received",
  created_at: new Date().toISOString(),
  data: {
    email_id: received.id,
    created_at: received.created_at,
    from: received.from,
    to: received.to,
    bcc: received.bcc ?? [],
    cc: received.cc ?? [],
    received_for: [],
    message_id: received.message_id,
    subject: received.subject,
    attachments: received.attachments,
  },
});
const id = `msg_${randomUUID()}`;
const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = createHmac("sha256", Buffer.from(secret.slice("whsec_".length), "base64"))
  .update(`${id}.${timestamp}.${body}`)
  .digest("base64");

const res = await fetch(`${appUrl}/api/webhooks/resend`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": `v1,${signature}`,
  },
  body,
});
console.log(`Local webhook -> ${res.status}`, await res.text());
console.log(`Open ${appUrl}/collabs/${collab.id}`);
