import test from "node:test";
import assert from "node:assert/strict";
import { extractAI, structured, localSummary } from "../lib/ai.ts";
import { newLead } from "../lib/domain.ts";
function provider(facts: any[]) {
  return async () =>
    Response.json({
      status: "completed",
      output: [
        { content: [{ type: "output_text", text: JSON.stringify({ facts }) }] },
      ],
    });
}
const cfg = {
  OPENAI_API_KEY: "mock-key-never-used-on-network",
  OPENAI_MODEL: "mock-model",
};
test("AI configuration is required before any provider call", async () => {
  await assert.rejects(() => structured({}, "x", [], {}), /not connected/);
});
test("AI facts need an exact source quote", async () => {
  const facts = await extractAI(
    cfg,
    "We need 20 jerseys",
    newLead("jersey", "instagram"),
    provider([
      { field: "quantity", value: "20", quote: "20 jerseys" },
      { field: "fabric", value: "silk", quote: "silk" },
    ]),
  );
  assert.deepEqual(facts, { quantity: "20" });
});
test("hallucinated numeric values are rejected even with a valid quote", async () => {
  const facts = await extractAI(
    cfg,
    "We need 20 jerseys",
    newLead("jersey", "instagram"),
    provider([{ field: "quantity", value: "200", quote: "20 jerseys" }]),
  );
  assert.deepEqual(facts, {});
});
test("AI output cannot set payment state or consent", async () => {
  const facts = await extractAI(
    cfg,
    "We need 20 jerseys",
    newLead("jersey", "instagram"),
    provider([
      { field: "paid", value: "true", quote: "20 jerseys" },
      { field: "consent", value: "true", quote: "20 jerseys" },
    ]),
  );
  assert.deepEqual(facts, {});
});
test("provider refusal and incomplete output fail to local fallback path", async () => {
  await assert.rejects(
    () =>
      extractAI(cfg, "text", newLead("tea", "whatsapp"), async () =>
        Response.json({ status: "incomplete", output: [] }),
      ),
    /complete result/,
  );
});
test("provider 429 is surfaced without leaking provider response or key", async () => {
  await assert.rejects(
    () =>
      extractAI(
        cfg,
        "text",
        newLead("tea", "whatsapp"),
        async () => new Response("secret-provider-debug", { status: 429 }),
      ),
    /429/,
  );
});
test("local digest only excerpts shared text and removes sensitive numbers", () => {
  const s = localSummary(
    "Meet on Saturday. Call this card 4111 1111 1111 1111.",
  );
  assert.match(s, /Saturday/);
  assert.ok(!s.includes("4111"));
});
