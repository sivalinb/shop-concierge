import { env } from "cloudflare:workers";
import { owner, json, failure } from "../../../lib/http";
import { db, audit, getSettings, quota } from "../../../lib/store";
import { localSummary, summarizeAI } from "../../../lib/ai";
import { limitedBody, limitedBytes, validImage } from "../../../lib/security";
import { redact } from "../../../lib/domain";
export async function POST(request: Request) {
  try {
    const user = await owner(request);
    await quota(`${user}:stories`, 10);
    const settings = await getSettings(user);
    const type = request.headers.get("content-type") || "";
    let title = "",
      source = "",
      text = "",
      file: File | null = null;
    let useAI = false;
    let action = "create";
    let id = "";
    if (type.startsWith("multipart/form-data")) {
      const raw = await limitedBytes(request, 6_500_000);
      const form = await new Request(request.url, {
        method: "POST",
        headers: { "content-type": type },
        body: raw as BodyInit,
      }).formData();
      title = String(form.get("title") || "Shared Story").slice(0, 100);
      source = String(form.get("source") || "Shared intentionally").slice(
        0,
        200,
      );
      text = String(form.get("text") || "").slice(0, 8000);
      const f = form.get("file");
      if (f instanceof File && f.size) file = f;
      useAI = form.get("useAI") === "true";
    } else {
      const body = JSON.parse(await limitedBody(request, 40_000));
      action = body.action || "create";
      id = String(body.id || "");
      title = String(body.title || "Shared Story").slice(0, 100);
      source = String(body.source || "Shared intentionally").slice(0, 200);
      text = String(body.text || "").slice(0, 8000);
      useAI = body.useAI === true;
    }
    if (action === "delete") {
      const row = await db()
        .prepare("SELECT data FROM stories WHERE owner=? AND id=?")
        .bind(user, id)
        .first<{ data: string }>();
      if (!row) throw new Error("Story not found.");
      const old = JSON.parse(row.data);
      if (old.key) await env.BUCKET?.delete(old.key);
      await db()
        .prepare("DELETE FROM stories WHERE owner=? AND id=?")
        .bind(user, id)
        .run();
      await audit(
        user,
        "story_deleted",
        "Shared item and stored media deleted.",
      );
      return json({ ok: true });
    }
    if (!file && !text.trim())
      throw new Error("Story text or screenshot required.");
    if (file && file.size > 5_000_000)
      throw new Error("Screenshot too large. Maximum 5 MB.");
    const story: any = {
      id: crypto.randomUUID(),
      title,
      source,
      text: redact(text),
      summary: localSummary(text),
      mode: "Local extractive summary",
      createdAt: Date.now(),
    };
    let bytes: Uint8Array | undefined;
    if (file) {
      bytes = new Uint8Array(await file.arrayBuffer());
      if (!validImage(bytes, file.type))
        throw new Error("Unsupported screenshot. Use PNG, JPEG or WebP.");
      if (!env.BUCKET) throw new Error("Storage unavailable.");
      story.key = `${encodeURIComponent(user)}/${story.id}`;
      story.filename = file.name.slice(0, 100);
      story.mediaType = file.type;
      if (!text)
        story.summary =
          "Screenshot saved. Add its text for a local digest, or connect AI and explicitly allow image analysis.";
    }
    if (useAI) {
      if (!settings.providerConsent)
        throw new Error(
          "Provider consent required. Enable it in Connections first.",
        );
      let image: string | undefined;
      if (bytes && file) {
        let binary = "";
        for (const b of bytes) binary += String.fromCharCode(b);
        image = `data:${file.type};base64,${btoa(binary)}`;
      }
      story.summary = await summarizeAI(env, text, image);
      story.mode = "OpenAI summary — source claims, not verified facts";
    }
    if (bytes && file)
      await env.BUCKET!.put(story.key, bytes, {
        httpMetadata: { contentType: file.type },
      });
    await db()
      .prepare("INSERT INTO stories(owner,id,data,created_at) VALUES(?,?,?,?)")
      .bind(user, story.id, JSON.stringify(story), story.createdAt)
      .run();
    await audit(
      user,
      "story_shared",
      useAI
        ? "Provider summary requested explicitly."
        : "Local summary; no content sent to AI provider.",
    );
    return json({ story });
  } catch (e) {
    return failure(e);
  }
}
