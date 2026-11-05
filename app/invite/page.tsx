import { Suspense } from "react";
import { getCosplayers } from "@/lib/data";
import { InviteForm } from "./invite-form";

export default function InvitePage() {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Group invite</h1>
      <p className="mt-3 max-w-xl text-muted">
        Invite several cosplayers to the same shoot in one go. Each person gets their own email
        and their own collab thread, all sent in a single Resend batch request.
      </p>
      <Suspense fallback={<p className="mt-6 text-muted">Loading cosplayers…</p>}>
        <Invite />
      </Suspense>
    </>
  );
}

async function Invite() {
  const list = await getCosplayers();
  // New id per visit: the batch's idempotency key and the seed for each reply token
  return (
    <InviteForm
      requestId={crypto.randomUUID()}
      cosplayers={list.map((c) => ({ id: c.id, name: c.name, fandoms: c.fandoms }))}
    />
  );
}
