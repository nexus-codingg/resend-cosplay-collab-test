// Seeds sample cosplayers. Safe to re-run: existing emails are skipped.
// Run: npm run db:seed
//
// Emails use the receiving domain so test sends land in Resend's Receiving tab,
// where you can check that attachments arrived.
import { createClient } from "@libsql/client";

const client = createClient({ url: process.env.DATABASE_URL ?? "file:local.db" });
const domain = process.env.SEED_EMAIL_DOMAIN ?? "collab.nexuscosplays.com";

const cosplayers = [
  { name: "Luna Starweaver", handle: "luna", fandoms: "Sailor Moon, Final Fantasy" },
  { name: "Kai Ironforge", handle: "kai", fandoms: "Overwatch, Armor builds" },
  { name: "Mika Sakura", handle: "mika", fandoms: "Demon Slayer, Genshin Impact" },
  { name: "Rex Valkyrie", handle: "rex", fandoms: "Marvel, Star Wars" },
  { name: "Ivy Thornfield", handle: "ivy", fandoms: "Zelda, Elden Ring" },
  { name: "Juno Pixel", handle: "juno", fandoms: "Persona, Cyberpunk 2077" },
];

for (const c of cosplayers) {
  await client.execute({
    sql: "INSERT OR IGNORE INTO cosplayers (name, email, fandoms) VALUES (?, ?, ?)",
    args: [c.name, `${c.handle}@${domain}`, c.fandoms],
  });
}

const { rows } = await client.execute("SELECT id, name, email FROM cosplayers ORDER BY id");
console.table(rows);
