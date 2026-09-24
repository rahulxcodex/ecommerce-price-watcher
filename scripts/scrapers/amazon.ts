import * as cheerio from 'cheerio';
import { getDefaultHeaders, parsePrice } from './utils';
import { ScrapeResult } from '../../src/types';
import { extractJsonLdProduct, extractMetaTags } from './resilient-extractor';

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

    // Bot detection check (title + DOM form elements)
    const titleText = $('title').text().toLowerCase();
    const hasCaptchaForm =
      $('form[action*="validateCaptcha"]').length > 0 ||
      $('#captchacharacters').length > 0 ||
      $('#auth-captcha-image-container').length > 0;

    if (titleText.includes('robot check') || titleText.includes('captcha') || hasCaptchaForm) {
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

    if (!price) {
      const jsonLd = extractJsonLdProduct($);
      if (jsonLd && jsonLd.price) {
        price = jsonLd.price;
        if (!imageUrl) imageUrl = jsonLd.imageUrl;
      }
    }

    if (!price) {
      const meta = extractMetaTags($);
      if (meta.price) {
        price = meta.price;
        if (!imageUrl) imageUrl = meta.imageUrl;
      }
    }

    // Available sizes
    const availableSizes: string[] = [];
    $('#native_dropdown_selected_size_name option').each((_, opt) => {
      const val = $(opt).text().trim();
      if (val && !val.toLowerCase().includes('select') && val.length < 20) {
        availableSizes.push(val);
      }
    });

    // Bank offers
    const bankOffers = [];
    const offerText = $('#item_deals_badge_div, #instantBankDiscount, [data-csa-c-slot-id*="offer"]').text();
    if (offerText) {
      for (const b of ['HDFC', 'ICICI', 'SBI', 'Axis', 'OneCard']) {
        if (new RegExp(b, 'i').test(offerText)) {
          bankOffers.push({
            bank: b,
            description: `Instant discount available with ${b} Bank cards`,
          });
        }
      }
    }

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
      availableSizes: availableSizes.length > 0 ? availableSizes : undefined,
      bankOffers: bankOffers.length > 0 ? bankOffers : undefined,
      currency: 'INR',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Amazon scraper error: ${errorMsg}` };
  }
}
