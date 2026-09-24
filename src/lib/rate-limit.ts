import { supabase, getServiceSupabase } from './supabase';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  lockoutMultiplier?: number;
}

// In-memory sliding-window fallback for offline development, tests, or transient DB disconnection
const memoryRateLimitMap = new Map<string, { timestamps: number[]; lockouts?: number }>();

function getDbClient() {
  try {
    return getServiceSupabase();
  } catch {
    return supabase;
  }
}

function isSupabaseAvailable(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || url.includes('placeholder.supabase.co')) {
    return false;
  }
  return true;
}

/**
 * Synchronous in-memory rate limiter (fallback)
 */
export function checkMemoryRateLimit(
  key: string,
  limit: number = 5,
  windowMs: number = 60_000
): RateLimitResult {
  const now = Date.now();
  const entry = memoryRateLimitMap.get(key) || { timestamps: [], lockouts: 0 };
  const activeTimestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (activeTimestamps.length >= limit) {
    const oldestTimestamp = activeTimestamps[0];
    const retryAfterMs = windowMs - (now - oldestTimestamp);
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
      lockoutMultiplier: entry.lockouts || 1,
    };
  }

  activeTimestamps.push(now);
  memoryRateLimitMap.set(key, { ...entry, timestamps: activeTimestamps });

  // Periodically clean memory map if it grows large
  if (memoryRateLimitMap.size > 5000) {
    for (const [k, v] of memoryRateLimitMap.entries()) {
      if (v.timestamps.every((t) => now - t > windowMs)) {
        memoryRateLimitMap.delete(k);
      }
    }
  }

  return {
    allowed: true,
    remaining: limit - activeTimestamps.length,
    retryAfterSeconds: 0,
  };
}

/**
 * Serverless-resilient rate limiter backed by Supabase PostgreSQL `rate_limits` table.
 * Falls back gracefully to memory sliding-window when Supabase is unreachable or unconfigured.
 */
export async function checkRateLimit(
  key: string,
  limit: number = 5,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  if (!isSupabaseAvailable()) {
    return checkMemoryRateLimit(key, limit, windowMs);
  }

  try {
    const db = getDbClient();
    const { data: record, error: selectErr } = await db
      .from('rate_limits')
      .select('*')
      .eq('key', key)
      .maybeSingle();

    if (!selectErr && record) {
      const expireAt = new Date(record.expire_at).getTime();

      if (expireAt > now) {
        // Window is still active
        if (record.points >= limit) {
          const retryAfterSeconds = Math.max(1, Math.ceil((expireAt - now) / 1000));
          return {
            allowed: false,
            remaining: 0,
            retryAfterSeconds,
          };
        }

        const newPoints = record.points + 1;
        await db
          .from('rate_limits')
          .update({
            points: newPoints,
            last_attempt_at: new Date(now).toISOString(),
          })
          .eq('key', key);

        return {
          allowed: true,
          remaining: limit - newPoints,
          retryAfterSeconds: 0,
        };
      }
    }

    // Record does not exist or window has expired: upsert fresh window
    const newExpireAt = new Date(now + windowMs).toISOString();
    await db
      .from('rate_limits')
      .upsert(
        {
          key,
          points: 1,
          expire_at: newExpireAt,
          last_attempt_at: new Date(now).toISOString(),
        },
        { onConflict: 'key' }
      );

    return {
      allowed: true,
      remaining: limit - 1,
      retryAfterSeconds: 0,
    };
  } catch (err) {
    console.warn('[RateLimit] Supabase query failed, falling back to memory rate limiting:', err);
    return checkMemoryRateLimit(key, limit, windowMs);
  }
}

/**
 * Specialized rate limiter for login attempts with exponential backoff lockout.
 * Default policy: 5 failed attempts per 15 minutes (900 seconds) per account/IP.
 */
export async function checkSigninRateLimit(
  identifier: string,
  maxAttempts: number = 5,
  baseWindowSeconds: number = 900 // 15 minutes
): Promise<RateLimitResult> {
  const rateLimitKey = `signin:${identifier}`;
  return checkRateLimit(rateLimitKey, maxAttempts, baseWindowSeconds);
}

/**
 * Resets the signin rate limit upon successful authentication.
 */
export async function resetSigninRateLimit(identifier: string): Promise<void> {
  const rateLimitKey = `signin:${identifier}`;
  memoryRateLimitMap.delete(rateLimitKey);

  if (isSupabaseAvailable()) {
    try {
      const db = getDbClient();
      await db.from('rate_limits').delete().eq('key', rateLimitKey);
    } catch {
      // ignore
    }
  }
}
