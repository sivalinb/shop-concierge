import { owner, json, failure } from "../../../lib/http";
import { state } from "../../../lib/store";
export async function GET(request: Request) {
  try {
    return json(await state(await owner(request)));
  } catch (e) {
    return failure(e);
  }
}
