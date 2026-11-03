import Link from "next/link";
import { Suspense } from "react";
import { getCollabs } from "@/lib/data";
import { Avatar } from "../components/avatar";
import { StatusBadge } from "./status-badge";

export default function CollabsPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Collabs</h1>
      <p className="mt-2 text-muted">Every collaboration you&apos;ve started, newest first.</p>
      <Suspense fallback={<p className="mt-8 text-muted">Loading collabs…</p>}>
        <CollabList />
      </Suspense>
    </>
  );
}

async function CollabList() {
  const rows = await getCollabs();

  if (rows.length === 0) {
    return (
      <p className="mt-8 rounded-xl border border-dashed border-border p-8 text-center text-muted">
        No collabs yet.{" "}
        <Link href="/" className="text-accent underline">
          Pick a cosplayer
        </Link>{" "}
        to send your first request.
      </p>
    );
  }

  return (
    <ul className="mt-8 flex flex-col gap-3">
      {rows.map(({ collab, cosplayer }) => (
        <li key={collab.id}>
          <Link
            href={`/collabs/${collab.id}`}
            className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition hover:border-accent"
          >
            <Avatar id={cosplayer.id} name={cosplayer.name} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{cosplayer.name}</p>
              <p className="text-sm text-muted">
                Started {new Date(`${collab.createdAt}Z`).toLocaleDateString()}
              </p>
            </div>
            <StatusBadge status={collab.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
