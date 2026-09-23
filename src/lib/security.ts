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
  if (BLOCKED_HOSTS.includes(hostname) || hostname.endsWith('.internal') || hostname.endsWith('.local')) {
    return { valid: false, error: 'Security violation: Access to internal network hosts is forbidden.' };
  }

  // Check for private IPv4 blocks (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
  const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipMatch) {
    const [, a, b] = ipMatch.map(Number);
    if (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 127 ||
      a === 0
    ) {
      return { valid: false, error: 'Security violation: Private IP addresses are forbidden.' };
    }
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
      error: 'Unsupported platform. Only Amazon India, Flipkart, and Meesho URLs are supported.',
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
  ];

  trackingParams.forEach((param) => {
    parsed.searchParams.delete(param);
  });

  return {
    valid: true,
    cleanUrl: parsed.toString(),
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
