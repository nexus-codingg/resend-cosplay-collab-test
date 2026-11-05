"use server";

import { createHash } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { attachments, collabs, cosplayers, messages } from "@/db/schema";
import { detailRows, interestEmailHtml, replyEmailHtml } from "@/lib/email-html";
import { FROM_ADDRESS, INBOUND_DOMAIN, resend } from "@/lib/resend";
import { readImageFiles, storeFiles } from "@/lib/uploads";

export type ProposeState = {
  error?: string;
  values?: { senderName: string; subject: string; message: string };
};

export async function proposeCollab(
  _prev: ProposeState,
  formData: FormData,
): Promise<ProposeState> {
  const cosplayerId = Number(formData.get("cosplayerId"));
  // Generated once when the form renders, so double-submits and retries reuse it
  const requestId = String(formData.get("requestId") ?? "");
  const values = {
    senderName: String(formData.get("senderName") ?? "").trim(),
    subject: String(formData.get("subject") ?? "").trim(),
    message: String(formData.get("message") ?? "").trim(),
  };

  if (!values.senderName || !values.subject || !values.message) {
    return { error: "Name, subject and message are all required.", values };
  }
  if (!/^[0-9a-f-]{36}$/.test(requestId)) {
    return { error: "This form expired. Reload the page and try again.", values };
  }

  // Already handled this submission (e.g. double-click): go to the existing thread
  const [existing] = await db.select().from(collabs).where(eq(collabs.replyToken, requestId));
  if (existing) redirect(`/collabs/${existing.id}`);

  const [cosplayer] = await db.select().from(cosplayers).where(eq(cosplayers.id, cosplayerId));
  if (!cosplayer) return { error: "That cosplayer no longer exists.", values };

  const images = readImageFiles(formData);
  if (!images.ok) return { error: images.error, values };

  const stored = await storeFiles(images.files, requestId);

  const { data, error } = await resend.emails.send(
    {
      from: FROM_ADDRESS,
      to: [cosplayer.email],
      // Replies come back to collab+<token>@... so the inbound webhook can find this thread
      replyTo: `collab+${requestId}@${INBOUND_DOMAIN}`,
      subject: values.subject,
      html: interestEmailHtml({
        cosplayerName: cosplayer.name,
        senderName: values.senderName,
        message: values.message,
        imageCount: stored.length,
      }),
      text: `Hi ${cosplayer.name},\n\n${values.message}\n\n— ${values.senderName}`,
      attachments: stored.map((f) => ({
        filename: f.filename,
        content: f.content,
        contentType: f.contentType,
      })),
      tags: [{ name: "type", value: "collab_interest" }],
    },
    { idempotencyKey: `collab-interest/${requestId}` },
  );

  if (error) {
    return { error: `Resend error (${error.name}): ${error.message}`, values };
  }

  const collabId = await db.transaction(async (tx) => {
    const [collab] = await tx
      .insert(collabs)
      .values({ cosplayerId, replyToken: requestId })
      .returning({ id: collabs.id });
    const [message] = await tx
      .insert(messages)
      .values({
        collabId: collab.id,
        direction: "outbound",
        subject: values.subject,
        text: values.message,
        resendEmailId: data.id,
      })
      .returning({ id: messages.id });
    if (stored.length) {
      await tx.insert(attachments).values(
        stored.map((f) => ({
          messageId: message.id,
          filename: f.filename,
          contentType: f.contentType,
          storagePath: f.storagePath,
        })),
      );
    }
    return collab.id;
  });

  redirect(`/collabs/${collabId}`);
}

export type ReplyState = {
  error?: string;
  values?: {
    senderName: string;
    subject: string;
    message: string;
    date: string;
    location: string;
    confirm: boolean;
    sendAt: string;
  };
};

/**
 * Send time for Resend's scheduledAt: "" means now; otherwise a natural-language
 * phrase ("in 2 min", "tomorrow at 9am") or an ISO 8601 date, both passed through as-is.
 */
function parseSendAt(raw: FormDataEntryValue | null) {
  return String(raw ?? "").trim();
}

/**
 * The time Resend actually scheduled an email for, as ISO. Right after a send,
 * emails.get() can briefly return scheduled_at: null (while last_event is still
 * "queued"), so retry for a couple of seconds.
 */
async function scheduledTime(emailId: string) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data } = await resend.emails.get(emailId);
    if (data?.scheduled_at) return new Date(data.scheduled_at).toISOString();
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

/**
 * Message-ID headers for every email in the thread, oldest first. Inbound ones are
 * saved from the webhook; outbound ones are only known after Resend sends them, so
 * they're looked up with emails.get() and saved for next time.
 */
