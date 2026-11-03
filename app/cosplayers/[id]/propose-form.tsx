"use client";

import { useActionState, useState } from "react";
import { proposeCollab, type ProposeState } from "../../actions";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";

export function ProposeForm({
  cosplayerId,
  cosplayerName,
  requestId,
}: {
  cosplayerId: number;
  cosplayerName: string;
  requestId: string;
}) {
  const [state, formAction, pending] = useActionState<ProposeState, FormData>(
    proposeCollab,
    {},
  );
  const [previews, setPreviews] = useState<{ name: string; url: string }[]>([]);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="cosplayerId" value={cosplayerId} />
      <input type="hidden" name="requestId" value={requestId} />

      <label className="flex flex-col gap-1 text-sm font-medium">
        Your name
        <input
          name="senderName"
          required
          defaultValue={state.values?.senderName}
          placeholder="Keiana"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Subject
        <input
          name="subject"
          required
          defaultValue={state.values?.subject ?? `Collab idea for ${cosplayerName}`}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Message
        <textarea
          name="message"
          required
          rows={6}
          defaultValue={state.values?.message}
          placeholder="Tell them about your idea: characters, location, timing…"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Reference images <span className="font-normal text-muted">(up to 5, 10MB total)</span>
        <input
          type="file"
          name="images"
          accept="image/*"
          multiple
          onChange={(e) => {
            previews.forEach((p) => URL.revokeObjectURL(p.url));
            setPreviews(
              Array.from(e.target.files ?? []).map((f) => ({
                name: f.name,
                url: URL.createObjectURL(f),
              })),
            );
          }}
          className="text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-accent/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-accent"
        />
      </label>

      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview
            <img
              key={p.url}
              src={p.url}
              alt={p.name}
              className="h-20 w-20 rounded-lg border border-border object-cover"
            />
          ))}
        </div>
      )}

      {state.error && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send collab request"}
      </button>
    </form>
  );
}
