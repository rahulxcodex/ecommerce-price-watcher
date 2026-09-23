import * as cheerio from 'cheerio';
import { getDefaultHeaders, parsePrice } from './utils';
import { ScrapeResult } from '../../src/types';

export async function scrapeAmazon(url: string): Promise<ScrapeResult> {
  try {
    const response = await fetch(url, {
      headers: getDefaultHeaders(),
      redirect: 'follow',
    });

    if (!response.ok) {
      return { success: false, error: `Amazon returned HTTP status: ${response.status}` };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Bot detection check
    if ($('title').text().includes('Robot Check') || $('title').text().includes('CAPTCHA')) {
      return { success: false, error: 'Amazon triggered bot verification/CAPTCHA' };
    }

    // Out of stock check
    const availabilityText = $('#availability').text().toLowerCase();
    const isOutOfStock =
      availabilityText.includes('currently unavailable') ||
      availabilityText.includes('out of stock');

    // Title extraction
    const title =
      $('#productTitle').text().trim() ||
      $('#title').text().trim() ||
      $('meta[name="title"]').attr('content') ||
      'Amazon Product';

    // Price extraction with fallback selectors
    let price: number | null = null;
    const priceSelectors = [
      '.a-price.aok-align-center .a-offscreen',
      '#apex_desktop .a-price .a-offscreen',
      '#corePriceDisplay_desktop_feature_div .a-price-whole',
      '#corePrice_feature_div .a-price-whole',
      '#priceblock_dealprice',
      '#priceblock_ourprice',
      '.a-price .a-offscreen',
      '#price_inside_buybox',
    ];

    for (const sel of priceSelectors) {
      const el = $(sel).first();
      if (el.length > 0) {
        const text = el.text().trim();
        const parsed = parsePrice(text);
        if (parsed && parsed > 0) {
          price = parsed;
          break;
        }
      }
    }

    // Image extraction
    let imageUrl =
      $('#landingImage').attr('src') ||
      $('#landingImage').attr('data-old-hires') ||
      $('#imgBlkFront').attr('src') ||
      $('img#main-image').attr('src') ||
      undefined;

    if (!price && !isOutOfStock) {
      return {
        success: false,
        title,
        imageUrl,
        error: 'Unable to extract Amazon price with standard selectors.',
      };
    }

    return {
      success: true,
      title,
      price: price ?? 0,
      imageUrl,
      isOutOfStock,
      currency: 'INR',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Amazon scraper error: ${errorMsg}` };
  }
}
