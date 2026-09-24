import * as cheerio from 'cheerio';
import { DiscoveryResult } from '@/types';
import { getDefaultHeaders, parsePrice } from '../utils';
import { calculateDiscount, cleanText, generateDiscoveryId } from './search-utils';

export async function searchFlipkart(query: string, limit: number = 15): Promise<DiscoveryResult[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const searchUrl = `https://www.flipkart.com/search?q=${encodeURIComponent(cleanQ)}`;

  try {
    const res = await fetch(searchUrl, {
      headers: getDefaultHeaders(),
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.warn(`Flipkart search returned status ${res.status}`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const results: DiscoveryResult[] = [];

    // Flipkart product container selectors
    const cardSelectors = [
      'div._1AtVbE div[data-id]',
      'div._13oc-S',
      'div._2kHMtA',
      'div._4ddWXP',
      'div._1xHGtK',
    ];

    const cards = $(cardSelectors.join(', '));

    cards.each((_, el) => {
      if (results.length >= limit) return;
      const $card = $(el);

      const linkEl = $card.find('a[href*="/p/"]').first();
      const href = linkEl.attr('href');
      if (!href) return;

      const productUrl = `https://www.flipkart.com${href.split('?')[0]}`;

      // Title
      const title =
        cleanText($card.find('div._4rR01T, a.s1Q9rs, a.IRpwTa, div.KzDlHZ, a.WKTcLC').first().text()) ||
        cleanText(linkEl.attr('title')) ||
        cleanText($card.find('img').first().attr('alt')) ||
        'Flipkart Product';

      // Price
      const priceText = $card.find('div._30jeq3, div.Nx9bqj').first().text();
      const price = parsePrice(priceText);
      if (!price || price <= 0) return;

      // Original price
      const originalText = $card.find('div._3I9_wc, div.yRaY8j').first().text();
      const originalPrice = parsePrice(originalText) || undefined;
      const discountPercent = calculateDiscount(price, originalPrice);

      // Image
      let img = $card.find('img._396cs4, img.DByuf4, img').first().attr('src');
      if (!img || img.startsWith('data:')) {
        img = $card.find('img').first().attr('data-src') || undefined;
      }

      // Rating
      const ratingText = $card.find('div._3LWZlK, div.XQDdHH').first().text();
      const rating = ratingText ? parseFloat(ratingText) : undefined;

      // Brand extraction from title or specific brand tag
      const brand = cleanText($card.find('div._2WkVRV, div.syl9yP').first().text()) || title.split(' ')[0] || undefined;

      results.push({
        id: generateDiscoveryId('flipkart', productUrl),
        title,
        price,
        originalPrice,
        discountPercent,
        brand,
        imageUrl: img,
        productUrl,
        rating: rating && !isNaN(rating) ? rating : undefined,
        platform: 'flipkart',
      });
    });

    return results;
  } catch (err) {
    console.error('Error during Flipkart search:', err);
    return [];
  }
}
