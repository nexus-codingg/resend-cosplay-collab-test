"use client";

import { useActionState } from "react";
import { proposeCollab, type ProposeState } from "../../actions";
import { inputClass } from "../../components/field-styles";
import { ImageInput } from "../../components/image-input";

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

      <ImageInput label="Reference images" />

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
