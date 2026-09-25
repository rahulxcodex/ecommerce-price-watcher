import * as cheerio from 'cheerio';
import { DiscoveryResult } from '@/types';
import { getDefaultHeaders, getMobileHeaders, parsePrice } from '../utils';
import { calculateDiscount, cleanText, generateDiscoveryId } from './search-utils';

export async function searchAmazon(query: string, limit: number = 10): Promise<DiscoveryResult[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const searchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(cleanQ)}`;

  try {
    let html = '';
    let res: Response | null = null;

    // Mobile search is resilient against Amazon WAF 503 and returns rich product markup immediately
    try {
      res = await fetch(searchUrl, {
        headers: {
          ...getMobileHeaders(),
          'Referer': 'https://www.amazon.in/',
          'Sec-CH-UA-Mobile': '?1',
        },
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        html = await res.text();
      }
    } catch {
      // Fallback to desktop on network error
    }

    let $ = cheerio.load(html || '');
    let titleText = $('title').text().toLowerCase();
    const hasCards = $('div[data-component-type="s-search-result"], div[data-asin]').length > 0;

    // Fallback to desktop if mobile returned empty or captcha
    if (!res || !res.ok || titleText.includes('robot check') || titleText.includes('captcha') || titleText.includes('503') || html.includes('bm-verify=') || !hasCards) {
      console.warn('Amazon mobile search challenged or empty, attempting desktop search fallback...');
      try {
        const desktopRes = await fetch(searchUrl, {
          headers: {
            ...getDefaultHeaders(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Referer': 'https://www.amazon.in/',
          },
          signal: AbortSignal.timeout(8000),
        });

        if (desktopRes.ok) {
          html = await desktopRes.text();
          $ = cheerio.load(html);
          titleText = $('title').text().toLowerCase();
          if (titleText.includes('robot check') || titleText.includes('captcha')) {
            return [];
          }
        } else {
          return [];
        }
      } catch {
        return [];
      }
    }

    const seenAsins = new Set<string>();
    const results: DiscoveryResult[] = [];

    // Prioritize actual product result containers to avoid carousel/banner duplicates
    let $cards = $('div[data-component-type="s-search-result"]');
    if ($cards.length === 0) {
      $cards = $('div[data-asin]');
    }

    $cards.each((_, el) => {
      if (results.length >= limit) return;
      const $card = $(el);
      const asin = $card.attr('data-asin');
      if (!asin || asin.length !== 10 || seenAsins.has(asin)) return;

      // 1. Title extraction (Avoid fake 'Amazon Product' fallbacks)
      let rawTitle =
        cleanText($card.find('h2 a span, h2 span, h2 a, h2, a.a-link-normal .a-text-normal').first().text()) ||
        cleanText($card.find('img[alt]:not([alt="More like this"]):not([alt="Bazaar"]):not([alt*="Sponsored"])').first().attr('alt'));

      if (!rawTitle) return;
      rawTitle = rawTitle.replace(/^Sponsored\s*Ad\s*[-–—:]\s*/i, '').replace(/\s+/g, ' ').trim();
      if (!rawTitle || rawTitle.toLowerCase() === 'amazon product' || rawTitle.length < 3) return;

      const productUrl = `https://www.amazon.in/dp/${asin}`;

      // 2. Price extraction
      const priceText = $card.find('.a-price .a-offscreen, .a-price-whole, span.a-price span.a-offscreen').first().text();
      const price = parsePrice(priceText);
      if (!price || price <= 0) return;

      // 3. Original / MRP Price
      const originalText = $card.find('.a-text-price .a-offscreen, span.a-price.a-text-price').first().text();
      const originalPrice = parsePrice(originalText) || undefined;
      const discountPercent = calculateDiscount(price, originalPrice);

      // 4. Reliable Image Extraction (Resolve real image URL, skipping 1x1 gifs and icons)
      let imageUrl: string | undefined;
      $card.find('img').each((_, imgEl) => {
        if (imageUrl) return;
        const $img = $(imgEl);
        const src = $img.attr('src');
        const dataSrc = $img.attr('data-src');
        const srcset = $img.attr('srcset');

        const candidates = [src, dataSrc];
        if (srcset) {
          const firstFromSrcset = srcset.split(',')[0].trim().split(' ')[0];
          candidates.push(firstFromSrcset);
        }

        for (let c of candidates) {
          if (!c) continue;
          if (c.startsWith('//')) c = `https:${c}`;
          if (
            c.startsWith('http') &&
            !c.includes('grey-pixel.gif') &&
            !c.endsWith('.svg') &&
            !c.includes('bazaar_branding') &&
            !c.includes('pixel')
          ) {
            imageUrl = c;
            break;
          }
        }
      });

      // 5. Rating extraction
      let rating: number | undefined;
      const starEl = $card.find('i[class*="a-icon-star"], i[class*="a-star"], [aria-label*="out of 5"], [aria-label*="stars"]').first();
      const ratingLabel = starEl.attr('aria-label') || starEl.text().trim();
      if (ratingLabel) {
        const match = ratingLabel.match(/([\d.]+)\s*out of/i) || ratingLabel.match(/([\d.]+)\s*stars/i);
        if (match) rating = parseFloat(match[1]);
      }

      // 6. Review count extraction
      let reviewCount: number | undefined;
      const ratingsEl = $card.find('[aria-label*="ratings"]').first();
      const reviewText = (ratingsEl.attr('aria-label') || ratingsEl.text() || $card.find('a[href*="customerReviews"] span, a[href*="#customerReviews"] span').first().text()).trim();
      if (reviewText) {
        const rMatch = reviewText.replace(/,/g, '').match(/\d+/);
        if (rMatch) reviewCount = parseInt(rMatch[0], 10);
      }

      // 7. Number of Buys extraction (e.g. "50+ bought in past month", "2K+ bought in past month")
      let boughtCount: string | undefined;
      $card.find('span.a-size-base, span.a-color-secondary, span.a-text-bold').each((_, s) => {
        if (boughtCount) return;
        const text = $(s).text().trim();
        const bMatch = text.match(/([\dKk+]+(?:\s*\+)?\s+bought\s+in\s+past\s+(?:month|week|year))/i);
        if (bMatch) {
          boughtCount = bMatch[0];
        }
      });

      // 8. Brand extraction
      const brandTag = cleanText($card.find('.s-line-clamp-1 .a-size-base-plus, h5.s-line-clamp-1, span.a-size-medium.a-color-base').first().text());
      const brand = brandTag || rawTitle.split(/[\s\-–:]/)[0].replace(/[^\w&]/g, '').trim() || 'Amazon';

      seenAsins.add(asin);
      results.push({
        id: generateDiscoveryId('amazon', productUrl),
        title: rawTitle,
        price,
        originalPrice,
        discountPercent,
        brand,
        imageUrl,
        productUrl,
        rating,
        reviewCount,
        boughtCount,
        platform: 'amazon',
      });
    });

    return results;
  } catch (err) {
    console.error('Error during Amazon search:', err);
    return [];
  }
}
