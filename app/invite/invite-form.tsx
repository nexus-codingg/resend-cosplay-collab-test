"use client";

import { useActionState } from "react";
import { inviteGroup, type InviteState } from "../actions";
import { Avatar } from "../components/avatar";
import { inputClass } from "../components/field-styles";
import { SendAtField } from "../components/send-at-field";

export function InviteForm({
  requestId,
  cosplayers,
}: {
  requestId: string;
  cosplayers: { id: number; name: string; fandoms: string }[];
}) {
  const [state, formAction, pending] = useActionState<InviteState, FormData>(inviteGroup, {});
  const picked = new Set(state.values?.cosplayerIds);

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-6">
      <input type="hidden" name="requestId" value={requestId} />

      <fieldset>
        <legend className="mb-3 text-sm font-medium">Who to invite</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cosplayers.map((c) => (
            <label
              key={c.id}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface p-3 transition has-checked:border-accent has-checked:bg-accent/5"
            >
              <input
                type="checkbox"
                name="cosplayerIds"
                value={c.id}
                defaultChecked={picked.has(c.id)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <Avatar id={c.id} name={c.name} size="sm" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{c.name}</span>
                <span className="block truncate text-xs text-muted">{c.fandoms}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

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
            defaultValue={state.values?.subject ?? "Group shoot invite"}
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
          placeholder="Theme, date, location, what to bring…"
          className={inputClass}
        />
      </label>

      <SendAtField />

      <p className="text-xs text-muted">
        Batch emails can&apos;t include attachments, so group invites are text only. Send
        images in a reply on each thread.
      </p>

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
        {pending ? "Sending…" : "Send group invite"}
      </button>
    </form>
  );
}
