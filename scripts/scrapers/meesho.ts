import * as cheerio from 'cheerio';
import { getDefaultHeaders, parsePrice } from './utils';
import { ScrapeResult } from '../../src/types';
import { extractJsonLdProduct, extractMetaTags } from './resilient-extractor';

export async function scrapeMeesho(url: string): Promise<ScrapeResult> {
  // Strategy 1: Fast HTTP + Preloaded JSON / Next Data inspection
  try {
    const res = await fetch(url, {
      headers: getDefaultHeaders(),
      redirect: 'follow',
    });

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);

      // Check __NEXT_DATA__
      const nextDataRaw = $('#__NEXT_DATA__').html();
      if (nextDataRaw) {
        try {
          const nextData = JSON.parse(nextDataRaw);
          const productDetails =
            nextData?.props?.pageProps?.initialState?.product?.productDetails ||
            nextData?.props?.pageProps?.product;

          if (productDetails) {
            const price = productDetails.price || productDetails.discounted_price || productDetails.original_price;
            const title = productDetails.name || productDetails.title;
            const image = productDetails.images?.[0] || productDetails.valid_images?.[0];

            if (price) {
              return {
                success: true,
                title: title || 'Meesho Product',
                price: Number(price),
                imageUrl: image,
                currency: 'INR',
              };
            }
          }
        } catch {
          // Continue to fallback
        }
      }

      // Check regex for price in script blocks
      const priceRegex = /"discounted_price":\s*(\d+)/i;
      const titleRegex = /"name":\s*"([^"]+)"/i;
      const imgRegex = /"images":\s*\[\s*"([^"]+)"/i;

      const pMatch = html.match(priceRegex);
      const tMatch = html.match(titleRegex);
      const iMatch = html.match(imgRegex);

      if (pMatch && pMatch[1]) {
        return {
          success: true,
          title: tMatch ? tMatch[1] : 'Meesho Product',
          price: parseInt(pMatch[1], 10),
          imageUrl: iMatch ? iMatch[1] : undefined,
          currency: 'INR',
        };
      }

      // Check standard Meesho DOM elements
      const domTitle = $('h1').text().trim() || $('p[class*="ProductTitle"]').text().trim();
      let domPrice: number | null = null;
      $('h4, span[class*="Price"], div[class*="Price"], p[class*="Price"]').each((_, elem) => {
        const text = $(elem).text().trim();
        // Ignore discount banners and promotional coupons
        if (text.startsWith('₹') && !domPrice && !text.toLowerCase().includes('off') && !text.toLowerCase().includes('coupon')) {
          const parsed = parsePrice(text);
          if (parsed && parsed >= 20 && parsed < 200000) {
            domPrice = parsed;
          }
        }
      });

      if (!domPrice) {
        const jsonLd = extractJsonLdProduct($);
        if (jsonLd && jsonLd.price) {
          domPrice = jsonLd.price;
        }
      }

      if (!domPrice) {
        const meta = extractMetaTags($);
        if (meta.price) {
          domPrice = meta.price;
        }
      }

      if (domPrice) {
        return {
          success: true,
          title: domTitle || 'Meesho Product',
          price: domPrice,
          imageUrl: $('img[class*="ProductImage"], img').first().attr('src'),
          currency: 'INR',
        };
      }
    }
  } catch (err: unknown) {
    console.warn('Meesho HTTP fast-path failed, falling back to Playwright:', err);
  }

  // Strategy 2: Playwright Headless Fallback
  let browser;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(3000); // Allow React hydration

    const priceText = await page.locator('h4, span[class*="Price"], div[class*="Price"]').first().textContent().catch(() => null);
    const titleText = await page.locator('h1').first().textContent().catch(() => 'Meesho Product');
    const imageSrc = await page.locator('img[class*="ProductImage"], img').first().getAttribute('src').catch(() => null);

    const price = priceText ? parsePrice(priceText) : null;
    if (!price || price <= 0) {
      return { success: false, error: 'Could not extract Meesho price with Playwright.' };
    }

    return {
      success: true,
      title: titleText?.trim() || 'Meesho Product',
      price,
      imageUrl: imageSrc || undefined,
      currency: 'INR',
    };
  } catch (browserErr: unknown) {
    const errorMsg = browserErr instanceof Error ? browserErr.message : String(browserErr);
    return { success: false, error: `Meesho Playwright failed: ${errorMsg}` };
  } finally {
    if (browser) {
      await browser.close().catch(() => null);
    }
  }
}
