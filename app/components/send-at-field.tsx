"use client";

import { useState } from "react";
import { inputClass } from "./field-styles";

// Resend's scheduledAt accepts natural language as well as ISO 8601. Relative phrases
// are safe to pass through; clock times like "tomorrow at 9am" are read as UTC, so
// those are converted to ISO in the browser using your own timezone.
const PRESETS = [
  { value: "in 2 min", label: "In 2 minutes" },
  { value: "in 1 hour", label: "In 1 hour" },
  { value: "tomorrow-9am", label: "Tomorrow at 9am" },
];

function tomorrowAt9() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

function resolve(choice: string, custom: string) {
  if (choice === "custom") return custom ? new Date(custom).toISOString() : "";
  if (choice === "tomorrow-9am") return tomorrowAt9();
  return choice;
}

/**
 * "When to send" picker. Submits `sendAt`: "" for now, a relative phrase, or an
 * ISO 8601 time worked out in the browser so it keeps your timezone.
 */
export function SendAtField({ allowNow = true }: { allowNow?: boolean }) {
  const [choice, setChoice] = useState(allowNow ? "" : PRESETS[0].value);
  const [custom, setCustom] = useState("");
  const value = resolve(choice, custom);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {allowNow ? "When" : "New time"}
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className={`${inputClass} w-auto`}
        >
          {allowNow && <option value="">Send now</option>}
          {PRESETS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
          <option value="custom">Pick a date and time…</option>
        </select>
      </label>
      {choice === "custom" && (
        <input
          type="datetime-local"
          required
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          aria-label="Send at"
          className={`${inputClass} w-auto`}
        />
      )}
      <input type="hidden" name="sendAt" value={value} />
    </div>
  );
}
