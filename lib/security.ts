export async function verifySignature(
  raw: string,
  signature: string | null,
  secret: string | undefined,
): Promise<boolean> {
  if (!secret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature))
    return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const bytes = new Uint8Array(
    signature
      .slice(7)
      .match(/../g)!
      .map((s) => parseInt(s, 16)),
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    bytes,
    new TextEncoder().encode(raw),
  );
}
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
export async function limitedBytes(
  request: Request,
  limit = 64_000,
): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length")) > limit)
    throw new Error("Request too large.");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  let n = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > limit) {
      await reader.cancel();
      throw new Error("Request too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(n);
  let off = 0;
  for (const c of chunks) {
    bytes.set(c, off);
    off += c.length;
  }
  return bytes;
}
export async function limitedBody(
  request: Request,
  limit = 64_000,
): Promise<string> {
  return new TextDecoder().decode(await limitedBytes(request, limit));
}
export function validImage(bytes: Uint8Array, type: string): boolean {
  return type === "image/png"
    ? bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71
    : type === "image/jpeg"
      ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : type === "image/webp"
        ? new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
          new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
        : false;
}
