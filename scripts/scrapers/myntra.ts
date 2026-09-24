import * as cheerio from 'cheerio';
import { parsePrice, isPlaywrightAvailable, getMobileHeaders, withSharedBrowserPage } from './utils';
import { ScrapeResult } from '../../src/types';
import {
  extractJsonLdProduct,
  extractMetaTags,
  extractSelectorPrice,
  resilientFetch,
} from './resilient-extractor';

function extractFromMyntraHtml(html: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  // Check Tier 1: Schema.org / JSON-LD (Google Shopping standard)
  const jsonLd = extractJsonLdProduct($);
  if (jsonLd && jsonLd.price && jsonLd.price > 0) {
    return {
      success: true,
      title: jsonLd.title || 'Myntra Product',
      price: jsonLd.price,
      imageUrl: jsonLd.imageUrl,
      currency: jsonLd.currency || 'INR',
      isOutOfStock: jsonLd.isOutOfStock,
    };
  }

  // Check Tier 2: Preloaded hydration state script (window.__myx.pdpData)
  // Robust substring matching rather than greedy regex
  const myxIdx = html.indexOf('window.__myx');
  if (myxIdx !== -1) {
    const pdpIdx = html.indexOf('"pdpData":', myxIdx);
    if (pdpIdx !== -1) {
      const slice = html.slice(pdpIdx, pdpIdx + 25000);
      const discMatch = slice.match(/"discounted":\s*(\d+)/i) || slice.match(/"discountedPrice":\s*(\d+)/i);
      const mrpMatch = slice.match(/"mrp":\s*(\d+)/i);
      const priceVal = discMatch ? discMatch[1] : mrpMatch ? mrpMatch[1] : null;

      const nameMatch = slice.match(/"name":\s*"([^"]+)"/i);
      const brandMatch = slice.match(/"brand":\s*\{[^}]*"name":\s*"([^"]+)"/i);
      const title = nameMatch
        ? `${brandMatch ? brandMatch[1] + ' ' : ''}${nameMatch[1]}`
        : 'Myntra Product';

      const rawImgMatch = slice.match(/"src":\s*"([^"]+myntassets[^"]+)"/i);
      const imageUrl = rawImgMatch
        ? rawImgMatch[1].replace(/\\u002F/g, '/').replace(/h_\(\$height\)[^/]+\//, '')
        : undefined;

      if (priceVal && Number(priceVal) > 0) {
        return {
          success: true,
          title,
          price: Number(priceVal),
          imageUrl,
          currency: 'INR',
        };
      }
    }
  }

  // Check Tier 2b: Global regex on entire HTML payload
  const globalDisc = html.match(/"discounted":\s*(\d+)/i) || html.match(/"discountedPrice":\s*(\d+)/i);
  const globalMrp = html.match(/"mrp":\s*(\d+)/i);
  const rawPrice = globalDisc ? globalDisc[1] : globalMrp ? globalMrp[1] : null;
  const globalTitle = html.match(/"name":\s*"([^"]+)"/i);
  const globalImg = html.match(/"src":\s*"([^"]+myntassets[^"]+)"/i);

  if (rawPrice && parseInt(rawPrice, 10) > 0) {
    return {
      success: true,
      title: globalTitle ? globalTitle[1] : jsonLd?.title || 'Myntra Product',
      price: parseInt(rawPrice, 10),
      imageUrl: globalImg ? globalImg[1].replace(/\\u002F/g, '/').replace(/h_\(\$height\)[^/]+\//, '') : jsonLd?.imageUrl,
      currency: 'INR',
    };
  }

  // Check Tier 3: OpenGraph & Twitter meta tags
  const meta = extractMetaTags($);
  if (meta.price && meta.price > 0) {
    return {
      success: true,
      title: meta.title || 'Myntra Product',
      price: meta.price,
      imageUrl: meta.imageUrl,
      currency: 'INR',
    };
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
    meta.title ||
    'Myntra Product';

  const domImage =
    $('div.image-grid-image').first().css('background-image')?.replace(/url\(["']?/, '').replace(/["']?\)/, '') ||
    $('img.image-grid-image').first().attr('src') ||
    meta.imageUrl;

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
  // Strategy 1: Desktop HTTP fast-path
  try {
    const res = await resilientFetch(url, 8000);
    if (res.ok) {
      const html = await res.text();
      const extracted = extractFromMyntraHtml(html);
      if (extracted && extracted.success) {
        return extracted;
      }
    }
  } catch (err: unknown) {
    console.warn('Myntra desktop fetch skipped or failed:', err);
  }

  // Strategy 2: Mobile HTTP fast-path (bypasses desktop challenge filters & returns SSR payload)
  try {
    const mobileRes = await fetch(url, {
      headers: getMobileHeaders(),
      redirect: 'follow',
    });
    if (mobileRes.ok) {
      const mobileHtml = await mobileRes.text();
      const extracted = extractFromMyntraHtml(mobileHtml);
      if (extracted && extracted.success) {
        return extracted;
      }
    }
  } catch (err: unknown) {
    console.warn('Myntra mobile fetch skipped or failed:', err);
  }

  // Strategy 3: Playwright Headless Browser Fallback (only if browser binaries are installed)
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
