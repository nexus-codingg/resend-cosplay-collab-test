import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCosplayer } from "@/lib/data";
import { Avatar } from "../../components/avatar";
import { ProposeForm } from "./propose-form";

export default function CosplayerPage({ params }: PageProps<"/cosplayers/[id]">) {
  return (
    <>
      <Link href="/" className="text-sm text-muted hover:text-foreground">
        ← All cosplayers
      </Link>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <CosplayerDetail params={params} />
      </Suspense>
    </>
  );
}

async function CosplayerDetail({ params }: { params: PageProps<"/cosplayers/[id]">["params"] }) {
  const { id } = await params;
  const cosplayer = await getCosplayer(Number(id));
  if (!cosplayer) notFound();

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
      <section className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-8 text-center lg:self-start">
        <Avatar id={cosplayer.id} name={cosplayer.name} size="lg" />
        <div>
          <h1 className="text-2xl font-semibold">{cosplayer.name}</h1>
          <p className="mt-1 text-sm text-muted">{cosplayer.email}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {cosplayer.fandoms
            .split(",")
            .map((f) => f.trim())
            .filter(Boolean)
            .map((fandom) => (
              <span
                key={fandom}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted"
              >
                {fandom}
              </span>
            ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <h2 className="text-xl font-semibold">Propose a collab</h2>
        <p className="mt-1 text-sm text-muted">
          This sends an email to {cosplayer.name.split(" ")[0]}. Their reply comes back to this
          site.
        </p>
        {/* A fresh id per form render: used as the reply token and the idempotency key */}
        <ProposeForm
          cosplayerId={cosplayer.id}
          cosplayerName={cosplayer.name}
          requestId={crypto.randomUUID()}
        />
      </section>
    </div>
  );
}
