import * as cheerio from 'cheerio';
import { parsePrice, getDefaultHeaders } from './utils';

export interface ExtractedProductData {
  title?: string;
  price?: number;
  imageUrl?: string;
  currency?: string;
  isOutOfStock?: boolean;
}

/**
 * Tier 1: Schema.org / JSON-LD extraction.
 * Google Shopping & SEO standard across all e-commerce engines.
 * Highly immune to DOM/CSS refactoring.
 */
export function extractJsonLdProduct($: cheerio.CheerioAPI): ExtractedProductData | null {
  let result: ExtractedProductData | null = null;

  $('script[type="application/ld+json"]').each((_, elem) => {
    if (result && result.price && result.title) return; // already satisfied
    try {
      const text = $(elem).html();
      if (!text) return;
      const data = JSON.parse(text);

      const items = Array.isArray(data)
        ? data
        : data['@graph'] && Array.isArray(data['@graph'])
        ? data['@graph']
        : [data];

      for (const item of items) {
        if (!item) continue;
        const isProduct =
          item['@type'] === 'Product' ||
          (Array.isArray(item['@type']) && item['@type'].includes('Product'));

        if (isProduct) {
          let price: number | null = null;
          let currency = 'INR';
          let isOutOfStock = false;

          if (item.offers) {
            const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
            if (offer) {
              const rawPrice = offer.price ?? offer.lowPrice ?? offer.highPrice;
              if (rawPrice !== undefined && rawPrice !== null) {
                price = typeof rawPrice === 'number' ? rawPrice : parsePrice(String(rawPrice));
              }
              if (offer.priceCurrency) {
                currency = String(offer.priceCurrency);
              }
              if (offer.availability) {
                const avail = String(offer.availability).toLowerCase();
                if (avail.includes('outofstock')) {
                  isOutOfStock = true;
                }
              }
            }
          }

          let imageUrl: string | undefined;
          if (item.image) {
            if (typeof item.image === 'string') {
              imageUrl = item.image;
            } else if (Array.isArray(item.image) && item.image.length > 0) {
              imageUrl = typeof item.image[0] === 'string' ? item.image[0] : item.image[0]?.url;
            } else if (typeof item.image === 'object' && item.image.url) {
              imageUrl = item.image.url;
            }
          }

          const title = item.name ? String(item.name).trim() : undefined;

          if (price !== null || title) {
            result = {
              title,
              price: price ?? undefined,
              imageUrl,
              currency,
              isOutOfStock,
            };
            return;
          }
        }
      }
    } catch {
      // Ignore individual JSON-LD parsing errors
    }
  });

  return result;
}

/**
 * Tier 2: OpenGraph, Dublin Core & Twitter Cards meta tags.
 * Required for social sharing cards and universally stable across UI redesigns.
 */
export function extractMetaTags($: cheerio.CheerioAPI): ExtractedProductData {
  let price: number | null = null;

  const priceMetaAttrs = [
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
    'meta[property="price"]',
    'meta[name="twitter:data1"]',
    'meta[name="product:price"]',
  ];

  for (const sel of priceMetaAttrs) {
    const val = $(sel).attr('content');
    if (val) {
      const parsed = parsePrice(val);
      if (parsed && parsed > 0) {
        price = parsed;
        break;
      }
    }
  }

  const title =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('meta[name="twitter:title"]').attr('content')?.trim() ||
    $('meta[name="title"]').attr('content')?.trim() ||
    $('title').text().trim() ||
    undefined;

  const imageUrl =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    undefined;

  return {
    title,
    price: price ?? undefined,
    imageUrl,
    currency: 'INR',
  };
}

/**
 * Tier 4: Fallback DOM selector scan with currency symbol heuristics.
 */
export function extractSelectorPrice($: cheerio.CheerioAPI, selectors: string[]): number | null {
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length > 0) {
      const text = el.text().trim();
      const parsed = parsePrice(text);
      if (parsed && parsed > 0) {
        return parsed;
      }
    }
  }
  return null;
}

/**
 * Resilient HTTP fetcher with AbortSignal timeout and robust desktop headers.
 */
export async function resilientFetch(url: string, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: getDefaultHeaders(),
      redirect: 'follow',
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}
