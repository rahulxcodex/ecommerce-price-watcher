import { DiscoveryResult, Platform } from '@/types';
import { parsePrice } from '../utils';

/**
 * Normalizes and sanitizes search queries to prevent injection and malformed requests.
 */
export function sanitizeSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') return '';
  return query
    .replace(/[<>{}[\]\\\/]/g, ' ') // Remove dangerous chars
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150); // Bound length to prevent buffer bloat
}

/**
 * Computes discount percentage given current price and original/MRP price.
 */
export function calculateDiscount(price: number, originalPrice?: number): number {
  if (!originalPrice || originalPrice <= price || originalPrice <= 0) return 0;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

/**
 * Cleans text from raw HTML snippets.
 */
export function cleanText(raw?: string): string {
  if (!raw) return '';
  return raw
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deterministic ID generator for discovered products based on platform and product URL.
 */
export function generateDiscoveryId(platform: Platform, url: string): string {
  let hash = 0;
  const str = `${platform}:${url}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `disc_${platform}_${Math.abs(hash).toString(36)}`;
}
