import { errorResponse, roomToken, validOrigin } from "@/lib/server/http";
import { advanceRoom, authenticate, snapshot } from "@/lib/server/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  if (!validOrigin(request)) return errorResponse(new Error("Origin not allowed"), 403);
  try {
    const code = (await context.params).code.toUpperCase();
    const token = await roomToken(code);
    const auth = await authenticate(code, token);
    if (!auth) throw new Error("Not authorized for this table");
    const body = await request.json().catch(() => ({})) as { expectedVersion?: number };
    if (!body.expectedVersion) throw new Error("A state version is required");
    const room = await advanceRoom(code, body.expectedVersion);
    return Response.json({ snapshot: snapshot(room, auth.player.id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
