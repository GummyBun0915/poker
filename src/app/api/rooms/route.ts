import { NextResponse } from "next/server";
import { createRoom, snapshot } from "@/lib/server/rooms";
import { errorResponse, setPlayerCookie, validOrigin } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!validOrigin(request)) return errorResponse(new Error("Origin not allowed"), 403);
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
    await rateLimit(`create:${ip}`, 12, 60);
    const body = await request.json();
    const created = await createRoom(body.name, body.avatar, body.settings);
    const response = NextResponse.json({
      snapshot: snapshot(created.room, created.playerId),
      joinUrl: `${process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin}/r/${created.room.code}`,
    }, { status: 201 });
    setPlayerCookie(response, created.room.code, created.token);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
