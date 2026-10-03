import { getChatGPTUser } from "../app/chatgpt-auth";
import { sameOrigin } from "./security";
export async function owner(request: Request) {
  if (!sameOrigin(request)) throw new Error("Cross-origin request rejected.");
  const user = await getChatGPTUser();
  if (!user) throw new Error("Sign in to continue.");
  return user.userId;
}
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function failure(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Request failed. Please try again.";
  const known =
    /Sign in|Cross-origin|too large|Refresh|Conversation changed|not found|Invalid|required|Choose|not connected|approved|disabled|Unsupported|Delete|confirmation|Provider|AI |No active|Demo |Storage unavailable|Rate limit|wait a minute/i.test(
      message,
    );
  return json(
    {
      error: known
        ? message
        : "Unable to save right now. Your input is preserved; please try again.",
    },
    /Sign in/.test(message)
      ? 401
      : /Cross-origin/.test(message)
        ? 403
        : /Rate limit|wait a minute/.test(message)
          ? 429
          : 400,
  );
}
