// Phase 5 edge cases for scheduling, batch sending and idempotency keys, checked
// against the real Resend API. Prints one PASS/FAIL line per case.
//
// Every email goes to an address on our own receiving domain (default
// test@<RESEND_INBOUND_DOMAIN>) with a "Phase 5 test:" subject. Scheduled emails
// are canceled at the end, so nothing extra goes out later.
//
// Run: npm run test:phase5
import { randomUUID } from "node:crypto";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// The API allows 10 requests per second. Space calls out and retry a 429 so a rate
// limit error is never mistaken for the error a case is testing for.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function paced(target, method) {
  const original = target[method].bind(target);
  target[method] = async (...args) => {
    for (let attempt = 0; ; attempt++) {
      await sleep(250);
      const res = await original(...args);
      if (res.error?.name !== "rate_limit_exceeded" || attempt === 4) return res;
      await sleep(1000 * (attempt + 1));
    }
  };
}
for (const m of ["send", "get", "update", "cancel"]) paced(resend.emails, m);
paced(resend.batch, "send");
const domain = process.env.RESEND_INBOUND_DOMAIN ?? "collab.nexuscosplays.com";
const from = process.env.RESEND_FROM ?? `Nexus Cosplays <hello@${domain}>`;
const to = process.env.TEST_INBOUND_TO ?? `test@${domain}`;
const run = randomUUID().slice(0, 8);

const email = (name, extra = {}) => ({
  from,
  to: [to],
  subject: `Phase 5 test: ${name} [${run}]`,
  text: `Phase 5 test case: ${name}`,
  ...extra,
});

