import * as cheerio from 'cheerio';
import { getDefaultHeaders, parsePrice, isPlaywrightAvailable, withSharedBrowserPage } from './utils';
import { ScrapeResult } from '../../src/types';
import { extractJsonLdProduct, extractMetaTags } from './resilient-extractor';

export async function scrapeMeesho(url: string): Promise<ScrapeResult> {
  const headerOptions: Array<{ name: string; headers: Record<string, string> }> = [
    {
      name: 'Android Mobile (Akamai Bypass)',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
        'Referer': 'https://www.meesho.com/',
        'Sec-Ch-Ua-Mobile': '?1',
        'Sec-Ch-Ua-Platform': '"Android"',
      },
    },
    {
      name: 'Default Browser',
      headers: getDefaultHeaders(),
    },
  ];

  // Strategy 1: Multi-Tier HTTP with Preloaded JSON & Next Data inspection
  for (const opt of headerOptions) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, {
        headers: opt.headers,
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);

        // Check __NEXT_DATA__
        const nextDataRaw = $('#__NEXT_DATA__').html();
        if (nextDataRaw) {
          try {
            const nextData = JSON.parse(nextDataRaw);
            const pDetails =
              nextData?.props?.pageProps?.initialState?.product?.details?.data ||
              nextData?.props?.pageProps?.initialState?.product?.productDetails ||
              nextData?.props?.pageProps?.product;

            if (pDetails) {
              const price =
                pDetails.price ??
                pDetails.discounted_price ??
                pDetails.catalog?.min_product_price ??
                pDetails.original_price ??
                pDetails.transient_price;
              const title = pDetails.name || pDetails.title || pDetails.meta_title;
              const image =
                pDetails.images?.[0] ||
                pDetails.valid_images?.[0] ||
                pDetails.catalog?.image ||
                pDetails.image;
              const isOutOfStock = pDetails.in_stock === false || pDetails.valid === false;

              if (price && Number(price) > 0) {
                return {
                  success: true,
                  title: title || 'Meesho Product',
                  price: Number(price),
                  imageUrl: image,
                  currency: 'INR',
                  isOutOfStock,
                };
              }
            }
          } catch {
            // Continue to fallback
          }
        }

        // Check regex for price in script blocks
        const priceRegexes = [
          /"min_product_price"\s*:\s*(\d+)/i,
          /"discounted_price"\s*:\s*(\d+)/i,
          /"price"\s*:\s*(\d+)/i,
        ];
        const titleRegex = /"name"\s*:\s*"([^"]+)"/i;
        const imgRegex = /"images"\s*:\s*\[\s*"([^"]+)"/i;

        let foundPrice: number | null = null;
        for (const pr of priceRegexes) {
          const m = html.match(pr);
          if (m && m[1] && Number(m[1]) > 0) {
            foundPrice = parseInt(m[1], 10);
            break;
          }
        }

        const tMatch = html.match(titleRegex);
        const iMatch = html.match(imgRegex);

        if (foundPrice && foundPrice > 0) {
          return {
            success: true,
            title: tMatch ? tMatch[1] : 'Meesho Product',
            price: foundPrice,
            imageUrl: iMatch ? iMatch[1] : undefined,
            currency: 'INR',
          };
        }

        // Check standard Meesho DOM elements
        const domTitle = $('h1').text().trim() || $('p[class*="ProductTitle"]').text().trim();
        let domPrice: number | null = null;
        $('h4, span[class*="Price"], div[class*="Price"], p[class*="Price"]').each((_, elem) => {
          const text = $(elem).text().trim();
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
    } catch {
      // Continue to next header strategy
    }
  }

  // Strategy 2: Playwright Headless Fallback (only if browser binaries are installed)
  if (!isPlaywrightAvailable()) {
    return {
      success: false,
      error:
        'Could not extract Meesho product price via HTTP. Note: Headless browser rendering is only available in background check jobs (GitHub Actions), not in serverless web runtimes.',
    };
  }

  try {
    return await withSharedBrowserPage(
      async (page) => {
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
      },
      {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      }
    );
  } catch (browserErr: unknown) {
    const errorMsg = browserErr instanceof Error ? browserErr.message : String(browserErr);
    return { success: false, error: `Meesho Playwright failed: ${errorMsg}` };
  }
}
