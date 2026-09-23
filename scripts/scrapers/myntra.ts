import * as cheerio from 'cheerio';
import { parsePrice } from './utils';
import { ScrapeResult } from '../../src/types';
import {
  extractJsonLdProduct,
  extractMetaTags,
  extractSelectorPrice,
  resilientFetch,
} from './resilient-extractor';

export async function scrapeMyntra(url: string): Promise<ScrapeResult> {
  // Strategy 1: Fast HTTP with multi-tier resilient SSR extraction
  try {
    const res = await resilientFetch(url, 12000);

    if (res.ok) {
      const html = await res.text();
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
      const myxMatch = html.match(/window\.__myx\s*=\s*(\{[\s\S]+?\})\s*;?\s*<\/script>/);
      if (myxMatch && myxMatch[1]) {
        try {
          const myxData = JSON.parse(myxMatch[1]);
          const pdpData = myxData?.pdpData;
          if (pdpData) {
            const price = pdpData.price?.discounted || pdpData.price?.mrp;
            const title = pdpData.name
              ? `${pdpData.brand?.name ? pdpData.brand.name + ' ' : ''}${pdpData.name}`
              : 'Myntra Product';
            const imageUrl = pdpData.media?.albums?.[0]?.images?.[0]?.src;
            const isOutOfStock =
              pdpData.sizes && Array.isArray(pdpData.sizes)
                ? pdpData.sizes.every((s: { available?: boolean }) => s.available === false)
                : false;

            if (price && Number(price) > 0) {
              return {
                success: true,
                title,
                price: Number(price),
                imageUrl,
                currency: 'INR',
                isOutOfStock,
              };
            }
          }
        } catch {
          // Fall through to regex extraction
        }
      }

      // Check Tier 2b: Regex extraction on raw script payload
      const discPriceMatch = html.match(/"discounted":\s*(\d+)/i) || html.match(/"discountedPrice":\s*(\d+)/i);
      const mrpMatch = html.match(/"mrp":\s*(\d+)/i);
      const rawPrice = discPriceMatch ? discPriceMatch[1] : mrpMatch ? mrpMatch[1] : null;

      const titleMatch = html.match(/"name":\s*"([^"]+)"/i);
      const imageMatch = html.match(/"src":\s*"([^"]+myntassets\.com[^"]+)"/i);

      if (rawPrice && parseInt(rawPrice, 10) > 0) {
        return {
          success: true,
          title: titleMatch ? titleMatch[1] : jsonLd?.title || 'Myntra Product',
          price: parseInt(rawPrice, 10),
          imageUrl: imageMatch ? imageMatch[1] : jsonLd?.imageUrl,
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
    }
  } catch (err: unknown) {
    console.warn('Myntra HTTP fast-path failed, trying Playwright fallback:', err);
  }

  // Strategy 2: Playwright Headless Browser Fallback
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });

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

    await browser.close();

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
  } catch (browserErr: unknown) {
    const errorMsg = browserErr instanceof Error ? browserErr.message : String(browserErr);
    return { success: false, error: `Myntra Playwright failed: ${errorMsg}` };
  }
}
