import Link from "next/link";
import { Suspense } from "react";
import { getCosplayers } from "@/lib/data";
import { Avatar } from "./components/avatar";

export default function Home() {
  return (
    <>
      <section className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Find your next{" "}
          <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
            cosplay collab
          </span>
        </h1>
        <p className="mt-3 max-w-xl text-muted">
          Pick a cosplayer, pitch your idea with reference images, and keep the whole
          conversation in one thread.
        </p>
      </section>
      <Suspense fallback={<p className="text-muted">Loading cosplayers…</p>}>
        <CosplayerGrid />
      </Suspense>
    </>
  );
}

async function CosplayerGrid() {
  const cosplayers = await getCosplayers();

  if (cosplayers.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted">
        No cosplayers yet. Run <code className="font-mono">npm run db:seed</code> to add some.
      </p>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cosplayers.map((c) => (
        <li key={c.id}>
          <Link
            href={`/cosplayers/${c.id}`}
            className="flex h-full items-center gap-4 rounded-xl border border-border bg-surface p-4 transition hover:border-accent"
          >
            <Avatar id={c.id} name={c.name} />
            <div className="min-w-0">
              <p className="font-medium">{c.name}</p>
              <p className="truncate text-sm text-muted">{c.fandoms}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
