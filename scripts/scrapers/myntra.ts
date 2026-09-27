import * as cheerio from 'cheerio';
import { parsePrice, isPlaywrightAvailable, getMobileHeaders, withSharedBrowserPage } from './utils';
import { ScrapeResult } from '../../src/types';
import {
  extractJsonLdProduct,
  extractMetaTags,
  extractSelectorPrice,
  resilientFetch,
} from './resilient-extractor';

export function extractMyntraStyleId(url: string): string | null {
  try {
    const match = url.match(/\/(\d{5,})(?:\/buy|\?|$|\/)/) || url.match(/\/(\d{5,})/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function extractFromMyntraHtml(html: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  // Check Tier 1: Schema.org / JSON-LD (Google Shopping standard)
  let jsonPrice: number | null = null;
  let jsonTitle: string | null = null;
  let jsonImg: string | undefined = undefined;
  let isOutOfStock = false;

  $('script[type="application/ld+json"]').each((_, elem) => {
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
          if (item.name) jsonTitle = String(item.name).trim();
          if (item.image) {
            if (typeof item.image === 'string') {
              jsonImg = item.image;
            } else if (Array.isArray(item.image) && item.image.length > 0) {
              jsonImg = typeof item.image[0] === 'string' ? item.image[0] : item.image[0]?.url;
            }
          }

          if (item.offers) {
            const list = Array.isArray(item.offers) ? item.offers : [item.offers];
            for (const off of list) {
              const p = off.price ?? off.lowPrice ?? off.highPrice;
              const parsed = typeof p === 'number' ? p : parsePrice(String(p || ''));
              const avail = String(off.availability || '').toLowerCase();
              if (avail.includes('outofstock')) {
                isOutOfStock = true;
              }
              if (parsed && parsed > 0 && !jsonPrice) {
                jsonPrice = parsed;
              }
            }
          }
        }
      }
    } catch {}
  });

  if (jsonPrice && jsonPrice > 0) {
    return {
      success: true,
      title: jsonTitle || 'Myntra Product',
      price: jsonPrice,
      imageUrl: jsonImg,
      currency: 'INR',
      isOutOfStock,
    };
  }

  // Check Tier 2: Full-document regex on window.__myx.pdpData
  const priceObjMatch =
    html.match(/"price"\s*:\s*\{[^}]*"discounted"\s*:\s*(\d+)/i) ||
    html.match(/"price"\s*:\s*\{[^}]*"mrp"\s*:\s*(\d+)/i);
  const discMatch =
    html.match(/"discountedPrice"\s*:\s*(\d+)/i) ||
    html.match(/"discounted"\s*:\s*(\d+)/i);
  const mrpMatch = html.match(/"mrp"\s*:\s*(\d+)/i);

  const priceVal = priceObjMatch ? priceObjMatch[1] : discMatch ? discMatch[1] : mrpMatch ? mrpMatch[1] : null;
  const nameMatch = html.match(/"name"\s*:\s*"([^"]+)"/i);
  const brandMatch = html.match(/"brand"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i);
  const title = nameMatch
    ? `${brandMatch ? brandMatch[1] + ' ' : ''}${nameMatch[1]}`
    : jsonTitle || 'Myntra Product';

  const rawImgMatch = html.match(/"src"\s*:\s*"([^"]+myntassets[^"]+)"/i);
  const imageUrl = rawImgMatch
    ? rawImgMatch[1].replace(/\\u002F/g, '/').replace(/h_\(\$height\)[^/]+\//, '')
    : jsonImg;

  if (priceVal && Number(priceVal) > 0) {
    return {
      success: true,
      title,
      price: Number(priceVal),
      imageUrl,
      currency: 'INR',
      isOutOfStock,
    };
  }

  // Check Tier 3: Meta description & OpenGraph tags (Myntra embeds "at Rs. <PRICE>")
  const metaDescSources = [
    $('meta[name="description"]').attr('content'),
    $('meta[property="og:description"]').attr('content'),
    $('meta[name="twitter:description"]').attr('content'),
  ];

  for (const desc of metaDescSources) {
    if (!desc) continue;
    const match = desc.match(/(?:at\s*Rs\.?|₹|Rs\.?)\s*([\d,]+(?:\.\d+)?)/i);
    if (match && match[1]) {
      const parsed = parsePrice(match[1]);
      if (parsed && parsed > 0) {
        const ogTitle =
          $('meta[property="og:title"]').attr('content') ||
          $('title').text().replace(/\s*\|.+/i, '').replace(/^Buy\s+/i, '').trim();
        const ogImg = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
        return {
          success: true,
          title: ogTitle || title,
          price: parsed,
          imageUrl: ogImg || imageUrl,
          currency: 'INR',
          isOutOfStock,
        };
      }
    }
  }

  // Check Tier 4: Fallback DOM selectors
  const priceSelectors = [
    'span.pdp-price strong',
    'span.pdp-price',
    'span.pdp-mrp',
    'div.pdp-price-info span.pdp-price',
    '[data-testid="pdp-price"]',
    '.pdp-offers-price',
  ];
  const domPrice = extractSelectorPrice($, priceSelectors);

  const domTitle =
    $('h1.pdp-title').text().trim() ||
    $('h1.pdp-name').text().trim() ||
    $('h1').first().text().trim() ||
    title;

  const domImage =
    $('div.image-grid-image').first().css('background-image')?.replace(/url\(["']?/, '').replace(/["']?\)/, '') ||
    $('img.image-grid-image').first().attr('src') ||
    imageUrl;

  if (domPrice && domPrice > 0) {
    return {
      success: true,
      title: domTitle,
      price: domPrice,
      imageUrl: domImage,
      currency: 'INR',
    };
  }

  return null;
}

export async function scrapeMyntra(url: string): Promise<ScrapeResult> {
  const styleId = extractMyntraStyleId(url);
  const targetUrls: string[] = [url];
  if (styleId) {
    targetUrls.push(`https://www.myntra.com/${styleId}`);
    targetUrls.push(`https://www.myntra.com/dpl?skuId=${styleId}`);
  }

  // Multi-Strategy HTTP Pipeline with Akamai Bot Manager Bypass Headers
  const headerStrategies = [
    {
      name: 'Mobile Browser (Akamai Datacenter Bypass)',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.80 Mobile Safari/537.36',
        'Sec-CH-UA-Mobile': '?1',
        'Sec-CH-UA-Platform': '"Android"',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
        'Referer': 'https://www.myntra.com/',
      },
    },
    {
      name: 'Social Crawler (Akamai OpenGraph Whitelist)',
      headers: {
        'User-Agent': 'WhatsApp/2.21.12.21 i',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://www.myntra.com/',
      },
    },
    {
      name: 'Desktop Browser with Navigation Headers',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
        'Referer': 'https://www.myntra.com/',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
      },
    },
  ];

  for (const targetUrl of targetUrls) {
    for (const strat of headerStrategies) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 9000);
        const res = await fetch(targetUrl, {
          headers: strat.headers,
          redirect: 'follow',
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const html = await res.text();
          if (html.length > 2000) {
            const extracted = extractFromMyntraHtml(html);
            if (extracted && extracted.success) {
              return extracted;
            }
          }
        }
      } catch (fetchErr: unknown) {
        // Silently fall through to next strategy
      }
    }
  }

  // Strategy 4: Playwright Headless Browser Fallback (CI / Local Worker)
  if (!isPlaywrightAvailable()) {
    let fallbackTitle = 'Myntra Product';
    try {
      const segments = new URL(url).pathname.split('/').filter(Boolean);
      const buyIdx = segments.indexOf('buy');
      const slug = buyIdx >= 2 ? segments[buyIdx - 2] : segments[segments.length - 2];
      if (slug) {
        fallbackTitle = decodeURIComponent(slug).replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
      }
    } catch {}
    return {
      success: false,
      title: fallbackTitle,
      error:
        'Could not extract Myntra product price automatically due to store anti-bot protections. Please enter the current price manually or use the PriceWatcher Companion Extension.',
    };
  }

  try {
    return await withSharedBrowserPage(
      async (page) => {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.waitForTimeout(2500); // Allow React hydration

        const priceText = await page
          .locator('span.pdp-price strong, span.pdp-price, [data-testid="pdp-price"]')
          .first()
          .textContent()
          .catch(() => null);

        const titleText = await page
          .locator('h1.pdp-title, h1.pdp-name, h1')
          .first()
          .textContent()
          .catch(() => 'Myntra Product');

        const imageSrc = await page
          .locator('img.image-grid-image, img[class*="image-grid"]')
          .first()
          .getAttribute('src')
          .catch(() => null);

        const price = priceText ? parsePrice(priceText) : null;
        if (!price || price <= 0) {
          return { success: false, error: 'Could not extract Myntra price with Playwright.' };
        }

        return {
          success: true,
          title: titleText?.trim() || 'Myntra Product',
          price,
          imageUrl: imageSrc || undefined,
          currency: 'INR',
        };
      },
      {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
      }
    );
  } catch (browserErr: unknown) {
    const errorMsg = browserErr instanceof Error ? browserErr.message : String(browserErr);
    return { success: false, error: `Myntra extraction failed: ${errorMsg}` };
  }
}

