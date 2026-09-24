import * as cheerio from 'cheerio';
import { DiscoveryResult } from '@/types';
import { getDefaultHeaders, parsePrice } from '../utils';
import { calculateDiscount, cleanText, generateDiscoveryId } from './search-utils';

export async function searchAmazon(query: string, limit: number = 15): Promise<DiscoveryResult[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const searchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(cleanQ)}`;

  try {
    const res = await fetch(searchUrl, {
      headers: {
        ...getDefaultHeaders(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Referer': 'https://www.amazon.in/',
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.warn(`Amazon search returned status ${res.status}`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Check for CAPTCHA
    const titleText = $('title').text().toLowerCase();
    if (titleText.includes('robot check') || titleText.includes('captcha')) {
      console.warn('Amazon bot verification triggered on search');
      return [];
    }

    const results: DiscoveryResult[] = [];

    $('div[data-component-type="s-search-result"]').each((_, el) => {
      if (results.length >= limit) return;
      const $card = $(el);
      const asin = $card.attr('data-asin');
      if (!asin || asin.length !== 10) return;

      const productUrl = `https://www.amazon.in/dp/${asin}`;

      // Title
      const title =
        cleanText($card.find('h2 a span, h2 span, a.a-link-normal .a-text-normal').first().text()) ||
        'Amazon Product';

      // Price
      const priceText = $card.find('.a-price .a-offscreen, .a-price-whole').first().text();
      const price = parsePrice(priceText);
      if (!price || price <= 0) return;

      // Original/MRP Price
      const originalText = $card.find('.a-text-price .a-offscreen, span.a-price.a-text-price').first().text();
      const originalPrice = parsePrice(originalText) || undefined;
      const discountPercent = calculateDiscount(price, originalPrice);

      // Image
      const img = $card.find('img.s-image').first().attr('src') || undefined;

      // Rating
      let rating: number | undefined;
      const ratingLabel = $card.find('i.a-icon-star-small span, span[aria-label*="stars"]').first().attr('aria-label') ||
        $card.find('i.a-icon-star-small span').first().text();
      if (ratingLabel) {
        const match = ratingLabel.match(/([\d.]+)\s*out of/i);
        if (match) rating = parseFloat(match[1]);
      }

      // Review count
      let reviewCount: number | undefined;
      const reviewText = $card.find('span[aria-label*="ratings"], a[href*="#customerReviews"] span').first().text();
      if (reviewText) {
        const rMatch = reviewText.replace(/,/g, '').match(/\d+/);
        if (rMatch) reviewCount = parseInt(rMatch[0], 10);
      }

      // Brand
      const brand = title.split(' ')[0] || 'Amazon';

      results.push({
        id: generateDiscoveryId('amazon', productUrl),
        title,
        price,
        originalPrice,
        discountPercent,
        brand,
        imageUrl: img,
        productUrl,
        rating,
        reviewCount,
        platform: 'amazon',
      });
    });

    return results;
  } catch (err) {
    console.error('Error during Amazon search:', err);
    return [];
  }
}
