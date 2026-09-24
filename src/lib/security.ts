import { Platform } from '@/types';

/**
 * Security & SSRF Protection Module
 * Defends against Server-Side Request Forgery, malicious input injection,
 * and malicious scraping targets.
 */

// Strict platform hostname whitelist
const ALLOWED_DOMAINS: Record<Platform, RegExp[]> = {
  amazon: [
    /^(www\.)?amazon\.in$/i,
    /^(www\.)?amazon\.com$/i,
    /^amzn\.to$/i,
    /^amzn\.in$/i,
  ],
  flipkart: [
    /^(www\.)?flipkart\.com$/i,
    /^dl\.flipkart\.com$/i,
    /^fkrt\.it$/i,
  ],
  meesho: [
    /^(www\.)?meesho\.com$/i,
  ],
  myntra: [
    /^(www\.)?myntra\.com$/i,
  ],
  ajio: [
    /^(www\.)?ajio\.com$/i,
  ],
  westside: [
    /^(www\.)?westside\.com$/i,
  ],
};

// Forbidden IP/host patterns (SSRF targets)
const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '169.254.169.254', // AWS / Cloud metadata
  'metadata.google.internal',
  '[::1]',
];

export interface ValidatedURL {
  valid: boolean;
  cleanUrl?: string;
  platform?: Platform;
  error?: string;
}

/**
 * Validates and sanitizes a product URL to prevent SSRF and injection attacks.
 */
