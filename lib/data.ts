import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { connection } from "next/server";
import { db } from "@/db";
import { attachments, collabs, cosplayers, messages } from "@/db/schema";

// connection() keeps these reads out of the prerendered shell so they run per request.

export async function getCosplayers() {
  await connection();
  return db.select().from(cosplayers).orderBy(asc(cosplayers.name));
}

export async function getCosplayer(id: number) {
  await connection();
  const [row] = await db.select().from(cosplayers).where(eq(cosplayers.id, id));
  return row ?? null;
}

export async function getCollabs() {
  await connection();
  return db
    .select({ collab: collabs, cosplayer: cosplayers })
    .from(collabs)
    .innerJoin(cosplayers, eq(collabs.cosplayerId, cosplayers.id))
    .orderBy(desc(collabs.id));
}

export async function getCollabThread(id: number) {
  await connection();
  const [row] = await db
    .select({ collab: collabs, cosplayer: cosplayers })
    .from(collabs)
    .innerJoin(cosplayers, eq(collabs.cosplayerId, cosplayers.id))
    .where(eq(collabs.id, id));
  if (!row) return null;

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.collabId, id))
    .orderBy(asc(messages.id));
  const files = msgs.length
    ? await db
        .select()
        .from(attachments)
        .where(
          inArray(
            attachments.messageId,
            msgs.map((m) => m.id),
          ),
        )
    : [];

  return {
    ...row,
    messages: msgs.map((m) => ({
      ...m,
      attachments: files.filter((f) => f.messageId === m.id),
    })),
  };
}
