"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { attachments, collabs, cosplayers, messages } from "@/db/schema";
import { interestEmailHtml } from "@/lib/email-html";
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
