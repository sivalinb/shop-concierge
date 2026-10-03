import { env } from "cloudflare:workers";
import { owner, failure } from "../../../../lib/http";
import { db } from "../../../../lib/store";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await owner(request);
    const { id } = await params;
    const row = await db()
      .prepare("SELECT data FROM stories WHERE owner=? AND id=?")
      .bind(user, id)
      .first<{ data: string }>();
    if (!row) throw new Error("Story not found.");
    const story = JSON.parse(row.data);
    if (!story.key) throw new Error("Media not found.");
    const media = await env.BUCKET?.get(story.key);
    if (!media) throw new Error("Media not found.");
    return new Response(media.body, {
      headers: {
        "Content-Type": story.mediaType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
