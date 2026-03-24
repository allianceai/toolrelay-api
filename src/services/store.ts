/**
 * In-memory store with optional Redis backing.
 * Provides key-value operations used by the API key, tool registry, and usage services.
 */

// --- In-memory fallback ---
const memStore = new Map<string, string>();

let redisClient: { get: (k: string) => Promise<string | null>; set: (k: string, v: string, opts?: Record<string, unknown>) => Promise<unknown>; del: (k: string) => Promise<unknown>; keys: (pattern: string) => Promise<string[]> } | null = null;

export async function initRedis(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return;
  try {
    // Dynamically require redis so the app starts without it
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createClient } = require('redis');
    const client = createClient({ url: redisUrl });
    await client.connect();
    redisClient = client;
    console.log('✅ Redis connected');
  } catch (err) {
    console.warn('⚠️  Redis unavailable, using in-memory store:', (err as Error).message);
  }
}

export async function storeGet(key: string): Promise<string | null> {
  if (redisClient) return redisClient.get(key);
  return memStore.get(key) ?? null;
}

export async function storeSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (redisClient) {
    await redisClient.set(key, value, ttlSeconds ? { EX: ttlSeconds } : undefined);
  } else {
    memStore.set(key, value);
  }
}

export async function storeDel(key: string): Promise<void> {
  if (redisClient) {
    await redisClient.del(key);
  } else {
    memStore.delete(key);
  }
}

export async function storeKeys(pattern: string): Promise<string[]> {
  if (redisClient) {
    return redisClient.keys(pattern);
  }
  // Simple glob-style matching for in-memory
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
  return [...memStore.keys()].filter((k) => regex.test(k));
}
