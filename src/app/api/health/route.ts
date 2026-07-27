import { redisClient } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const redis = await redisClient();
    if (!redis && process.env.NODE_ENV === "production") {
      return Response.json({ ok: false, store: "unavailable" }, { status: 503 });
    }
    if (redis) {
      await redis.ping();
    }
    return Response.json({ ok: true, store: redis ? "redis" : "local-development" });
  } catch {
    return Response.json({ ok: false, store: "unavailable" }, { status: 503 });
  }
}
