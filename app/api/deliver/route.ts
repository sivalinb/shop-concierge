import { env } from "cloudflare:workers";
import { verifySignature, limitedBody } from "../../../lib/security";
import { json } from "../../../lib/http";
import { db, readLead, audit } from "../../../lib/store";
import { sendText, canSend } from "../../../lib/meta";
export async function POST(request: Request) {
  let raw = "";
  try {
    raw = await limitedBody(request, 1024);
  } catch {
    return json({ error: "Request too large" }, 413);
  }
  if (
    !(await verifySignature(
      raw,
      request.headers.get("x-shop-job-signature"),
      env.META_APP_SECRET,
    ))
  )
    return json({ error: "Unauthorized job" }, 401);
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Invalid job" }, 400);
  }
  if (!Number.isFinite(body.at) || Math.abs(Date.now() - body.at) > 60000)
    return json({ error: "Expired job" }, 401);
  if (!env.MERCHANT_OWNER_ID || env.LIVE_SEND_ENABLED !== "true")
    return json({ sent: 0, mode: "drafts only" });
  const user = env.MERCHANT_OWNER_ID;
  const rows = await db()
    .prepare(
      "SELECT id,lead_id,reply FROM outbox WHERE owner=? AND status=? ORDER BY at LIMIT 10",
    )
    .bind(user, "draft")
    .all<{ id: string; lead_id: string; reply: string }>();
  let sent = 0;
  for (const row of rows.results) {
    const lead = await readLead(user, row.lead_id);
    const latest = lead?.messages
      .filter((m) => m.role === "assistant")
      .at(-1)?.text;
    const blocked = !lead
      ? "Conversation removed"
      : canSend(lead, env) ||
        (latest !== row.reply ? "Superseded reply" : null);
    if (blocked) {
      await db()
        .prepare("UPDATE outbox SET status=? WHERE id=? AND status=?")
        .bind("blocked", row.id, "draft")
        .run();
      await audit(user, "reply_blocked", blocked);
      continue;
    }
    const claim = await db()
      .prepare("UPDATE outbox SET status=? WHERE id=? AND status=?")
      .bind("sending", row.id, "draft")
      .run();
    if (!claim.meta.changes) continue;
    try {
      await sendText(lead!, row.reply, env);
      await db()
        .prepare("UPDATE outbox SET status=? WHERE id=?")
        .bind("sent", row.id)
        .run();
      await audit(user, "reply_sent", lead!.channel);
      sent++;
    } catch {
      await db()
        .prepare("UPDATE outbox SET status=? WHERE id=?")
        .bind("needs_review", row.id)
        .run();
      await audit(
        user,
        "delivery_uncertain",
        "Delivery was not confirmed. Human review required before another send.",
      );
    }
  }
  return json({ sent });
}