async function threadMessageIds(collabId: number) {
  const thread = await db
    .select()
    .from(messages)
    .where(eq(messages.collabId, collabId))
    .orderBy(asc(messages.id));

  const ids: string[] = [];
  for (const m of thread) {
    // Canceled or still-scheduled emails were never seen by the recipient
    if (m.canceledAt || (m.scheduledAt && new Date(m.scheduledAt) > new Date())) continue;
    let messageId = m.messageIdHeader;
    if (!messageId && m.direction === "outbound" && m.resendEmailId) {
      const { data } = await resend.emails.get(m.resendEmailId);
      if (data?.message_id) {
        messageId = data.message_id;
        await db.update(messages).set({ messageIdHeader: messageId }).where(eq(messages.id, m.id));
      }
    }
    if (messageId) ids.push(messageId);
  }
  return ids;
}

export async function replyToCollab(_prev: ReplyState, formData: FormData): Promise<ReplyState> {
  const collabId = Number(formData.get("collabId"));
  // Generated when the thread page renders, so double-submits and retries reuse it
  const requestId = String(formData.get("requestId") ?? "");
  const values = {
    senderName: String(formData.get("senderName") ?? "").trim(),
    subject: String(formData.get("subject") ?? "").trim(),
    message: String(formData.get("message") ?? "").trim(),
    date: String(formData.get("date") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
    confirm: formData.get("confirm") === "on",
    sendAt: parseSendAt(formData.get("sendAt")),
  };

  if (!values.senderName || !values.subject || !values.message) {
    return { error: "Name, subject and message are all required.", values };
  }
  if (!/^[0-9a-f-]{36}$/.test(requestId)) {
    return { error: "This form expired. Reload the page and try again.", values };
  }

  const [row] = await db
    .select({ collab: collabs, cosplayer: cosplayers })
    .from(collabs)
    .innerJoin(cosplayers, eq(collabs.cosplayerId, cosplayers.id))
    .where(eq(collabs.id, collabId));
  if (!row) return { error: "That collab no longer exists.", values };
  const { collab, cosplayer } = row;

  const images = readImageFiles(formData);
  if (!images.ok) return { error: images.error, values };

  // Threading: In-Reply-To is the email being answered (the latest one); References
  // lists the whole thread so mail clients keep every message in one conversation.
  const threadIds = await threadMessageIds(collab.id);
  const headers: Record<string, string> = threadIds.length
    ? { "In-Reply-To": threadIds[threadIds.length - 1], References: threadIds.join(" ") }
    : {};

  const stored = await storeFiles(images.files, `${collab.replyToken}/out-${requestId}`);
  const details = { date: values.date, location: values.location };
  const detailsText = detailRows(details)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");

  const { data, error } = await resend.emails.send(
    {
      from: FROM_ADDRESS,
      to: [cosplayer.email],
      // Same reply-to as the first email, so their next reply lands on this thread too
      replyTo: `collab+${collab.replyToken}@${INBOUND_DOMAIN}`,
      subject: values.subject,
      headers,
      html: replyEmailHtml({
        cosplayerName: cosplayer.name,
        senderName: values.senderName,
        message: values.message,
        details,
        confirmed: values.confirm,
        imageCount: stored.length,
      }),
      text: `Hi ${cosplayer.name},\n\n${values.message}${detailsText ? `\n\n${detailsText}` : ""}\n\n— ${values.senderName}`,
      attachments: stored.map((f) => ({
        filename: f.filename,
        content: f.content,
        contentType: f.contentType,
      })),
      tags: [{ name: "type", value: "collab_reply" }],
      ...(values.sendAt && { scheduledAt: values.sendAt }),
    },
    { idempotencyKey: `collab-reply/${requestId}` },
  );

  if (error) {
    return { error: `Resend error (${error.name}): ${error.message}`, values };
  }

  // Resend resolves phrases like "in 2 min" to a timestamp; store what it actually scheduled
  const scheduledAt = values.sendAt ? await scheduledTime(data.id) : null;

  // A retry with the same idempotency key returns the original email id: don't save it twice
  const [already] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.collabId, collab.id), eq(messages.resendEmailId, data.id)));

  if (!already) {
    await db.transaction(async (tx) => {
      const [message] = await tx
        .insert(messages)
        .values({
          collabId: collab.id,
          direction: "outbound",
          subject: values.subject,
          text: detailsText ? `${values.message}\n\n${detailsText}` : values.message,
          resendEmailId: data.id,
          scheduledAt,
        })
        .returning({ id: messages.id });
      if (stored.length) {
        await tx.insert(attachments).values(
          stored.map((f) => ({
            messageId: message.id,
            filename: f.filename,
            contentType: f.contentType,
            storagePath: f.storagePath,
          })),
        );
      }
      const status = values.confirm ? "confirmed" : collab.status === "pending" ? "discussing" : collab.status;
      if (status !== collab.status) {
        await tx.update(collabs).set({ status }).where(eq(collabs.id, collab.id));
      }
    });
  }

  redirect(`/collabs/${collab.id}`);
}

export type ScheduleState = { error?: string };

async function scheduledMessage(formData: FormData) {
  const messageId = Number(formData.get("messageId"));
  const [message] = await db.select().from(messages).where(eq(messages.id, messageId));
  if (!message?.resendEmailId || !message.scheduledAt) return null;
  return message as typeof message & { resendEmailId: string };
}