const results = [];
const toCancel = [];
function check(name, pass, detail) {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}\n      ${detail}`);
}
// A just-scheduled email reports "queued" briefly before "scheduled"; wait it out
async function settledEvent(id) {
  for (let i = 0; i < 8; i++) {
    const { data } = await resend.emails.get(id);
    if (data?.last_event !== "queued") return data;
    await sleep(1000);
  }
  return (await resend.emails.get(id)).data;
}
const err = (e) => (e ? `${e.statusCode ?? "?"} ${e.name}: ${e.message}` : "no error");

// --- Idempotency: single send ---------------------------------------------------
{
  const key = `phase5/same-payload/${run}`;
  const a = await resend.emails.send(email("idempotency same payload"), { idempotencyKey: key });
  const b = await resend.emails.send(email("idempotency same payload"), { idempotencyKey: key });
  check(
    "Same key + same payload returns the original email id",
    a.data?.id && a.data.id === b.data?.id,
    `first ${a.data?.id ?? err(a.error)}, retry ${b.data?.id ?? err(b.error)}`,
  );

  const c = await resend.emails.send(email("idempotency DIFFERENT payload"), { idempotencyKey: key });
  check(
    "Same key + different payload is rejected (409 invalid_idempotent_request)",
    c.error?.name === "invalid_idempotent_request",
    err(c.error),
  );
}

{
  const key = `phase5/concurrent/${run}`;
  // Both fire at the same moment on purpose
  const [a, b] = await Promise.all([
    resend.emails.send(email("idempotency concurrent"), { idempotencyKey: key }),
    resend.emails.send(email("idempotency concurrent"), { idempotencyKey: key }),
  ]);
  const ids = [a.data?.id, b.data?.id].filter(Boolean);
  const names = [a.error?.name, b.error?.name].filter(Boolean);
  check(
    "Two requests at once with the same key send only one email",
    new Set(ids).size === 1,
    `ids ${JSON.stringify(ids)}, errors ${JSON.stringify(names)}`,
  );
}

{
  const a = await resend.emails.send(email("idempotency key too long"), {
    idempotencyKey: "x".repeat(257),
  });
  check(
    "A 257-character key is rejected (400 invalid_idempotency_key)",
    a.error?.name === "invalid_idempotency_key",
    err(a.error),
  );
}

// --- Idempotency: batch --------------------------------------------------------
{
  const key = `phase5/batch/${run}`;
  const batch = [email("batch idempotency 1"), email("batch idempotency 2")];
  const a = await resend.batch.send(batch, { idempotencyKey: key });
  const b = await resend.batch.send(batch, { idempotencyKey: key });
  const idsA = a.data?.data.map((d) => d.id) ?? [];
  const idsB = b.data?.data.map((d) => d.id) ?? [];
  check(
    "Batch: same key + same batch returns the same ids",
    idsA.length === 2 && JSON.stringify(idsA) === JSON.stringify(idsB),
    `first ${JSON.stringify(idsA) || err(a.error)}, retry ${JSON.stringify(idsB) || err(b.error)}`,
  );

  const c = await resend.batch.send([email("batch idempotency 1")], { idempotencyKey: key });
  check(
    "Batch: same key + different batch is rejected (409)",
    c.error?.name === "invalid_idempotent_request",
    err(c.error),
  );
}

// --- Batch validation ----------------------------------------------------------
{
  const batch = [email("batch strict valid"), { ...email("batch strict invalid"), to: ["not-an-email"] }];
  const a = await resend.batch.send(batch);
  check(
    "Batch (strict, default): one invalid email fails the whole request",
    a.error?.name === "validation_error" && !a.data,
    err(a.error),
  );

  const b = await resend.batch.send(
    [email("batch permissive valid"), { ...email("batch permissive invalid"), to: ["not-an-email"] }],
    { batchValidation: "permissive" },
  );
  check(
    "Batch (permissive): valid emails send, invalid ones are listed in errors",
    b.data?.data.length === 1 && b.data.errors?.[0]?.index === 1,
    `data ${JSON.stringify(b.data?.data)}, errors ${JSON.stringify(b.data?.errors ?? err(b.error))}`,
  );
}

{
  // The SDK types forbid attachments in a batch; send one anyway to see what happens.
  // The API accepts it, so check what actually arrives at our receiving domain.
  const subject = `Phase 5 test: batch with attachment [${run}]`;
  const a = await resend.batch.send([
    email("batch with attachment", {
      attachments: [{ filename: "note.txt", content: Buffer.from("hi") }],
    }),
  ]);
  let received;
  for (let i = 0; i < 12 && a.data && !received; i++) {
    await sleep(2500);
    const { data } = await resend.emails.receiving.list();
    received = data?.data.find((e) => e.subject === subject);
  }
  check(
    "Batch with an attachment: accepted, but the attachment is dropped",
    Boolean(a.data) && received?.attachments.length === 0,
    a.error
      ? `rejected: ${err(a.error)}`
      : `accepted ${a.data.data[0].id}; received with ${received ? received.attachments.length : "?"} attachment(s)`,
  );
}

// --- Scheduling ----------------------------------------------------------------
{
  const a = await resend.emails.send(email("scheduled in 1 hour", { scheduledAt: "in 1 hour" }));
  const got = a.data && (await settledEvent(a.data.id));
  check(
    'Natural language scheduledAt ("in 1 hour") is accepted and shows as scheduled',
    got?.last_event === "scheduled",
    `last_event ${got?.last_event ?? err(a.error)}, scheduled_at ${got?.scheduled_at}`,
  );

  if (a.data) {
    const u = await resend.emails.update({ id: a.data.id, scheduledAt: "in 2 hours" });
    const after = (await resend.emails.get(a.data.id)).data;
    check(
      "emails.update moves the scheduled time",
      !u.error && after?.scheduled_at !== got?.scheduled_at,
      `${got?.scheduled_at} -> ${after?.scheduled_at} ${u.error ? err(u.error) : ""}`,
    );

    const c = await resend.emails.cancel(a.data.id);
    const canceled = (await resend.emails.get(a.data.id)).data;
    check(
      "emails.cancel stops it (last_event canceled)",
      !c.error && canceled?.last_event === "canceled",
      `last_event ${canceled?.last_event} ${c.error ? err(c.error) : ""}`,
    );

    const r = await resend.emails.update({ id: a.data.id, scheduledAt: "in 3 hours" });
    check("A canceled email can't be rescheduled", Boolean(r.error), err(r.error));
  }
}

{
  const tomorrow = await resend.emails.send(email("scheduled tomorrow 9am", { scheduledAt: "tomorrow at 9am" }));
  const got = tomorrow.data && (await resend.emails.get(tomorrow.data.id)).data;
  check(
    'Timezone check: "tomorrow at 9am" resolves to (Resend reads it as UTC)',
    Boolean(got?.scheduled_at),
    `scheduled_at ${got?.scheduled_at ?? err(tomorrow.error)} (local machine: ${Intl.DateTimeFormat().resolvedOptions().timeZone})`,
  );
  if (tomorrow.data) toCancel.push(tomorrow.data.id);
}

{
  const in31 = new Date(Date.now() + 31 * 24 * 3600 * 1000).toISOString();
  const a = await resend.emails.send(email("scheduled 31 days out", { scheduledAt: in31 }));
  check(
    "Scheduling more than 30 days ahead is rejected",
    Boolean(a.error) && a.error.name !== "rate_limit_exceeded",
    a.error ? err(a.error) : `accepted ${a.data?.id}`,
  );
  if (a.data) toCancel.push(a.data.id);
}

{
  const a = await resend.emails.send(
    email("scheduled with attachment", {
      scheduledAt: "in 1 hour",
      attachments: [{ filename: "note.txt", content: Buffer.from("scheduled attachment") }],
    }),
  );
  check("A scheduled email can carry an attachment", Boolean(a.data), a.data ? `scheduled ${a.data.id}` : err(a.error));
  if (a.data) toCancel.push(a.data.id);
}

{
  const a = await resend.batch.send([
    email("scheduled batch 1", { scheduledAt: "in 1 hour" }),
    email("scheduled batch 2", { scheduledAt: "in 2 hours" }),
  ]);
  const events = [];
  for (const d of a.data?.data ?? []) events.push((await settledEvent(d.id))?.last_event);
  check(
    "Batch emails can each be scheduled",
    events.length === 2 && events.every((e) => e === "scheduled"),
    a.data ? `last_event ${JSON.stringify(events)}` : err(a.error),
  );
  if (a.data) toCancel.push(...a.data.data.map((d) => d.id));
}

// Clean up anything still scheduled
for (const id of toCancel) {
  const { data } = await resend.emails.get(id);
  if (data?.last_event === "scheduled") await resend.emails.cancel(id);
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} passed (run ${run})`);
process.exit(failed ? 1 : 0);
