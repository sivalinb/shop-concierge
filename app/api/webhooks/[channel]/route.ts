import { env } from "cloudflare:workers";
import { verifySignature, limitedBody } from "../../../../lib/security";
import { extractAI } from "../../../../lib/ai";
import { hasSensitive } from "../../../../lib/domain";
import { json } from "../../../../lib/http";
import { parseWebhook } from "../../../../lib/meta";
import {
  db,
  readLead,
  insertLead,
  saveLead,
  getSettings,
  audit,
  quota,
} from "../../../../lib/store";
import {
  newLead,
  receive,
  products,
  type Product,
} from "../../../../lib/domain";
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  if (
    env.META_VERIFY_TOKEN &&
    q.get("hub.mode") === "subscribe" &&
    q.get("hub.verify_token") === env.META_VERIFY_TOKEN
  )
    return new Response(q.get("hub.challenge") || "", {
      headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" },
    });
  return new Response("Verification failed", { status: 403 });
}
export async function POST(request: Request) {
  let raw: string;
  try {
    raw = await limitedBody(request, 256_000);
  } catch {
    return json({ error: "Payload too large" }, 413);
  }
  if (
    !(await verifySignature(
      raw,
      request.headers.get("x-hub-signature-256"),
      env.META_APP_SECRET,
    ))
  )
    return json({ error: "Invalid signature" }, 401);
  if (!env.MERCHANT_OWNER_ID)
    return json({ error: "Merchant is not configured" }, 503);
  try {
    const body = JSON.parse(raw);
    const messages = parseWebhook(body, env);
    const owner = env.MERCHANT_OWNER_ID;
    const settings = await getSettings(owner);
    for (const m of messages) {
      const id = `${m.channel}:${m.id}`;
      const existing = await db()
        .prepare("SELECT state FROM webhook_events WHERE id=?")
        .bind(id)
        .first<{ state: string }>();
      if (existing?.state === "done") continue;
      await db()
        .prepare(
          "INSERT OR IGNORE INTO webhook_events(id,state,at) VALUES(?,?,?)",
        )
        .bind(id, "pending", Date.now())
        .run();
      const leadId = `live-${m.channel}-${m.sender}`;
      let lead = await readLead(owner, leadId);
      if (!lead) {
        const matched = (Object.keys(products) as Product[]).find((p) =>
          new RegExp(`\\b${products[p].keyword}S?\\b`, "i").test(m.text),
        );
        lead = newLead(matched || "jersey", m.channel, "Customer");
        lead.productSelected = !!matched;
        lead.id = leadId;
        lead.demo = false;
        lead.recipient = m.sender;
        try {
          await insertLead(owner, lead);
        } catch {
          lead = await readLead(owner, leadId);
          if (!lead) throw new Error("Storage unavailable");
        }
      }
      let facts: Record<string, string> = {};
      if (
        !lead.messages.some((x) => x.id === m.id) &&
        settings.providerConsent &&
        env.OPENAI_API_KEY &&
        env.OPENAI_MODEL &&
        !lead.optedOut &&
        !lead.human &&
        !hasSensitive(m.text)
      ) {
        try {
          await quota(`${owner}:ai`, 20);
          facts = await extractAI(env, m.text, lead);
          await audit(
            owner,
            "ai_extraction",
            "Source-checked structured facts.",
          );
        } catch {
          await audit(owner, "ai_fallback", "Local questionnaire used.");
        }
      }
      const result = receive(lead, m.text, settings.catalog, facts, m.id, m.at);
      if (!lead.messages.length && result.reply) {
        result.reply = `I’m Siva’s automated shop assistant. Ask for a person or reply STOP at any time. ${result.reply}`;
        const last = result.lead.messages.at(-1);
        if (last?.role === "assistant") last.text = result.reply;
      }
      if (result.guardrail !== "duplicate") {
        await saveLead(owner, result.lead, lead.revision);
        await audit(
          owner,
          result.guardrail ? "guardrail" : "inbound",
          result.guardrail || m.channel,
        );
      }
      // Reply drafting is idempotent. No external sends inside webhook retries.
      const reply =
        result.reply ||
        result.lead.messages.filter((x) => x.role === "assistant").at(-1)
          ?.text ||
        "";
      if (reply && !result.lead.optedOut)
        await db()
          .prepare(
            "INSERT OR IGNORE INTO outbox(id,owner,lead_id,reply,status,at) VALUES(?,?,?,?,?,?)",
          )
          .bind(id, owner, leadId, reply, "draft", Date.now())
          .run();
      await db()
        .prepare("UPDATE webhook_events SET state=? WHERE id=?")
        .bind("done", id)
        .run();
    }
    return json({ received: true, count: messages.length });
  } catch {
    return json({ error: "Temporary processing failure; retry safely." }, 503);
  }
}
