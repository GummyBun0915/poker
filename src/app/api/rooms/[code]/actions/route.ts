import { errorResponse, roomToken, validOrigin } from "@/lib/server/http";
import { authenticate, commandRoom, snapshot, type RoomCommand } from "@/lib/server/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  if (!validOrigin(request)) return errorResponse(new Error("Origin not allowed"), 403);
  try {
    const code = (await context.params).code.toUpperCase();
    const token = await roomToken(code);
    const auth = await authenticate(code, token);
    if (!token || !auth) throw new Error("Not authorized for this table");
    const body = await request.json() as { commandId?: string; expectedVersion?: number; command?: RoomCommand };
    if (!body.commandId || !body.command || !body.expectedVersion) throw new Error("A versioned command is required");
    const room = await commandRoom(code, token, body.commandId, body.expectedVersion, body.command);
    return Response.json({ snapshot: snapshot(room, auth.player.id) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
