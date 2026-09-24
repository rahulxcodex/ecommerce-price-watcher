import * as cheerio from 'cheerio';
import { getDefaultHeaders, getMobileHeaders, parsePrice, isPlaywrightAvailable, delay } from './utils';
import { ScrapeResult } from '../../src/types';
import { extractJsonLdProduct, extractMetaTags } from './resilient-extractor';

/**
 * Normalizes Amazon product URLs to canonical /dp/{ASIN} format,
 * stripping tracking queries and search tokens that trigger WAF verification.
 */
export function cleanAmazonUrl(rawUrl: string): string {
  try {
    const urlObj = new URL(rawUrl);
    const asinMatch = urlObj.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    if (asinMatch && asinMatch[1]) {
      return `https://www.amazon.in/dp/${asinMatch[1].toUpperCase()}`;
    }
    return `${urlObj.origin}${urlObj.pathname}`;
  } catch {
    return rawUrl;
  }
}

interface ParsedAmazonDom {
  title?: string;
  price?: number;
  imageUrl?: string;
  isOutOfStock: boolean;
  isBotBlocked: boolean;
  availableSizes?: string[];
  bankOffers?: { bank: string; description: string }[];
}

/**
 * Parses Amazon HTML document for prices, titles, images, and bot challenges.
 */
function parseAmazonHtml(html: string, isMobile = false): ParsedAmazonDom {
  const $ = cheerio.load(html);

  // 1. Bot detection check (Title, CAPTCHA form, Akamai bm-verify)
  const titleText = $('title').text().toLowerCase();
  const hasCaptchaForm =
    $('form[action*="validateCaptcha"]').length > 0 ||
    $('#captchacharacters').length > 0 ||
    $('#auth-captcha-image-container').length > 0 ||
    html.includes('bm-verify=');

  const isBotBlocked =
    titleText.includes('robot check') ||
    titleText.includes('captcha') ||
    titleText.includes('automated access') ||
    hasCaptchaForm;

  // 2. Out of stock check
  const availabilityText = $('#availability').text().toLowerCase();
  const isOutOfStock =
    availabilityText.includes('currently unavailable') ||
    availabilityText.includes('out of stock') ||
    availabilityText.includes('temporarily out of stock');

  // 3. Title extraction
  const title =
    $('#productTitle').text().trim() ||
    $('#title').text().trim() ||
    $('h1.a-size-large').text().trim() ||
    $('meta[name="title"]').attr('content') ||
    $('meta[property="og:title"]').attr('content') ||
    'Amazon Product';

  // 4. Primary DOM price extraction
  let price: number | null = null;
  const selectors = isMobile
    ? [
        '#corePriceDisplay_mobile_feature_div .a-price .a-offscreen',
        '#corePriceDisplay_mobile_feature_div .a-price-whole',
        '#apex_mobile .a-price .a-offscreen',
        '#mobile_buybox .a-price .a-offscreen',
        'span.priceToPay .a-offscreen',
        'span.apexPriceToPay .a-offscreen',
        '.a-price .a-offscreen',
      ]
    : [
        'span.priceToPay .a-offscreen',
        'span.apexPriceToPay .a-offscreen',
        '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
        '#corePriceDisplay_desktop_feature_div .a-price-whole',
        '#corePrice_desktop .a-price .a-offscreen',
        '#corePrice_feature_div .a-price-whole',
        '#corePrice_feature_div .a-price .a-offscreen',
        '#corePriceDisplay_mobile_feature_div .a-price .a-offscreen',
        '#corePriceDisplay_mobile_feature_div .a-price-whole',
        '.a-price.aok-align-center .a-offscreen',
        '#apex_desktop .a-price .a-offscreen',
        '#apex_mobile .a-price .a-offscreen',
        '#priceblock_dealprice',
        '#priceblock_ourprice',
        '.a-price .a-offscreen',
        '#price_inside_buybox',
        '#newAccordionRow .a-price .a-offscreen',
        '#tp_price_block_total_price_ww .a-offscreen',
        '#sns-base-price .a-offscreen',
        'span[data-a-color="price"] span.a-offscreen',
        'span[data-a-color="base"] span.a-offscreen',
      ];

  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length > 0) {
      const parsed = parsePrice(el.text().trim());
      if (parsed && parsed > 0) {
        price = parsed;
        break;
      }
    }
  }

  // 5. Embedded script / Twister state regex fallback
  if (!price && !isOutOfStock) {
    const scriptPatterns = [
      /"buyingPrice":\s*"?([\d.]+)"?/i,
      /"priceAmount":\s*([\d.]+)/i,
      /"displayPrice":\s*"₹?\s*([\d,]+(?:\.\d{1,2})?)"/i,
      /"price":\s*"₹?\s*([\d,]+(?:\.\d{1,2})?)"/i,
    ];
    for (const pattern of scriptPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const parsed = parsePrice(match[1]);
        if (parsed && parsed > 0) {
          price = parsed;
          break;
        }
      }
    }
  }

  // 6. Schema.org JSON-LD fallback
  let imageUrl =
    $('#landingImage').attr('src') ||
    $('#landingImage').attr('data-old-hires') ||
    $('#imgBlkFront').attr('src') ||
    $('img#main-image').attr('src') ||
    $('meta[property="og:image"]').attr('content') ||
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

  // 7. Sizes
  const availableSizes: string[] = [];
  $('#native_dropdown_selected_size_name option').each((_, opt) => {
    const val = $(opt).text().trim();
    if (val && !val.toLowerCase().includes('select') && val.length < 20) {
      availableSizes.push(val);
    }
  });

  // 8. Bank Offers
  const bankOffers: { bank: string; description: string }[] = [];
  const offerText = $('#item_deals_badge_div, #instantBankDiscount, [data-csa-c-slot-id*="offer"]').text();
  if (offerText) {
    for (const b of ['HDFC', 'ICICI', 'SBI', 'Axis', 'OneCard', 'Kotak', 'Federal']) {
      if (new RegExp(b, 'i').test(offerText)) {
        bankOffers.push({
          bank: b,
          description: `Instant discount available with ${b} Bank cards`,
        });
      }
    }
  }

  return {
    title,
    price: price ?? undefined,
    imageUrl,
    isOutOfStock,
    isBotBlocked,
    availableSizes: availableSizes.length > 0 ? availableSizes : undefined,
    bankOffers: bankOffers.length > 0 ? bankOffers : undefined,
  };
}

