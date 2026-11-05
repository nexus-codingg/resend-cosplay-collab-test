"use server";

import { and, asc, eq } from "drizzle-orm";
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
  };
};

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
    },
    { idempotencyKey: `collab-reply/${requestId}` },
  );

  if (error) {
    return { error: `Resend error (${error.name}): ${error.message}`, values };
  }

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
