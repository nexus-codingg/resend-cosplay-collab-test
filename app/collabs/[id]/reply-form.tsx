"use client";

import { useActionState } from "react";
import { replyToCollab, type ReplyState } from "../../actions";
import { inputClass } from "../../components/field-styles";
import { ImageInput } from "../../components/image-input";
import { SendAtField } from "../../components/send-at-field";

export function ReplyForm({
  collabId,
  requestId,
  defaultSubject,
  firstName,
}: {
  collabId: number;
  requestId: string;
  defaultSubject: string;
  firstName: string;
}) {
  const [state, formAction, pending] = useActionState<ReplyState, FormData>(replyToCollab, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="collabId" value={collabId} />
      <input type="hidden" name="requestId" value={requestId} />

      <div className="grid gap-4 sm:grid-cols-2">
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
            defaultValue={state.values?.subject ?? defaultSubject}
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-medium">
        Message
        <textarea
          name="message"
          required
          rows={5}
          defaultValue={state.values?.message}
          placeholder={`Reply to ${firstName} with the plan…`}
          className={inputClass}
        />
      </label>

      <fieldset className="grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
        <legend className="px-1 text-sm font-medium">
          Collab details <span className="font-normal text-muted">(optional)</span>
        </legend>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Date
          <input
            name="date"
            defaultValue={state.values?.date}
            placeholder="Sat, Dec 6 · 2pm"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Location
          <input
            name="location"
            defaultValue={state.values?.location}
            placeholder="Golden Gate Park, Japanese Tea Garden"
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            name="confirm"
            defaultChecked={state.values?.confirm}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Mark this collab as confirmed
        </label>
      </fieldset>

      <ImageInput label="Images" />

      <SendAtField />

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
        {pending ? "Sending…" : "Send reply"}
      </button>
    </form>
  );
}