export async function rescheduleMessage(
  _prev: ScheduleState,
  formData: FormData,
): Promise<ScheduleState> {
  const message = await scheduledMessage(formData);
  if (!message) return { error: "That email isn't scheduled." };
  const sendAt = parseSendAt(formData.get("sendAt"));
  if (!sendAt) return { error: "Pick a new time." };

  const { error } = await resend.emails.update({ id: message.resendEmailId, scheduledAt: sendAt });
  if (error) return { error: `Resend error (${error.name}): ${error.message}` };

  await db
    .update(messages)
    .set({ scheduledAt: (await scheduledTime(message.resendEmailId)) ?? message.scheduledAt })
    .where(eq(messages.id, message.id));
  redirect(`/collabs/${message.collabId}`);
}

export async function cancelScheduledMessage(
  _prev: ScheduleState,
  formData: FormData,
): Promise<ScheduleState> {
  const message = await scheduledMessage(formData);
  if (!message) return { error: "That email isn't scheduled." };

  const { error } = await resend.emails.cancel(message.resendEmailId);
  if (error) return { error: `Resend error (${error.name}): ${error.message}` };

  await db
    .update(messages)
    .set({ canceledAt: new Date().toISOString() })
    .where(eq(messages.id, message.id));
  redirect(`/collabs/${message.collabId}`);
}

export type InviteState = {
  error?: string;
  values?: { senderName: string; subject: string; message: string; cosplayerIds: number[] };
};

/**
 * Reply token for one cosplayer in a group invite, derived from the request id so a
 * retry builds exactly the same batch. Random tokens would change the payload, and
 * Resend rejects a reused idempotency key with a different payload (409).
 */
function inviteToken(requestId: string, cosplayerId: number) {
  const hex = createHash("sha256").update(`${requestId}:${cosplayerId}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export async function inviteGroup(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const requestId = String(formData.get("requestId") ?? "");
  const values = {
    senderName: String(formData.get("senderName") ?? "").trim(),
    subject: String(formData.get("subject") ?? "").trim(),
    message: String(formData.get("message") ?? "").trim(),
    cosplayerIds: formData.getAll("cosplayerIds").map(Number),
  };
  const sendAt = parseSendAt(formData.get("sendAt"));

  if (!values.senderName || !values.subject || !values.message) {
    return { error: "Name, subject and message are all required.", values };
  }
  if (values.cosplayerIds.length < 2) {
    return { error: "Pick at least two cosplayers for a group invite.", values };
  }
  if (!/^[0-9a-f-]{36}$/.test(requestId)) {
    return { error: "This form expired. Reload the page and try again.", values };
  }

  const invitees = await db
    .select()
    .from(cosplayers)
    .where(inArray(cosplayers.id, values.cosplayerIds))
    .orderBy(asc(cosplayers.id));
  const tokens = invitees.map((c) => inviteToken(requestId, c.id));

  // One email per cosplayer, each with its own reply-to so replies land on separate threads.
  // Batch sends can't carry attachments, so this form has no image upload.
  const { data, error } = await resend.batch.send(
    invitees.map((c, i) => ({
      from: FROM_ADDRESS,
      to: [c.email],
      replyTo: `collab+${tokens[i]}@${INBOUND_DOMAIN}`,
      subject: values.subject,
      html: interestEmailHtml({
        cosplayerName: c.name,
        senderName: values.senderName,
        message: values.message,
        imageCount: 0,
      }),
      text: `Hi ${c.name},\n\n${values.message}\n\n— ${values.senderName}`,
      tags: [{ name: "type", value: "group_invite" }],
      ...(sendAt && { scheduledAt: sendAt }),
    })),
    { idempotencyKey: `group-invite/${requestId}` },
  );

  if (error) {
    return { error: `Resend error (${error.name}): ${error.message}`, values };
  }

  // Ids come back in the same order as the batch
  const emailIds = data.data.map((d) => d.id);
  const scheduled = sendAt
    ? await Promise.all(emailIds.map(scheduledTime))
    : emailIds.map(() => null);

  // A retry with the same key returns the same ids; skip collabs that already exist
  const existing = await db
    .select({ token: collabs.replyToken })
    .from(collabs)
    .where(inArray(collabs.replyToken, tokens));
  const done = new Set(existing.map((e) => e.token));

  await db.transaction(async (tx) => {
    for (const [i, c] of invitees.entries()) {
      if (done.has(tokens[i])) continue;
      const [collab] = await tx
        .insert(collabs)
        .values({ cosplayerId: c.id, replyToken: tokens[i] })
        .returning({ id: collabs.id });
      await tx.insert(messages).values({
        collabId: collab.id,
        direction: "outbound",
        subject: values.subject,
        text: values.message,
        resendEmailId: emailIds[i],
        scheduledAt: scheduled[i],
      });
    }
  });

  redirect("/collabs");
}
