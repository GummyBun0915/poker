import { experimental_upgradeWebSocket } from "@vercel/functions";
import type { RawData } from "ws";
import { validOrigin } from "@/lib/server/http";
import { authenticate, commandRoom, snapshot, type RoomCommand } from "@/lib/server/rooms";
import { subscribeRoom, touchRoom } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function cookieValue(header: string | null, name: string): string | undefined {
  return header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

export async function GET(request: Request) {
  if (!validOrigin(request)) return new Response("Origin not allowed", { status: 403 });
  const code = new URL(request.url).searchParams.get("code")?.toUpperCase();
  if (!code) return new Response("Room code required", { status: 400 });
  const token = cookieValue(request.headers.get("cookie"), `booth_${code}`);
  const auth = await authenticate(code, token);
  if (!auth || !token) return new Response("Unauthorized", { status: 401 });

  return experimental_upgradeWebSocket(async (ws) => {
    let closed = false;
    const sendState = async () => {
      if (closed || ws.readyState !== ws.OPEN) return;
      const current = await authenticate(code, token);
      if (!current) return ws.close(4001, "Seat unavailable");
      ws.send(JSON.stringify({ type: "snapshot", snapshot: snapshot(current.room, current.player.id) }));
    };
    const unsubscribe = await subscribeRoom(code, () => { void sendState(); });
    await touchRoom(code);
    await sendState();

    ws.on("message", async (raw: RawData) => {
      try {
        const message = JSON.parse(raw.toString()) as { type?: string; commandId?: string; expectedVersion?: number; command?: RoomCommand };
        if (message.type === "ping") {
          await touchRoom(code);
          ws.send(JSON.stringify({ type: "pong", at: Date.now() }));
        } else if (message.type === "command" && message.commandId && message.expectedVersion && message.command) {
          const room = await commandRoom(code, token, message.commandId, message.expectedVersion, message.command);
          ws.send(JSON.stringify({ type: "ack", commandId: message.commandId, version: room.version }));
        }
      } catch (error) {
        ws.send(JSON.stringify({ type: "error", message: error instanceof Error ? error.message : "Invalid message" }));
      }
    });
    ws.on("close", () => {
      closed = true;
      void unsubscribe();
    });
    ws.on("error", () => {
      closed = true;
      void unsubscribe();
    });
  }, { maxPayload: 16_384 });
}
