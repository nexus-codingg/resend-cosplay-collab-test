"use client";

import { useState } from "react";

/** Multi-image file input with thumbnail previews. Submits as the `images` form field. */
export function ImageInput({ label }: { label: string }) {
  const [previews, setPreviews] = useState<{ name: string; url: string }[]>([]);

  return (
    <>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {label} <span className="font-normal text-muted">(up to 5, 10MB total)</span>
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
    </>
  );
}
