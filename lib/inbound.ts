import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments, collabs, messages } from "@/db/schema";
import { resend } from "@/lib/resend";
import { storeBuffers } from "@/lib/uploads";

type ReceivedEventData = {
  email_id: string;
  from: string;
  to: string[];
  cc?: string[];
  received_for?: string[];
  subject: string;
  message_id: string;
};

export type InboundResult =
  | { status: "stored"; collabId: number; messageId: number; attachments: number }
  | { status: "duplicate"; collabId: number }
  | { status: "ignored"; reason: string };

/** Finds the collab token in any recipient address like collab+<token>@domain. */
export function findReplyToken(addresses: string[]): string | null {
  for (const address of addresses) {
    const match = address.match(/collab\+([0-9a-f-]{36})@/i);
    if (match) return match[1].toLowerCase();
  }
  return null;
}

/** Drops the quoted original that mail clients add under a reply. */
export function stripQuotedReply(text: string) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const cut = lines.findIndex(
    (line) =>
      /^On .+wrote:\s*$/.test(line.trim()) ||
      /^-{2,}\s*Original Message\s*-{2,}$/i.test(line.trim()) ||
      line.startsWith(">"),
  );
  return (cut === -1 ? lines : lines.slice(0, cut)).join("\n").trim();
}

/**
 * Handles an `email.received` event: matches it to a collab, fetches the body
 * (webhooks only carry metadata), downloads attachments right away (their URLs
 * expire after 1 hour) and saves everything as an inbound message.
 */
export async function handleReceivedEmail(data: ReceivedEventData): Promise<InboundResult> {
  const token = findReplyToken([...data.to, ...(data.cc ?? []), ...(data.received_for ?? [])]);
  if (!token) return { status: "ignored", reason: "not addressed to a collab+<token> address" };

  const [collab] = await db.select().from(collabs).where(eq(collabs.replyToken, token));
  if (!collab) return { status: "ignored", reason: `no collab for token ${token}` };

  // Webhooks can be delivered more than once
  const [already] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.collabId, collab.id), eq(messages.resendEmailId, data.email_id)));
  if (already) return { status: "duplicate", collabId: collab.id };

  const { data: email, error } = await resend.emails.receiving.get(data.email_id);
  if (error || !email) throw new Error(`Could not fetch received email: ${error?.message}`);

  const { data: list, error: listError } = await resend.emails.receiving.attachments.list({
    emailId: data.email_id,
  });
  if (listError) throw new Error(`Could not list attachments: ${listError.message}`);

  const downloaded = await Promise.all(
    (list?.data ?? []).map(async (a) => {
      const res = await fetch(a.download_url);
      if (!res.ok) throw new Error(`Attachment download failed (${res.status}) for ${a.filename}`);
      return {
        filename: a.filename ?? `attachment-${a.id}`,
        contentType: a.content_type,
        content: Buffer.from(await res.arrayBuffer()),
      };
    }),
  );
  const stored = await storeBuffers(downloaded, `${token}/in-${data.email_id}`);

  const messageId = await db.transaction(async (tx) => {
    const [message] = await tx
      .insert(messages)
      .values({
        collabId: collab.id,
        direction: "inbound",
        subject: email.subject,
        html: email.html,
        text: stripQuotedReply(email.text ?? ""),
        resendEmailId: data.email_id,
        messageIdHeader: data.message_id,
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
    if (collab.status === "pending") {
      await tx.update(collabs).set({ status: "discussing" }).where(eq(collabs.id, collab.id));
    }
    return message.id;
  });

  return { status: "stored", collabId: collab.id, messageId, attachments: stored.length };
}