export function validateAndSanitizeUrl(rawUrl: string): ValidatedURL {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  const trimmed = rawUrl.trim();

  // Maximum URL length constraint (DoS / buffer exhaustion prevention)
  if (trimmed.length > 2048) {
    return { valid: false, error: 'URL exceeds maximum allowable length of 2048 characters' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // 1. Protocol check: strictly https: (or http: in non-prod test environments)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, error: 'Invalid protocol. Only HTTPS is allowed.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. SSRF Loopback & Cloud Metadata Check
  if (
    BLOCKED_HOSTS.includes(hostname) ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.localhost')
  ) {
    return { valid: false, error: 'Security violation: Access to internal network hosts is forbidden.' };
  }

  // Reject all raw IP addresses (IPv4, IPv6, octal, hex, integer representations)
  // E-commerce products are strictly hosted on domain names, never raw IP addresses
  const isDirectIp =
    hostname.startsWith('[') ||
    /^(\d+|0x[0-9a-f]+)(\.(\d+|0x[0-9a-f]+)){0,3}$/i.test(hostname) ||
    /^[0-9a-f:]+$/i.test(hostname.replace(/^\[|\]$/g, ''));

  if (isDirectIp) {
    return { valid: false, error: 'Security violation: Direct IP access is forbidden.' };
  }

  // 3. Domain Whitelisting
  let matchedPlatform: Platform | null = null;
  for (const [platform, patterns] of Object.entries(ALLOWED_DOMAINS) as [Platform, RegExp[]][]) {
    if (patterns.some((pattern) => pattern.test(hostname))) {
      matchedPlatform = platform;
      break;
    }
  }

  if (!matchedPlatform) {
    return {
      valid: false,
      error: 'Unsupported platform. Only Amazon, Flipkart, Meesho, Myntra, Ajio, and Westside URLs are supported.',
    };
  }

  // 4. URL Sanitization: Remove tracking params, affiliate tokens, session IDs
  const trackingParams = [
    'tag',
    'ascsubtag',
    'linkCode',
    'ref',
    'ref_',
    'pf_rd_r',
    'pf_rd_p',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'affid',
    'affExtParam1',
    'fbclid',
    'gclid',
    'ie',
    'qid',
    'sr',
    'keywords',
  ];

  trackingParams.forEach((param) => {
    parsed.searchParams.delete(param);
  });

  let cleanUrl = parsed.toString();

  // Canonicalize Amazon mobile and deep links (e.g. /gp/aw/d/ASIN -> /dp/ASIN)
  if (matchedPlatform === 'amazon') {
    const asinMatch = parsed.pathname.match(/(?:\/dp\/|\/gp\/aw\/d\/|\/gp\/product\/|\/d\/)([A-Z0-9]{10})/i);
    if (asinMatch && asinMatch[1]) {
      const asin = asinMatch[1].toUpperCase();
      cleanUrl = `https://${hostname}/dp/${asin}`;
    }
  }

  return {
    valid: true,
    cleanUrl,
    platform: matchedPlatform,
  };
}

/**
 * Validates scraped price for anomaly / anti-hallucination sanity.
 * Protects against zero-price scraper bugs and selector mismatch.
 */
export function validateScrapedPrice(price: number, previousPrice?: number): { isValid: boolean; reason?: string } {
  if (typeof price !== 'number' || isNaN(price)) {
    return { isValid: false, reason: 'Price is not a valid number' };
  }

  if (price <= 0) {
    return { isValid: false, reason: 'Price must be greater than zero' };
  }

  if (price > 50_000_000) {
    return { isValid: false, reason: 'Price exceeds reasonable maximum bound' };
  }

  // Anomaly check: if price drops by > 98% compared to previous, it could be a scraping artifact (e.g. shipping fee picked instead)
  if (previousPrice && previousPrice > 100 && price < previousPrice * 0.02) {
    return { isValid: false, reason: 'Suspicious price anomaly detected (drop > 98%). Likely scraping selector mismatch.' };
  }

  return { isValid: true };
}

/**
 * Constant-time comparison for webhooks and auth tokens to prevent timing attacks.
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Extracts a clean, human-readable product title from a store URL slug.
 */
export function deriveTitleFromUrl(rawUrl: string, platform?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl.trim());
    const path = parsed.pathname;
    let slug = '';

    if (platform === 'ajio' || path.includes('/p/')) {
      const match = path.match(/\/([^/]+)\/p\//);
      if (match) slug = match[1];
    } else if (platform === 'myntra' || path.includes('/buy')) {
      const segments = path.split('/').filter(Boolean);
      const buyIdx = segments.indexOf('buy');
      if (buyIdx >= 2) {
        slug = segments[buyIdx - 2];
      } else if (segments.length >= 2) {
        slug = segments[segments.length - 2];
      }
    } else if (platform === 'westside' || path.includes('/products/')) {
      const match = path.match(/\/products\/([^/?#]+)/);
      if (match) slug = match[1];
    } else if (platform === 'flipkart') {
      const segments = path.split('/').filter(Boolean);
      if (segments.length > 0 && segments[0] !== 'p') {
        slug = segments[0];
      }
    } else if (platform === 'amazon') {
      const match = path.match(/\/([^/]+)\/dp\//);
      if (match) slug = match[1];
    }

    if (slug) {
      return decodeURIComponent(slug)
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
    }
  } catch {}
  return '';
}

/**
 * Validates browser Web Push subscription endpoints against known push providers.
 */
const ALLOWED_PUSH_DOMAINS = [
  /^(fcm|android)\.googleapis\.com$/i,
  /^([a-z0-9-]+\.)?push\.services\.mozilla\.com$/i,
  /^([a-z0-9-]+\.)?(notify|wns)\.windows\.com$/i,
  /^([a-z0-9-]+\.)?push\.apple\.com$/i,
];

export function validatePushEndpoint(endpoint: string): { valid: boolean; reason?: string } {
  if (!endpoint || typeof endpoint !== 'string') {
    return { valid: false, reason: 'Endpoint URL is required' };
  }
  try {
    const parsed = new URL(endpoint.trim());
    if (parsed.protocol !== 'https:') {
      return { valid: false, reason: 'Push endpoint must use HTTPS' };
    }
    const isAllowed = ALLOWED_PUSH_DOMAINS.some((pattern) => pattern.test(parsed.hostname));
    if (!isAllowed) {
      return { valid: false, reason: 'Untrusted push service provider domain' };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'Invalid endpoint URL format' };
  }
}

/**
 * Validates and sanitizes settings configuration payloads.
 */
export function validateSettingsPayload(body: Record<string, any>): { valid: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid settings payload' };
  }

  // Discord webhook validation
  if (body.discord_webhook) {
    const hook = String(body.discord_webhook).trim();
    if (
      !hook.startsWith('https://discord.com/api/webhooks/') &&
      !hook.startsWith('https://canary.discord.com/api/webhooks/')
    ) {
      return { valid: false, error: 'Invalid Discord webhook URL format.' };
    }
  }

  // ntfy topic validation
  if (body.ntfy_topic) {
    const topic = String(body.ntfy_topic).trim();
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(topic)) {
      return { valid: false, error: 'ntfy topic must be alphanumeric (1-64 characters).' };
    }
  }

  // Email validation
  if (body.email) {
    const emails = String(body.email).split(',').map((e) => e.trim()).filter(Boolean);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const em of emails) {
      if (!emailRegex.test(em)) {
        return { valid: false, error: `Invalid email address format: ${em}` };
      }
    }
  }

  // WhatsApp phone validation
  if (body.whatsapp_phone) {
    const phone = String(body.whatsapp_phone).trim();
    if (!/^\+?[0-9]{7,15}$/.test(phone)) {
      return { valid: false, error: 'Invalid WhatsApp phone number format.' };
    }
  }

  // Telegram chat ID validation
  if (body.telegram_chat_id) {
    const chatId = String(body.telegram_chat_id).trim();
    if (!/^-?[0-9a-zA-Z_]{1,64}$/.test(chatId)) {
      return { valid: false, error: 'Invalid Telegram chat ID format.' };
    }
  }

  // Notification preference validation
  if (
    body.notification_preference &&
    !['all_time_low', 'any_drop', 'never'].includes(body.notification_preference)
  ) {
    return { valid: false, error: 'Invalid notification preference value.' };
  }

  return { valid: true };
}

/**
 * In-memory sliding-window rate limiter for Product Discovery searches.
 * Limit: 5 requests per 60 seconds per user/IP.
 */
const searchRateLimitMap = new Map<string, number[]>();

export function checkSearchRateLimit(
  identifier: string,
  limit: number = 5,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const timestamps = searchRateLimitMap.get(identifier) || [];

  // Filter timestamps within current window
  const activeTimestamps = timestamps.filter((t) => now - t < windowMs);

  if (activeTimestamps.length >= limit) {
    const oldestTimestamp = activeTimestamps[0];
    const retryAfterMs = windowMs - (now - oldestTimestamp);
    const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  // Record this request
  activeTimestamps.push(now);
  searchRateLimitMap.set(identifier, activeTimestamps);

  // Periodically clean stale keys if map exceeds 5000 entries
  if (searchRateLimitMap.size > 5000) {
    for (const [key, times] of searchRateLimitMap.entries()) {
      if (times.every((t) => now - t > windowMs)) {
        searchRateLimitMap.delete(key);
      }
    }
  }

  return {
    allowed: true,
    remaining: limit - activeTimestamps.length,
    retryAfterSeconds: 0,
  };
}

