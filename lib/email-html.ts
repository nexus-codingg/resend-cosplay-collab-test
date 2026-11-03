function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Plain-text message -> simple HTML email body. */
export function interestEmailHtml(opts: {
  cosplayerName: string;
  senderName: string;
  message: string;
  imageCount: number;
}) {
  const paragraphs = escapeHtml(opts.message)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  const imageNote = opts.imageCount
    ? `<p style="margin:0 0 16px;color:#6b7280">📎 ${opts.imageCount} reference image${opts.imageCount === 1 ? "" : "s"} attached.</p>`
    : "";

  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#111827;max-width:560px">
  <p style="margin:0 0 16px">Hi ${escapeHtml(opts.cosplayerName)},</p>
  ${paragraphs}
  ${imageNote}
  <p style="margin:0">— ${escapeHtml(opts.senderName)}</p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px">
  <p style="margin:0;font-size:12px;color:#9ca3af">Sent via Nexus Cosplays. Reply to this email to continue the conversation.</p>
</div>`;
}
