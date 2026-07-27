import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export function playerCookie(code: string): string {
  return `booth_${code.toUpperCase()}`;
}

export async function roomToken(code: string): Promise<string | undefined> {
  return (await cookies()).get(playerCookie(code))?.value;
}

export function setPlayerCookie(response: NextResponse, code: string, token: string): void {
  response.cookies.set(playerCookie(code), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export function errorResponse(error: unknown, status = 400): NextResponse {
  const message = error instanceof Error ? error.message : "Something went wrong";
  const safeStatus = /not found|expired/i.test(message) ? 404 : /authorized/i.test(message) ? 401 : status;
  return NextResponse.json({ error: message }, { status: safeStatus });
}

export function validOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const expected = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
  return origin === expected || origin === new URL(request.url).origin;
}
