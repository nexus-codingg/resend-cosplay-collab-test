import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCollabThread } from "@/lib/data";
import { resend } from "@/lib/resend";
import { Avatar } from "../../components/avatar";
import { StatusBadge } from "../status-badge";
import { ReplyForm } from "./reply-form";
import { ScheduledControls } from "./scheduled-controls";

export default function CollabPage({ params }: PageProps<"/collabs/[id]">) {
  return (
    <>
      <Link href="/collabs" className="text-sm text-muted hover:text-foreground">
        ← All collabs
      </Link>
      <Suspense fallback={<p className="mt-6 text-muted">Loading thread…</p>}>
        <Thread params={params} />
      </Suspense>
    </>
  );
}

async function Thread({ params }: { params: PageProps<"/collabs/[id]">["params"] }) {
  const { id } = await params;
  const thread = await getCollabThread(Number(id));
  if (!thread) notFound();
  const firstName = thread.cosplayer.name.split(" ")[0];
  const requestId = crypto.randomUUID();

  return (
    <div className="mt-6">
      <div className="flex items-center gap-4">
        <Avatar id={thread.cosplayer.id} name={thread.cosplayer.name} />
        <div>
          <h1 className="text-2xl font-semibold">Collab with {thread.cosplayer.name}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted">
            <StatusBadge status={thread.collab.status} />
            <span>{thread.cosplayer.email}</span>
          </div>
        </div>
      </div>

      <ol className="mt-8 flex flex-col gap-4">
        {thread.messages.map((m) => (
          <li
            key={m.id}
            className={`rounded-2xl border p-5 ${
              m.direction === "outbound"
                ? "border-accent/30 bg-accent/5 sm:ml-12"
                : "border-border bg-surface sm:mr-12"
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted">
              <span className="font-medium uppercase tracking-wide">
                {m.direction === "outbound" ? "You sent" : `${thread.cosplayer.name} replied`}
              </span>
              <time dateTime={m.createdAt}>{new Date(`${m.createdAt}Z`).toLocaleString()}</time>
            </div>
            <p className="mt-2 font-medium">{m.subject}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{m.text}</p>

            {m.attachments.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {m.attachments.map((a) => (
                  <a key={a.id} href={a.storagePath} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element -- user uploads */}
                    <img
                      src={a.storagePath}
                      alt={a.filename}
                      className="h-28 w-28 rounded-lg border border-border object-cover"
                    />
                  </a>
                ))}
              </div>
            )}

            {m.resendEmailId && (
              <p className="mt-4 font-mono text-[11px] text-muted">Resend id: {m.resendEmailId}</p>
            )}

            {m.scheduledAt && m.resendEmailId && (
              <Suspense fallback={<p className="mt-3 text-xs text-muted">Checking send status…</p>}>
                <ScheduledStatus
                  messageId={m.id}
                  resendEmailId={m.resendEmailId}
                  canceled={Boolean(m.canceledAt)}
                />
              </Suspense>
            )}
          </li>
        ))}
      </ol>

      {!thread.messages.some((m) => m.direction === "inbound") && (
        <p className="mt-8 rounded-xl border border-dashed border-border p-4 text-sm text-muted">
          Waiting for {firstName} to reply. Replies show up here automatically. Refresh to
          check.
        </p>
      )}

      <section className="mt-10 rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-lg font-semibold">Reply to {firstName}</h2>
        {/* New id per render: each reply gets its own idempotency key, and the form resets */}
        <ReplyForm
          key={requestId}
          collabId={thread.collab.id}
          requestId={requestId}
          defaultSubject={`Re: ${thread.messages[0]?.subject.replace(/^Re:\s*/i, "") ?? "our collab"}`}
          firstName={firstName}
        />
      </section>
    </div>
  );
}

/** Live status of a scheduled email from Resend, with reschedule/cancel while it's still pending. */
async function ScheduledStatus({
  messageId,
  resendEmailId,
  canceled,
}: {
  messageId: number;
  resendEmailId: string;
  canceled: boolean;
}) {
  const { data } = await resend.emails.get(resendEmailId);
  const pending = data?.scheduled_at && new Date(data.scheduled_at) > new Date();
  // A just-scheduled email reports "queued" for a moment before "scheduled"
  const event =
    data?.last_event === "queued" && pending
      ? "scheduled"
      : (data?.last_event ?? (canceled ? "canceled" : "unknown"));
  const when = data?.scheduled_at ? new Date(data.scheduled_at).toLocaleString() : null;
  const label =
    event === "scheduled"
      ? `Scheduled for ${when}`
      : event === "canceled"
        ? "Canceled before sending"
        : `Was scheduled for ${when} · now ${event}`;

  return (
    <>
      <p className="mt-3 inline-flex rounded-full bg-clay/25 px-3 py-1 text-xs font-medium">
        ⏱ {label}
      </p>
      {event === "scheduled" && <ScheduledControls messageId={messageId} />}
    </>
  );
}
