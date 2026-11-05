function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraphsHtml(message: string) {
  return escapeHtml(message)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function imageNoteHtml(imageCount: number, kind: string) {
  return imageCount
    ? `<p style="margin:0 0 16px;color:#6b7280">📎 ${imageCount} ${kind}${imageCount === 1 ? "" : "s"} attached.</p>`
    : "";
}

function layout(cosplayerName: string, senderName: string, body: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#111827;max-width:560px">
  <p style="margin:0 0 16px">Hi ${escapeHtml(cosplayerName)},</p>
  ${body}
  <p style="margin:0">— ${escapeHtml(senderName)}</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px">
  <p style="margin:0;font-size:12px;color:#9ca3af">Sent via Nexus Cosplays. Reply to this email to continue the conversation.</p>
</div>`;
}

/** Plain-text message -> simple HTML email body. */
export function interestEmailHtml(opts: {
  cosplayerName: string;
  senderName: string;
  message: string;
  imageCount: number;
}) {
  return layout(
    opts.cosplayerName,
    opts.senderName,
    paragraphsHtml(opts.message) + imageNoteHtml(opts.imageCount, "reference image"),
  );
}

export type CollabDetails = { date?: string; location?: string };

/** Rows for the collab details box; only the details that were filled in. */
export function detailRows(details: CollabDetails) {
  return [
    details.date && ["Date", details.date],
    details.location && ["Location", details.location],
  ].filter(Boolean) as [string, string][];
}

/** Reply with collab details: message, a details box, and an attachment note. */
export function replyEmailHtml(opts: {
  cosplayerName: string;
  senderName: string;
  message: string;
  details: CollabDetails;
  confirmed: boolean;
  imageCount: number;
}) {
  const rows = detailRows(opts.details);
  const detailsBox = rows.length
    ? `<table role="presentation" style="margin:0 0 16px;border:1px solid #e5e7eb;border-radius:8px;border-collapse:separate;padding:12px 16px">
    <tr><td colspan="2" style="padding:0 0 8px;font-weight:bold">${opts.confirmed ? "✅ Collab confirmed" : "Collab details"}</td></tr>
    ${rows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:2px 16px 2px 0;color:#6b7280">${label}</td><td style="padding:2px 0">${escapeHtml(value)}</td></tr>`,
      )
      .join("")}
  </table>`
    : "";

  return layout(
    opts.cosplayerName,
    opts.senderName,
    paragraphsHtml(opts.message) + detailsBox + imageNoteHtml(opts.imageCount, "image"),
  );
}