/**
 * 5-Tier Resilient Amazon Scraper:
 * Tier 1: Desktop HTTP Fast-path with Anti-Bot Headers
 * Tier 2: Mobile HTTP Fast-path Bypass (Bypasses Akamai Bot Manager on Datacenter IPs)
 * Tier 3: Playwright Headless Browser with Stealth Flags (When in Background/Worker)
 */
export async function scrapeAmazon(rawUrl: string): Promise<ScrapeResult> {
  const canonicalUrl = cleanAmazonUrl(rawUrl);

  // ==========================================
  // TIER 1: Desktop HTTP Fast Path
  // ==========================================
  try {
    const response = await fetch(canonicalUrl, {
      headers: {
        ...getDefaultHeaders(),
        Referer: 'https://www.amazon.in/',
      },
      redirect: 'follow',
    });

    if (response.ok) {
      const html = await response.text();
      const parsed = parseAmazonHtml(html, false);

      if (!parsed.isBotBlocked && (parsed.price !== undefined || parsed.isOutOfStock)) {
        return {
          success: true,
          title: parsed.title || 'Amazon Product',
          price: parsed.price ?? 0,
          imageUrl: parsed.imageUrl,
          isOutOfStock: parsed.isOutOfStock,
          availableSizes: parsed.availableSizes,
          bankOffers: parsed.bankOffers,
          currency: 'INR',
        };
      }
    }
  } catch (err) {
    console.warn('Amazon Tier 1 (Desktop HTTP) failed, moving to Tier 2:', err);
  }

  // ==========================================
  // TIER 2: Mobile HTTP Fast Path (Bypass)
  // ==========================================
  try {
    await delay(1000 + Math.floor(Math.random() * 1000));
    const mobileRes = await fetch(canonicalUrl, {
      headers: {
        ...getMobileHeaders(),
        Referer: 'https://www.amazon.in/',
        'Sec-CH-UA-Mobile': '?1',
      },
      redirect: 'follow',
    });

    if (mobileRes.ok) {
      const mHtml = await mobileRes.text();
      const mParsed = parseAmazonHtml(mHtml, true);

      if (!mParsed.isBotBlocked && (mParsed.price !== undefined || mParsed.isOutOfStock)) {
        return {
          success: true,
          title: mParsed.title || 'Amazon Product',
          price: mParsed.price ?? 0,
          imageUrl: mParsed.imageUrl,
          isOutOfStock: mParsed.isOutOfStock,
          availableSizes: mParsed.availableSizes,
          bankOffers: mParsed.bankOffers,
          currency: 'INR',
        };
      }
    }
  } catch (err) {
    console.warn('Amazon Tier 2 (Mobile HTTP) failed, checking Tier 3:', err);
  }

  // ==========================================
  // TIER 3: Playwright Headless Browser Fallback
  // ==========================================
  if (isPlaywrightAvailable()) {
    let browser;
    try {
      const { chromium } = await import('playwright');
      browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
        ],
      });

      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 800 },
        locale: 'en-IN',
        timezoneId: 'Asia/Kolkata',
      });

      const page = await context.newPage();
      await page.goto(canonicalUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

      // Wait up to 8s for standard price selectors
      await page
        .waitForSelector(
          'span.priceToPay .a-offscreen, span.apexPriceToPay .a-offscreen, #corePriceDisplay_desktop_feature_div, #corePriceDisplay_mobile_feature_div, .a-price .a-offscreen',
          { timeout: 8000 }
        )
        .catch(() => null);

      const html = await page.content();
      const parsed = parseAmazonHtml(html, false);

      await browser.close();

      if (parsed.price !== undefined || parsed.isOutOfStock) {
        return {
          success: true,
          title: parsed.title || 'Amazon Product',
          price: parsed.price ?? 0,
          imageUrl: parsed.imageUrl,
          isOutOfStock: parsed.isOutOfStock,
          availableSizes: parsed.availableSizes,
          bankOffers: parsed.bankOffers,
          currency: 'INR',
        };
      }
    } catch (browserErr) {
      if (browser) await browser.close().catch(() => null);
      console.warn('Amazon Tier 3 (Playwright) failed:', browserErr);
    }
  }

  return {
    success: false,
    error: 'Amazon price extraction failed across all tiers (Desktop, Mobile bypass, and Browser fallback). Product may require verification or layout changed.',
  };
}
