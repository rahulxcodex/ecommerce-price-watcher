import * as cheerio from 'cheerio';
import { getDefaultHeaders, parsePrice } from './utils';
import { ScrapeResult } from '../../src/types';
import { extractMetaTags } from './resilient-extractor';

export async function scrapeFlipkart(url: string): Promise<ScrapeResult> {
  // Strategy 1: Fast HTTP + Cheerio + JSON-LD
  try {
    const res = await fetch(url, {
      headers: getDefaultHeaders(),
      redirect: 'follow',
    });

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);

      // Check JSON-LD structured data first
      let jsonLdPrice: number | null = null;
      let jsonLdTitle: string | null = null;
      let jsonLdImage: string | null = null;

      $('script[type="application/ld+json"]').each((_, elem) => {
        try {
          const content = $(elem).html();
          if (content) {
            const data = JSON.parse(content);
            const product = Array.isArray(data) ? data.find((item) => item['@type'] === 'Product') : data;
            if (product && product['@type'] === 'Product') {
              if (product.offers) {
                const offers = Array.isArray(product.offers) ? product.offers[0] : product.offers;
                if (offers && offers.price) {
                  jsonLdPrice = typeof offers.price === 'number' ? offers.price : parsePrice(String(offers.price));
                }
              }
              if (product.name) jsonLdTitle = product.name;
              if (product.image) {
                jsonLdImage = Array.isArray(product.image) ? product.image[0] : product.image;
              }
            }
          }
        } catch {
          // Ignore JSON parse errors
        }
      });

      // DOM Selectors fallback
      const domTitle =
        $('span.B_NuCI').text().trim() ||
        $('span.VU-ZEz').text().trim() ||
        $('h1').first().text().trim() ||
        jsonLdTitle ||
        'Flipkart Product';

      let domPrice: number | null = jsonLdPrice;
      if (!domPrice) {
        const priceSelectors = [
          'div.Nx9bqj.CxhGGd',
          'div._30jeq3._16Jk6d',
          'div.Nx9bqj',
          'div._30jeq3',
          'div._1vC4OE._3qQ9m1',
        ];
        for (const sel of priceSelectors) {
          const el = $(sel).first();
          if (el.length > 0) {
            const parsed = parsePrice(el.text().trim());
            if (parsed && parsed > 0) {
              domPrice = parsed;
              break;
            }
          }
        }
      }

      if (!domPrice) {
        const meta = extractMetaTags($);
        if (meta.price) {
          domPrice = meta.price;
        }
      }

      const domImage =
        jsonLdImage ||
        $('img._396cs4._2amPTt').attr('src') ||
        $('img.DByuf4').attr('src') ||
        $('img._2r_T1I').attr('src') ||
        undefined;

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
    console.warn('Flipkart HTTP fast-path failed, trying Playwright fallback:', err);
  }

  // Strategy 2: Headless Playwright Browser Fallback
  let browser;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });

    // Wait for price container
    await page.waitForSelector('div.Nx9bqj, div._30jeq3, span.B_NuCI, span.VU-ZEz', { timeout: 10000 }).catch(() => null);

    const priceText = await page.locator('div.Nx9bqj.CxhGGd, div._30jeq3._16Jk6d, div.Nx9bqj, div._30jeq3').first().textContent().catch(() => null);
    const titleText = await page.locator('span.B_NuCI, span.VU-ZEz, h1').first().textContent().catch(() => 'Flipkart Product');
    const imageSrc = await page.locator('img._396cs4, img.DByuf4').first().getAttribute('src').catch(() => null);

    const price = priceText ? parsePrice(priceText) : null;
    if (!price || price <= 0) {
      return { success: false, error: 'Could not extract Flipkart price with Playwright.' };
    }

    return {
      success: true,
      title: titleText?.trim() || 'Flipkart Product',
      price,
      imageUrl: imageSrc || undefined,
      currency: 'INR',
    };
  } catch (browserErr: unknown) {
    const errorMsg = browserErr instanceof Error ? browserErr.message : String(browserErr);
    return { success: false, error: `Flipkart Playwright failed: ${errorMsg}` };
  } finally {
    if (browser) {
      await browser.close().catch(() => null);
    }
  }
}
