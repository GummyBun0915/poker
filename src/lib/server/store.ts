import "server-only";
import { EventEmitter } from "node:events";
import { createClient, type RedisClientType } from "redis";
import type { RoomState } from "../poker/types";

const TTL_SECONDS = 30 * 60;
const CAS_SCRIPT = `
local current = redis.call('GET', KEYS[2])
if not current then return -1 end
if tonumber(current) ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[4])
redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[4])
redis.call('PUBLISH', KEYS[3], ARGV[3])
return 1
`;
const CREATE_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3])
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
return 1
`;

type LocalStore = { rooms: Map<string, RoomState>; events: EventEmitter; limits: Map<string, { count: number; expires: number }> };
declare global {
  var __boothRedis: RedisClientType | undefined;
  var __boothLocal: LocalStore | undefined;
}

function keys(code: string) {
  const room = `booth:room:${code}`;
  return { room, version: `${room}:version`, channel: `${room}:updates` };
}

function localStore(): LocalStore {
  if (process.env.NODE_ENV === "production") throw new Error("REDIS_URL is required in production");
  return globalThis.__boothLocal ??= { rooms: new Map(), events: new EventEmitter(), limits: new Map() };
}

export async function redisClient(): Promise<RedisClientType | null> {
  if (!process.env.REDIS_URL) return null;
  const client = globalThis.__boothRedis ??= createClient({ url: process.env.REDIS_URL });
  if (!client.isOpen) await client.connect();
  return client;
}

export async function createStoredRoom(room: RoomState): Promise<boolean> {
  const redis = await redisClient();
  if (!redis) {
    const local = localStore();
    if (local.rooms.has(room.code)) return false;
    local.rooms.set(room.code, structuredClone(room));
    return true;
  }
  const key = keys(room.code);
  const result = await redis.eval(CREATE_SCRIPT, {
    keys: [key.room, key.version],
    arguments: [JSON.stringify(room), String(room.version), String(TTL_SECONDS)],
  });
  return Number(result) === 1;
}

export async function loadRoom(code: string): Promise<RoomState | null> {
  const redis = await redisClient();
  if (!redis) return structuredClone(localStore().rooms.get(code) ?? null);
  const raw = await redis.get(keys(code).room);
  return raw ? JSON.parse(raw) as RoomState : null;
}

export async function mutateRoom(code: string, mutate: (room: RoomState) => RoomState | null | void): Promise<RoomState> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const current = await loadRoom(code);
    if (!current) throw new Error("Room not found");
    const expected = current.version;
    const draft = structuredClone(current);
    const mutationResult = mutate(draft);
    if (mutationResult === null) return current;
    const next = mutationResult ?? draft;
    next.version = expected + 1;
    next.updatedAt = Date.now();

    const redis = await redisClient();
    if (!redis) {
      const local = localStore();
      const latest = local.rooms.get(code);
      if (!latest || latest.version !== expected) continue;
      local.rooms.set(code, structuredClone(next));
      local.events.emit(code, next.version);
      return next;
    }

    const key = keys(code);
    const casResult = await redis.eval(CAS_SCRIPT, {
      keys: [key.room, key.version, key.channel],
      arguments: [String(expected), JSON.stringify(next), String(next.version), String(TTL_SECONDS)],
    });
    if (Number(casResult) === 1) return next;
    if (Number(casResult) === -1) throw new Error("Room expired");
  }
  throw new Error("The table changed; try again");
}

export async function touchRoom(code: string): Promise<void> {
  const redis = await redisClient();
  if (!redis) return;
  const key = keys(code);
  await Promise.all([redis.expire(key.room, TTL_SECONDS), redis.expire(key.version, TTL_SECONDS)]);
}

export async function subscribeRoom(code: string, onVersion: (version: number) => void): Promise<() => Promise<void>> {
  const redis = await redisClient();
  if (!redis) {
    const local = localStore();
    const listener = (version: number) => onVersion(version);
    local.events.on(code, listener);
    return async () => { local.events.off(code, listener); };
  }
  const subscriber = redis.duplicate();
  await subscriber.connect();
  await subscriber.subscribe(keys(code).channel, (message) => onVersion(Number(message)));
  return async () => {
    if (subscriber.isOpen) {
      await subscriber.unsubscribe(keys(code).channel);
      await subscriber.quit();
    }
  };
}

export async function rateLimit(scope: string, limit: number, windowSeconds: number): Promise<void> {
  const redis = await redisClient();
  const key = `booth:limit:${scope}`;
  if (!redis) {
    const local = localStore();
    const now = Date.now();
    const current = local.limits.get(key);
    const next = !current || current.expires <= now ? { count: 1, expires: now + windowSeconds * 1000 } : { ...current, count: current.count + 1 };
    local.limits.set(key, next);
    if (next.count > limit) throw new Error("Too many requests; slow down");
    return;
  }
  const result = await redis.eval(`
    local value = redis.call('INCR', KEYS[1])
    if value == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
    return value
  `, { keys: [key], arguments: [String(windowSeconds)] });
  if (Number(result) > limit) throw new Error("Too many requests; slow down");
}
