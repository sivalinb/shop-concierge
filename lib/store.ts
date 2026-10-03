import { env } from "cloudflare:workers";
import {
  demoLeads,
  initialCatalog,
  type Lead,
  type CatalogItem,
} from "./domain";
export type Story = {
  id: string;
  title: string;
  source: string;
  text: string;
  summary: string;
  mode: string;
  createdAt: number;
  mediaType?: string;
  key?: string;
  filename?: string;
};
export type ShopSettings = {
  catalog: CatalogItem[];
  providerConsent: boolean;
  markets: string[];
  demoInitialized?: boolean;
};
export function db(): D1Database {
  if (!env.DB) throw new Error("Storage unavailable.");
  return env.DB;
}
export async function readLead(
  owner: string,
  id: string,
): Promise<Lead | null> {
  const r = await db()
    .prepare("SELECT data FROM leads WHERE owner=? AND id=?")
    .bind(owner, id)
    .first<{ data: string }>();
  return r ? JSON.parse(r.data) : null;
}
export async function saveLead(
  owner: string,
  lead: Lead,
  expectedRevision: number,
) {
  const r = await db()
    .prepare(
      "UPDATE leads SET data=?, revision=?, updated_at=? WHERE owner=? AND id=? AND revision=?",
    )
    .bind(
      JSON.stringify(lead),
      lead.revision,
      lead.updatedAt,
      owner,
      lead.id,
      expectedRevision,
    )
    .run();
  if (!r.meta.changes)
    throw new Error("Conversation changed. Refresh and try again.");
}
export async function insertLead(owner: string, lead: Lead) {
  await db()
    .prepare(
      "INSERT INTO leads(owner,id,data,revision,updated_at) VALUES(?,?,?,?,?)",
    )
    .bind(owner, lead.id, JSON.stringify(lead), lead.revision, lead.updatedAt)
    .run();
}
export async function audit(owner: string, kind: string, detail: string) {
  await db()
    .prepare("INSERT INTO events(owner,id,kind,detail,at) VALUES(?,?,?,?,?)")
    .bind(owner, crypto.randomUUID(), kind, detail.slice(0, 500), Date.now())
    .run();
}
export async function getSettings(owner: string): Promise<ShopSettings> {
  const r = await db()
    .prepare("SELECT data FROM settings WHERE owner=?")
    .bind(owner)
    .first<{ data: string }>();
  return r
    ? JSON.parse(r.data)
    : {
        catalog: initialCatalog,
        providerConsent: false,
        markets: ["IN", "US"],
      };
}
export async function setSettings(owner: string, data: ShopSettings) {
  await db()
    .prepare(
      "INSERT INTO settings(owner,data) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET data=excluded.data",
    )
    .bind(owner, JSON.stringify(data))
    .run();
}
export async function state(owner: string) {
  const [l, s, e, o, config] = await Promise.all([
    db()
      .prepare("SELECT data FROM leads WHERE owner=? ORDER BY updated_at DESC")
      .bind(owner)
      .all<{ data: string }>(),
    db()
      .prepare(
        "SELECT data FROM stories WHERE owner=? ORDER BY created_at DESC",
      )
      .bind(owner)
      .all<{ data: string }>(),
    db()
      .prepare(
        "SELECT kind,detail,at FROM events WHERE owner=? ORDER BY at DESC LIMIT 100",
      )
      .bind(owner)
      .all(),
    db()
      .prepare(
        "SELECT id,lead_id,status,at FROM outbox WHERE owner=? ORDER BY at DESC LIMIT 30",
      )
      .bind(owner)
      .all(),
    getSettings(owner),
  ]);
  return {
    leads: l.results.map((r) => JSON.parse(r.data) as Lead),
    stories: s.results.map((r) => JSON.parse(r.data) as Story),
    events: e.results,
    outbox: o.results,
    settings: config,
    connections: {
      whatsapp: !!(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID),
      instagram: !!(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_ACCOUNT_ID),
      ai: !!(env.OPENAI_API_KEY && env.OPENAI_MODEL),
      liveEnabled: env.LIVE_SEND_ENABLED === "true",
    },
    demo: true,
  };
}
export async function seed(owner: string) {
  const config = await getSettings(owner);
  if (config.demoInitialized) return;
  const count = await db()
    .prepare("SELECT COUNT(*) as n FROM leads WHERE owner=?")
    .bind(owner)
    .first<{ n: number }>();
  if (count?.n) {
    await setSettings(owner, { ...config, demoInitialized: true });
    return;
  }
  await db().batch(
    demoLeads().map((l) =>
      db()
        .prepare(
          "INSERT OR IGNORE INTO leads(owner,id,data,revision,updated_at) VALUES(?,?,?,?,?)",
        )
        .bind(owner, l.id, JSON.stringify(l), l.revision, l.updatedAt),
    ),
  );
  await setSettings(owner, { ...config, demoInitialized: true });
  await audit(
    owner,
    "demo_seeded",
    "Four fictional product enquiries loaded. No customer messages sent.",
  );
}

export async function quota(scope: string, limit: number) {
  const now = Date.now(),
    expires = Math.floor(now / 60000) * 60000 + 60000;
  const key = `${scope}:${expires}`;
  const row = await db()
    .prepare(
      "INSERT INTO rate_limits(key,used,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET used=used+1 RETURNING used",
    )
    .bind(key, expires)
    .first<{ used: number }>();
  if (!row || row.used > limit)
    throw new Error("Rate limit reached. Please wait a minute and try again.");
  await db()
    .prepare("DELETE FROM rate_limits WHERE expires_at<?")
    .bind(now - 3600000)
    .run();
}
