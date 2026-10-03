import test from "node:test";
import assert from "node:assert/strict";
import {
  verifySignature,
  sameOrigin,
  limitedBytes,
  validImage,
} from "../lib/security.ts";
import { parseWebhook, canSend, sendText } from "../lib/meta.ts";
import { newLead } from "../lib/domain.ts";
async function sign(raw: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("test-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return (
    "sha256=" +
    Buffer.from(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)),
    ).toString("hex")
  );
}
test("signed webhook validates exact original bytes", async () => {
  const raw = '{"text":"hello"}';
  assert.equal(
    await verifySignature(raw, await sign(raw), "test-secret"),
    true,
  );
  assert.equal(
    await verifySignature(raw + " ", await sign(raw), "test-secret"),
    false,
  );
});
test("unsigned, malformed and misconfigured webhooks fail closed", async () => {
  for (const s of [null, "", "sha256=bad"])
    assert.equal(await verifySignature("a", s, "test-secret"), false);
  assert.equal(await verifySignature("a", await sign("a"), undefined), false);
});
test("cross-origin mutation requests are rejected", () => {
  assert.equal(
    sameOrigin(
      new Request("https://desk.test/api", {
        headers: { Origin: "https://evil.test" },
      }),
    ),
    false,
  );
});
test("bounded reader rejects chunked oversize bodies without trusting content length", async () => {
  await assert.rejects(
    () =>
      limitedBytes(
        new Request("https://desk.test", { method: "POST", body: "12345" }),
        4,
      ),
    /too large/,
  );
});
test("bounded reader preserves binary screenshot bytes", async () => {
  const image = new Uint8Array([137, 80, 78, 71, 255, 0, 200]);
  const data = await limitedBytes(
    new Request("https://desk.test", { method: "POST", body: image }),
  );
  assert.deepEqual(data, image);
  assert.ok(validImage(data, "image/png"));
  assert.equal(
    validImage(new TextEncoder().encode("<svg/>"), "image/png"),
    false,
  );
});
const cfg = {
  META_GRAPH_VERSION: "v99.0",
  LIVE_SEND_ENABLED: "true",
  WHATSAPP_ACCESS_TOKEN: "test-only",
  WHATSAPP_PHONE_NUMBER_ID: "shop-phone",
  INSTAGRAM_ACCESS_TOKEN: "test-only",
  INSTAGRAM_ACCOUNT_ID: "shop-ig",
};
test("only configured WhatsApp account is parsed", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "shop-phone" },
              messages: [
                {
                  id: "m1",
                  from: "buyer",
                  type: "text",
                  text: { body: "TEA" },
                  timestamp: "1760000000",
                },
              ],
            },
          },
        ],
      },
    ],
  };
  assert.equal(parseWebhook(payload, cfg).length, 1);
  assert.equal(
    parseWebhook(payload, { ...cfg, WHATSAPP_PHONE_NUMBER_ID: "other" }).length,
    0,
  );
});
test("Instagram echoes and foreign recipients are ignored", () => {
  const payload = {
    object: "instagram",
    entry: [
      {
        id: "shop-ig",
        messaging: [
          {
            sender: { id: "buyer" },
            recipient: { id: "shop-ig" },
            timestamp: 1760000000000,
            message: { mid: "m1", text: "BAG", is_echo: true },
          },
        ],
      },
    ],
  };
  assert.equal(parseWebhook(payload, cfg).length, 0);
  payload.entry[0].messaging[0].message.is_echo = false;
  assert.equal(parseWebhook(payload, cfg).length, 1);
});
test("demo conversations cannot send even with credentials and live enabled", () => {
  const l = newLead("tea", "whatsapp");
  l.recipient = "test-buyer";
  l.lastInboundAt = Date.now();
  assert.match(canSend(l, cfg) || "", /Demo/);
});
test("expired messaging windows and opt outs stop actual API calls", async () => {
  const l = newLead("tea", "whatsapp");
  l.demo = false;
  l.recipient = "test-buyer";
  l.lastInboundAt = Date.now() - 25 * 3600000;
  let calls = 0;
  await assert.rejects(
    () =>
      sendText(l, "hello", cfg, async () => {
        calls++;
        return new Response("{}");
      }),
    /24-hour/,
  );
  assert.equal(calls, 0);
  l.lastInboundAt = Date.now();
  l.optedOut = true;
  assert.match(canSend(l, cfg) || "", /opted out/);
});
test("future timestamps cannot create an unlimited reply window", () => {
  const l = newLead("tea", "whatsapp");
  l.demo = false;
  l.recipient = "test-buyer";
  l.lastInboundAt = Date.now() + 3600000;
  assert.match(canSend(l, cfg) || "", /24-hour/);
});
test("live message adapter targets official endpoint and exact recipient", async () => {
  const l = newLead("tea", "whatsapp");
  l.demo = false;
  l.recipient = "test-buyer";
  l.lastInboundAt = Date.now();
  let called = false;
  await sendText(l, "Which tea?", cfg, async (url, options) => {
    called = true;
    assert.equal(
      String(url),
      "https://graph.facebook.com/v99.0/shop-phone/messages",
    );
    const body = JSON.parse(String(options?.body));
    assert.equal(body.to, "test-buyer");
    assert.equal(body.text.body, "Which tea?");
    return Response.json({ messages: [{ id: "sent" }] });
  });
  assert.ok(called);
});
