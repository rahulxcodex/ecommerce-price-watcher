import * as cheerio from 'cheerio';
import { parsePrice } from './utils';
import { ScrapeResult } from '../../src/types';
import {
  extractJsonLdProduct,
  extractMetaTags,
  extractSelectorPrice,
  resilientFetch,
} from './resilient-extractor';

export async function scrapeWestside(url: string): Promise<ScrapeResult> {
  // Strategy 1: Pure Shopify Product JSON Endpoint
  // Completely immune to storefront theme redesigns & HTML changes
  const handleMatch = url.match(/\/products\/([a-zA-Z0-9_\-]+)/);
  const handle = handleMatch ? handleMatch[1] : null;

  if (handle) {
    try {
      const parsedUrl = new URL(url);
      const jsonEndpoint = `${parsedUrl.origin}/products/${handle}.js`;
      const jsonRes = await resilientFetch(jsonEndpoint, 8000);

      if (jsonRes.ok) {
        const prodData = await jsonRes.json();
        if (prodData && prodData.title) {
          // Shopify JSON prices are always in cents/paise (e.g. 9900 = 99 INR, 129900 = 1,299 INR)
          let price = prodData.price;
          if (price && typeof price === 'number') {
            price = price / 100;
          }

          const isOutOfStock = prodData.available === false;
          let imageUrl = prodData.featured_image || prodData.images?.[0];
          if (imageUrl && imageUrl.startsWith('//')) {
            imageUrl = `https:${imageUrl}`;
          }

          // Extract sizes from variants
          const availableSizes: string[] = (prodData.variants || [])
            .filter((v: { available?: boolean }) => v.available)
            .map((v: { title?: string }) => v.title || '')
            .filter(Boolean);

          if (price && price > 0) {
            return {
              success: true,
              title: String(prodData.title).trim(),
              price,
              imageUrl,
              currency: 'INR',
              isOutOfStock,
              availableSizes: availableSizes.length > 0 ? availableSizes : undefined,
            };
          }
        }
      }
    } catch {
      // Fall through to SSR & HTML extraction
    }
  }

  // Strategy 2: Fast HTTP with multi-tier resilient SSR extraction
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
          title: jsonLd.title || 'Westside Product',
          price: jsonLd.price,
          imageUrl: jsonLd.imageUrl,
          currency: jsonLd.currency || 'INR',
          isOutOfStock: jsonLd.isOutOfStock,
        };
      }

      // Check Tier 2: OpenGraph & Twitter meta tags
      const meta = extractMetaTags($);
      if (meta.price && meta.price > 0) {
        return {
          success: true,
          title: meta.title || 'Westside Product',
          price: meta.price,
          imageUrl: meta.imageUrl,
          currency: 'INR',
        };
      }

      // Check Tier 3: Fallback DOM selectors (Shopify Liquid & modern Dawn/OS2.0 themes)
      const priceSelectors = [
        'span.price-item--sale',
        'span.price-item--regular',
        'div.price__sale span.price-item',
        'span.price__current',
        'span.money',
        '[data-product-price]',
        '.product__price',
      ];
      const domPrice = extractSelectorPrice($, priceSelectors);

      const domTitle =
        $('h1.product__title').text().trim() ||
        $('h1.product-single__title').text().trim() ||
        $('h1').first().text().trim() ||
        meta.title ||
        'Westside Product';

      const domImage =
        $('img.product__media-image').attr('src') ||
        $('div.product__media img').attr('src') ||
        $('img[class*="product"]').attr('src') ||
        meta.imageUrl;

      const formattedImage = domImage?.startsWith('//') ? `https:${domImage}` : domImage;

      if (domPrice && domPrice > 0) {
        return {
          success: true,
          title: domTitle,
          price: domPrice,
          imageUrl: formattedImage,
          currency: 'INR',
        };
      }
    }
  } catch (err: unknown) {
    console.warn('Westside HTTP fast-path failed, trying Playwright fallback:', err);
  }

  // Strategy 3: Playwright Headless Browser Fallback
  let browser;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2500);

    const priceText = await page
      .locator('span.price-item--sale, span.price-item--regular, span.price__current, span.money')
      .first()
      .textContent()
      .catch(() => null);

    const titleText = await page
      .locator('h1.product__title, h1')
      .first()
      .textContent()
      .catch(() => 'Westside Product');

    const imageSrc = await page
      .locator('img.product__media-image, div.product__media img')
      .first()
      .getAttribute('src')
      .catch(() => null);

    const price = priceText ? parsePrice(priceText) : null;
    if (!price || price <= 0) {
      return { success: false, error: 'Could not extract Westside price with Playwright.' };
    }

    const formattedImage = imageSrc?.startsWith('//') ? `https:${imageSrc}` : imageSrc;

    return {
      success: true,
      title: titleText?.trim() || 'Westside Product',
      price,
      imageUrl: formattedImage || undefined,
      currency: 'INR',
    };
  } catch (browserErr: unknown) {
    const errorMsg = browserErr instanceof Error ? browserErr.message : String(browserErr);
    return { success: false, error: `Westside Playwright failed: ${errorMsg}` };
  } finally {
    if (browser) {
      await browser.close().catch(() => null);
    }
  }
}
