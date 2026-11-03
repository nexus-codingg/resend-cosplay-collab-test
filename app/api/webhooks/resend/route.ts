import { handleReceivedEmail } from "@/lib/inbound";
import { resend } from "@/lib/resend";

// Resend webhook endpoint. Point the dashboard webhook (event: email.received) at
// https://<your-public-url>/api/webhooks/resend
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook] RESEND_WEBHOOK_SECRET is not set");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  // Verification needs the raw body; parsing and re-stringifying breaks the signature
  const payload = await request.text();

  let event;
  try {
    event = resend.webhooks.verify({
      payload,
      // The SDK wants its own { id, timestamp, signature } shape, not the Fetch Headers object
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
      webhookSecret: secret,
    });
  } catch (err) {
    console.warn("[webhook] invalid signature:", err);
    return new Response("Invalid webhook", { status: 400 });
  }

  if (event.type !== "email.received") {
    return Response.json({ ignored: event.type });
  }

  try {
    const result = await handleReceivedEmail(event.data);
    console.log("[webhook] email.received", event.data.email_id, result);
    return Response.json(result);
  } catch (err) {
    // A 5xx lets Resend retry; handleReceivedEmail skips emails it already stored
    console.error("[webhook] failed to process", event.data.email_id, err);
    return new Response("Processing failed", { status: 500 });
  }
}
