import { env } from "cloudflare:workers";
import { z } from "zod";
import { owner, json, failure } from "../../../lib/http";
import { limitedBody } from "../../../lib/security";
import {
  db,
  seed,
  readLead,
  saveLead,
  insertLead,
  audit,
  getSettings,
  setSettings,
  state,
  quota,
} from "../../../lib/store";
import {
  newLead,
  receive,
  products,
  fieldsFor,
  initialCatalog,
  workOrder,
  redact,
  hasSensitive,
} from "../../../lib/domain";
import { extractAI } from "../../../lib/ai";
import { sendText, canSend } from "../../../lib/meta";
const payload = z
  .object({
    action: z.enum([
      "seed",
      "new",
      "message",
      "answer",
      "review",
      "catalog",
      "consent",
      "delete",
      "send",
    ]),
    id: z.string().max(100).optional(),
    text: z.string().max(4000).optional(),
    field: z.string().max(40).optional(),
    product: z.enum(["tea", "oil", "jersey", "bag"]).optional(),
    channel: z.enum(["whatsapp", "instagram"]).optional(),
    name: z.string().max(100).optional(),
    value: z.unknown().optional(),
  })
  .strict();
export async function POST(request: Request) {
  try {
    const user = await owner(request);
    await quota(`${user}:actions`, 80);
    const body = payload.parse(JSON.parse(await limitedBody(request)));
    const settings = await getSettings(user);
    if (body.action === "seed") {
      await seed(user);
      return json(await state(user));
    }
    if (body.action === "new") {
      const l = newLead(
        body.product || "jersey",
        body.channel || "instagram",
        body.name || "Demo customer",
      );
      l.messages.push({
        id: crypto.randomUUID(),
        role: "assistant",
        text: `I’m Siva’s automated shop assistant. I can collect your enquiry for ${products[l.product].name}. You can ask for a person or reply STOP at any time. ${fieldsFor(l.product)[0].question}`,
        at: Date.now(),
      });
      await insertLead(user, l);
      await audit(user, "demo_created", l.product);
      return json(await state(user));
    }
    if (body.action === "catalog") {
      const items = z
        .array(
          z
            .object({
              product: z.enum(["tea", "oil", "jersey", "bag"]),
              description: z.string().max(1000),
              priceIN: z.number().min(0).nullable(),
              priceUS: z.number().min(0).nullable(),
              stock: z.string().max(150),
              shipping: z.string().max(300),
              approved: z.boolean(),
            })
            .strict(),
        )
        .length(4)
        .parse(body.value);
      if (new Set(items.map((i) => i.product)).size !== 4)
        throw new Error("Invalid product catalog.");
      await setSettings(user, { ...settings, catalog: items });
      await audit(user, "catalog_updated", "Merchant catalog saved.");
      return json(await state(user));
    }
    if (body.action === "consent") {
      if (typeof body.value !== "boolean") throw new Error("Invalid consent.");
      await setSettings(user, { ...settings, providerConsent: body.value });
      await audit(
        user,
        "provider_consent",
        body.value ? "Enabled" : "Disabled",
      );
      return json(await state(user));
    }
    if (!body.id) throw new Error("Conversation id required.");
    const lead = await readLead(user, body.id);
    if (!lead) throw new Error("Conversation not found.");
    if (body.action === "delete") {
      if (body.value !== "DELETE")
        throw new Error("Delete confirmation required.");
      await db().batch([
        db()
          .prepare("DELETE FROM leads WHERE owner=? AND id=?")
          .bind(user, lead.id),
        db()
          .prepare("DELETE FROM outbox WHERE owner=? AND lead_id=?")
          .bind(user, lead.id),
      ]);
      await audit(
        user,
        "conversation_deleted",
        "Conversation and associated drafts deleted.",
      );
      return json(await state(user));
    }
    if (body.action === "review") {
      lead.review = "reviewed";
      lead.revision++;
      await saveLead(user, lead, lead.revision - 1);
      await audit(user, "human_review", "Enquiry reviewed by owner.");
      return json(await state(user));
    }
    if (body.action === "send") {
      const blocked = canSend(lead, env);
      if (blocked) throw new Error(blocked);
      const text = body.text?.trim();
      if (!text || hasSensitive(text))
        throw new Error(
          "Invalid reply. Use plain text without sensitive payment data.",
        );
      await sendText(lead, redact(text), env);
      lead.messages.push({
        id: crypto.randomUUID(),
        role: "owner",
        text: redact(text),
        at: Date.now(),
      });
      lead.revision++;
      await saveLead(user, lead, lead.revision - 1);
      await audit(user, "manual_reply_sent", lead.channel);
      return json(await state(user));
    }
    let text = body.text?.trim();
    if (!text) throw new Error("Message text required.");
    let extra: Record<string, string> = {};
    if (body.action === "answer") {
      if (
        !body.field ||
        !fieldsFor(lead.product).some((f) => f.key === body.field)
      )
        throw new Error("Invalid questionnaire field.");
      extra = { [body.field]: text };
      text = `${body.field}: ${text}`;
    } else if (
      settings.providerConsent &&
      env.OPENAI_API_KEY &&
      env.OPENAI_MODEL &&
      !lead.optedOut &&
      !lead.human &&
      !hasSensitive(text) &&
      !/^CONFIRM|^STOP|^START/i.test(text)
    ) {
      try {
        await quota(`${user}:ai`, 20);
        extra = await extractAI(env, text, lead);
        await audit(
          user,
          "ai_extraction",
          "Structured facts validated against customer source.",
        );
      } catch {
        await audit(
          user,
          "ai_fallback",
          "Provider unavailable; local questionnaire used.",
        );
      }
    }
    const result = receive(lead, text, settings.catalog, extra);
    await saveLead(user, result.lead, lead.revision);
    await audit(
      user,
      result.guardrail ? "guardrail" : "message",
      result.guardrail || `${lead.channel} ${lead.product}`,
    );
    return json({ ...(await state(user)), workOrder: workOrder(result.lead) });
  } catch (e) {
    return failure(e);
  }
}
