// Sends a test email to the receiving domain, then polls the Receiving API until it shows up.
// Run: node --env-file=.env.local scripts/test-receiving.mjs
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const to = process.env.TEST_INBOUND_TO ?? "test@collab.nexuscosplays.com";
const from = process.env.RESEND_FROM ?? "Nexus Cosplays <hello@collab.nexuscosplays.com>";
const subject = `Receiving test ${new Date().toISOString()}`;

const { data: sent, error: sendError } = await resend.emails.send({
  from,
  to: [to],
  subject,
  text: "If you can read this in Receiving, inbound works.",
});
if (sendError) {
  console.error("Send failed:", sendError);
  process.exit(1);
}
console.log(`Sent ${sent.id} -> ${to} ("${subject}")`);

for (let attempt = 1; attempt <= 12; attempt++) {
  await new Promise((r) => setTimeout(r, 5000));
  const { data, error } = await resend.emails.receiving.list();
  if (error) {
    console.error("Receiving list failed:", error);
    process.exit(1);
  }
  const match = data.data.find((e) => e.subject === subject);
  if (match) {
    console.log(`Received after ~${attempt * 5}s:`, match);
    process.exit(0);
  }
  console.log(`Not received yet (check ${attempt}/12)`);
}
console.error("Not received after 60s");
process.exit(1);
