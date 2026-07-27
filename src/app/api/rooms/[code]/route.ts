import { errorResponse, roomToken } from "@/lib/server/http";
import { authenticate, snapshot } from "@/lib/server/rooms";
import { loadRoom } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const code = (await context.params).code.toUpperCase();
    const token = await roomToken(code);
    const authenticated = await authenticate(code, token);
    const room = authenticated?.room ?? await loadRoom(code);
    if (!room) throw new Error("Room not found");
    return Response.json({ snapshot: snapshot(room, authenticated?.player.id ?? null) }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
