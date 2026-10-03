// Public Meta webhook ingress. The merchant desk remains private.
// Configure secrets with your host's secret store; never commit them.
interface GatewayEnv {
  SHOP_SITE_ORIGIN: string;
  SHOP_SERVICE_TOKEN: string;
  META_APP_SECRET: string;
  META_VERIFY_TOKEN: string;
}
async function signature(raw: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)),
  );
  return (
    "sha256=" +
    Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  );
}
export default {
  async fetch(request: Request, env: GatewayEnv, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (!/^\/webhooks\/(whatsapp|instagram)$/.test(url.pathname))
      return new Response("Not found", { status: 404 });
    if (
      !env.SHOP_SITE_ORIGIN ||
      !env.SHOP_SERVICE_TOKEN ||
      !env.META_APP_SECRET
    )
      return new Response("Not configured", { status: 503 });
    const base = new URL(env.SHOP_SITE_ORIGIN);
    if (base.protocol !== "https:")
      return new Response("HTTPS required", { status: 503 });
    if (request.method === "GET") {
      if (
        url.searchParams.get("hub.mode") === "subscribe" &&
        url.searchParams.get("hub.verify_token") === env.META_VERIFY_TOKEN
      )
        return new Response(url.searchParams.get("hub.challenge") || "", {
          headers: { "Content-Type": "text/plain" },
        });
      return new Response("Forbidden", { status: 403 });
    }
    if (request.method !== "POST")
      return new Response("Method not allowed", { status: 405 });
    if (Number(request.headers.get("content-length")) > 256000)
      return new Response("Too large", { status: 413 });
    const reader = request.body?.getReader();
    if (!reader) return new Response("Empty", { status: 400 });
    let total = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > 256000) {
        await reader.cancel();
        return new Response("Too large", { status: 413 });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) {
      bytes.set(c, off);
      off += c.length;
    }
    const raw = new TextDecoder().decode(bytes);
    const expected = await signature(raw, env.META_APP_SECRET);
    const actual = request.headers.get("x-hub-signature-256") || "";
    if (actual.length !== expected.length)
      return new Response("Invalid signature", { status: 401 });
    let diff = 0;
    for (let i = 0; i < expected.length; i++)
      diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff) return new Response("Invalid signature", { status: 401 });
    const response = await fetch(`${base.origin}/api${url.pathname}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": actual,
        "OAI-Sites-Authorization": `Bearer ${env.SHOP_SERVICE_TOKEN}`,
      },
      body: raw,
      redirect: "error",
    });
    if (response.ok) {
      ctx.waitUntil(
        (async () => {
          const job = JSON.stringify({ at: Date.now() });
          await fetch(`${base.origin}/api/deliver`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-shop-job-signature": await signature(job, env.META_APP_SECRET),
              "OAI-Sites-Authorization": `Bearer ${env.SHOP_SERVICE_TOKEN}`,
            },
            body: job,
            redirect: "error",
          });
        })(),
      );
    }
    return new Response(response.ok ? "EVENT_RECEIVED" : "Retry later", {
      status: response.ok ? 200 : 503,
    });
  },
};
