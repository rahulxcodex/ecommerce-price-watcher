import * as cheerio from 'cheerio';
import { parsePrice, isPlaywrightAvailable } from './utils';
import { ScrapeResult } from '../../src/types';
import {
  extractJsonLdProduct,
  extractMetaTags,
  extractSelectorPrice,
  resilientFetch,
} from './resilient-extractor';

export async function scrapeAjio(url: string): Promise<ScrapeResult> {
  // Strategy 1: Extract Product Code and Query Native Ajio JSON API
  // Pure JSON API is 100% resilient to HTML/CSS redesigns
  const productCodeMatch = url.match(/\/p\/([a-zA-Z0-9_\-]+)/);
  const productCode = productCodeMatch ? productCodeMatch[1] : null;

  if (productCode) {
    try {
      const apiUrl = `https://www.ajio.com/api/p/${productCode}`;
      const apiRes = await resilientFetch(apiUrl, 8000);
      if (apiRes.ok) {
        const apiData = await apiRes.json();
        if (apiData && apiData.price) {
          const price = apiData.price.value ?? apiData.price.discountedPrice ?? apiData.price.mrp;
          const title = apiData.name || apiData.baseOptions?.[0]?.options?.[0]?.modelImage?.altText || 'Ajio Product';
          const brand = apiData.brandName ? `${apiData.brandName} ` : '';
          const fullTitle = title.startsWith(brand) ? title : `${brand}${title}`;
          const imageUrl =
            apiData.images?.[0]?.url ||
            apiData.baseOptions?.[0]?.options?.[0]?.modelImage?.url;
          const isOutOfStock = apiData.stock?.stockLevelStatus === 'outOfStock';

          const availableSizes: string[] = (apiData.baseOptions?.[0]?.options || [])
            .map((opt: { modelImage?: { altText?: string }; scDisplaySizeValue?: string }) => opt.scDisplaySizeValue || opt.modelImage?.altText || '')
            .filter(Boolean);

          if (price && Number(price) > 0) {
            return {
              success: true,
              title: fullTitle.trim(),
              price: Number(price),
              imageUrl: imageUrl?.startsWith('http') ? imageUrl : imageUrl ? `https://assets.ajio.com${imageUrl}` : undefined,
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
          title: jsonLd.title || 'Ajio Product',
          price: jsonLd.price,
          imageUrl: jsonLd.imageUrl,
          currency: jsonLd.currency || 'INR',
          isOutOfStock: jsonLd.isOutOfStock,
        };
      }

      // Check Tier 2: Preloaded State (__PRELOADED_STATE__)
      const preloadedMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]+?\})\s*;?\s*<\/script>/);
      if (preloadedMatch && preloadedMatch[1]) {
        try {
          const state = JSON.parse(preloadedMatch[1]);
          const product = state?.product?.productDetails;
          if (product && product.price) {
            const price = product.price.value ?? product.price.discountedPrice;
            const title = product.name ? `${product.brandName ? product.brandName + ' ' : ''}${product.name}` : 'Ajio Product';
            const imageUrl = product.images?.[0]?.url;

            if (price && Number(price) > 0) {
              return {
                success: true,
                title,
                price: Number(price),
                imageUrl,
                currency: 'INR',
              };
            }
          }
        } catch {
          // Continue to next tier
        }
      }

      // Check Tier 3: OpenGraph & Twitter meta tags
      const meta = extractMetaTags($);
      if (meta.price && meta.price > 0) {
        return {
          success: true,
          title: meta.title || 'Ajio Product',
          price: meta.price,
          imageUrl: meta.imageUrl,
          currency: 'INR',
        };
      }

      // Check Tier 4: Fallback DOM selectors
      const priceSelectors = [
        'span.prod-sp',
        'div.prod-price-section span.prod-sp',
        'span.price-value',
        'div.discounted-price',
        'span.fnl-price',
        '[data-testid="pdp-sp"]',
      ];
      const domPrice = extractSelectorPrice($, priceSelectors);

      const domTitle =
        $('h1.prod-title').text().trim() ||
        $('h2.prod-brand').text().trim() + ' ' + $('h1.prod-title').text().trim() ||
        $('h1').first().text().trim() ||
        meta.title ||
        'Ajio Product';

      const domImage =
        $('img.prod-main-img').attr('src') ||
        $('img[class*="product-image"]').attr('src') ||
        meta.imageUrl;

      if (domPrice && domPrice > 0) {
        return {
          success: true,
          title: domTitle.trim(),
          price: domPrice,
          imageUrl: domImage,
          currency: 'INR',
        };
      }
    }
  } catch (err: unknown) {
    console.warn('Ajio HTTP fast-path failed, trying Playwright fallback:', err);
  }

  // Strategy 3: Playwright Headless Browser Fallback (only if browser binaries are installed)
  if (!isPlaywrightAvailable()) {
    const slugMatch = url.match(/\/([^/]+)\/p\//);
    const fallbackTitle = slugMatch
      ? decodeURIComponent(slugMatch[1]).replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim()
      : 'Ajio Product';
    return {
      success: false,
      title: fallbackTitle,
      error:
        'Could not extract Ajio product price automatically due to store anti-bot protections. Please enter the current price manually or use the PriceWatcher Companion Extension.',
    };
  }

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
      .locator('span.prod-sp, div.prod-price-section span.prod-sp, span.price-value')
      .first()
      .textContent()
      .catch(() => null);

    const titleText = await page
      .locator('h1.prod-title, h1')
      .first()
      .textContent()
      .catch(() => 'Ajio Product');

    const imageSrc = await page
      .locator('img.prod-main-img, img[class*="preview-image"]')
      .first()
      .getAttribute('src')
      .catch(() => null);

    const price = priceText ? parsePrice(priceText) : null;
    if (!price || price <= 0) {
      return { success: false, error: 'Could not extract Ajio price with Playwright.' };
    }

    return {
      success: true,
      title: titleText?.trim() || 'Ajio Product',
      price,
      imageUrl: imageSrc || undefined,
      currency: 'INR',
    };
  } catch (browserErr: unknown) {
    const errorMsg = browserErr instanceof Error ? browserErr.message : String(browserErr);
    return { success: false, error: `Ajio Playwright failed: ${errorMsg}` };
  } finally {
    if (browser) {
      await browser.close().catch(() => null);
    }
  }
}
