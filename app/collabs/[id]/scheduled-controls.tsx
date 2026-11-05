"use client";

import { useActionState } from "react";
import { cancelScheduledMessage, rescheduleMessage, type ScheduleState } from "../../actions";
import { SendAtField } from "../../components/send-at-field";

/** Reschedule / cancel buttons for an email that hasn't been sent yet. */
export function ScheduledControls({ messageId }: { messageId: number }) {
  const [rescheduleState, reschedule, rescheduling] = useActionState<ScheduleState, FormData>(
    rescheduleMessage,
    {},
  );
  const [cancelState, cancel, canceling] = useActionState<ScheduleState, FormData>(
    cancelScheduledMessage,
    {},
  );
  const error = rescheduleState.error ?? cancelState.error;

  return (
    <div className="mt-4 flex flex-col gap-2 rounded-xl border border-dashed border-border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <form action={reschedule} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="messageId" value={messageId} />
          <SendAtField allowNow={false} />
          <button
            type="submit"
            disabled={rescheduling}
            className="rounded-full border border-accent px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/10 disabled:opacity-60"
          >
            {rescheduling ? "Rescheduling…" : "Reschedule"}
          </button>
        </form>
        <form action={cancel}>
          <input type="hidden" name="messageId" value={messageId} />
          <button
            type="submit"
            disabled={canceling}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium text-muted transition hover:border-red-500 hover:text-red-600 disabled:opacity-60"
          >
            {canceling ? "Canceling…" : "Cancel send"}
          </button>
        </form>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
