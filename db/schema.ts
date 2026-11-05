import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`);

export const cosplayers = sqliteTable("cosplayers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  fandoms: text("fandoms").notNull().default(""),
  photoUrl: text("photo_url"),
  createdAt: createdAt(),
});

export const collabs = sqliteTable("collabs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cosplayerId: integer("cosplayer_id")
    .notNull()
    .references(() => cosplayers.id),
  // Goes in the reply-to address (collab+<token>@...) so inbound replies route to this thread
  replyToken: text("reply_token").notNull().unique(),
  status: text("status", { enum: ["pending", "discussing", "confirmed"] })
    .notNull()
    .default("pending"),
  createdAt: createdAt(),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  collabId: integer("collab_id")
    .notNull()
    .references(() => collabs.id),
  direction: text("direction", { enum: ["outbound", "inbound"] }).notNull(),
  subject: text("subject").notNull(),
  html: text("html"),
  text: text("text"),
  resendEmailId: text("resend_email_id"),
  // RFC Message-ID header, used for In-Reply-To / References threading
  messageIdHeader: text("message_id_header"),
  // Set for scheduled sends (ISO, as Resend reports it); canceledAt when canceled before sending
  scheduledAt: text("scheduled_at"),
  canceledAt: text("canceled_at"),
  createdAt: createdAt(),
});

export const attachments = sqliteTable("attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  messageId: integer("message_id")
    .notNull()
    .references(() => messages.id),
  filename: text("filename").notNull(),
  contentType: text("content_type"),
  // Path under public/uploads
  storagePath: text("storage_path").notNull(),
  createdAt: createdAt(),
});
