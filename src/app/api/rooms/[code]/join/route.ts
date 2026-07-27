import { NextResponse } from "next/server";
import { errorResponse, setPlayerCookie, validOrigin } from "@/lib/server/http";
import { joinRoom, snapshot } from "@/lib/server/rooms";
import { rateLimit } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  if (!validOrigin(request)) return errorResponse(new Error("Origin not allowed"), 403);
  try {
    const code = (await context.params).code.toUpperCase();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
    await rateLimit(`join:${ip}`, 24, 60);
    const body = await request.json();
    const joined = await joinRoom(code, body.name, body.avatar);
    const response = NextResponse.json({ snapshot: snapshot(joined.room, joined.playerId) }, { status: 201 });
    setPlayerCookie(response, code, joined.token);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
