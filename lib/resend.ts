import "server-only";
import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY is not set. Add it to .env.local.");
}

export const resend = new Resend(process.env.RESEND_API_KEY);

// Sender on the verified domain, e.g. "Nexus Cosplays <hello@collab.nexuscosplays.com>"
export const FROM_ADDRESS =
  process.env.RESEND_FROM ?? "Nexus Cosplays <hello@collab.nexuscosplays.com>";
