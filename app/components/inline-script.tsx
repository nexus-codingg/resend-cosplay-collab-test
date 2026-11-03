"use client";

// Executable in the server HTML; inert text/plain when React renders on the client,
// which avoids React's "script tag while rendering" warning. Pattern from the Next.js
// "Preventing flash before hydration" guide. Must be a Client Component so the
// typeof window check actually runs in the browser.
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
