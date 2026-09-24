import * as cheerio from 'cheerio';
import { DiscoveryResult } from '@/types';
import { getDefaultHeaders, getRandomUserAgent, parsePrice } from '../utils';
import { calculateDiscount, cleanText, generateDiscoveryId } from './search-utils';

export async function searchWestside(query: string, limit: number = 15): Promise<DiscoveryResult[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  // Strategy 1: Shopify Predictive Search API (Fast, structured JSON)
  try {
    const suggestUrl = `https://www.westside.com/search/suggest.json?q=${encodeURIComponent(cleanQ)}&resources[type]=product&resources[limit]=${limit}&resources[options][unavailable_products]=last`;
    const res = await fetch(suggestUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'application/json, text/javascript, */*',
        'Referer': 'https://www.westside.com/',
      },
      next: { revalidate: 3600 },
    });

    if (res.ok) {
      const data = await res.json();
      const products = data.resources?.results?.products || [];
      if (products.length > 0) {
        const results: DiscoveryResult[] = [];
        for (const p of products) {
          if (!p.title || !p.price) continue;

          // Shopify suggest prices are formatted floats or numeric strings
          const price = typeof p.price === 'number' ? p.price : parsePrice(String(p.price));
          if (!price || price <= 0) continue;

          const originalPrice = p.compare_at_price ? (typeof p.compare_at_price === 'number' ? p.compare_at_price : parsePrice(String(p.compare_at_price))) : undefined;
          const discountPercent = calculateDiscount(price, originalPrice || undefined);

          let productUrl = p.url ? `https://www.westside.com${p.url.startsWith('/') ? '' : '/'}${p.url.split('?')[0]}` : '';
          if (!productUrl) continue;

          let imageUrl = p.image || p.featured_image?.url || undefined;
          if (imageUrl && imageUrl.startsWith('//')) {
            imageUrl = `https:${imageUrl}`;
          }

          results.push({
            id: generateDiscoveryId('westside', productUrl),
            title: cleanText(p.title),
            price,
            originalPrice: originalPrice || undefined,
            discountPercent,
            brand: p.vendor || 'Westside',
            imageUrl,
            productUrl,
            platform: 'westside',
          });

          if (results.length >= limit) break;
        }

        if (results.length > 0) return results;
      }
    }
  } catch (err) {
    console.warn('Westside Shopify suggest error:', err);
  }

  // Strategy 2: HTML Search Page Scraping
  try {
    const searchUrl = `https://www.westside.com/search?q=${encodeURIComponent(cleanQ)}&type=product`;
    const res = await fetch(searchUrl, {
      headers: getDefaultHeaders(),
      next: { revalidate: 3600 },
    });

    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const results: DiscoveryResult[] = [];

    // Find product card elements on Shopify storefront
    $('div.product-card, div.grid-product, div.product-item, div.card').each((_, el) => {
      if (results.length >= limit) return;

      const $el = $(el);
      const linkEl = $el.find('a[href*="/products/"]').first();
      const href = linkEl.attr('href');
      if (!href) return;

      const productUrl = `https://www.westside.com${href.startsWith('/') ? '' : '/'}${href.split('?')[0]}`;
      const title = cleanText($el.find('.product-card__title, .grid-product__title, .product-title, h3, h2').first().text()) || 'Westside Product';
      
      const priceText = $el.find('.price, .product-card__price, .price-item--sale, .money').first().text();
      const price = parsePrice(priceText);
      if (!price || price <= 0) return;

      const compareText = $el.find('.price-item--regular, .compare-at-price, s.price').first().text();
      const originalPrice = parsePrice(compareText) || undefined;
      const discountPercent = calculateDiscount(price, originalPrice);

      let img = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
      if (img && img.startsWith('//')) img = `https:${img}`;

      results.push({
        id: generateDiscoveryId('westside', productUrl),
        title,
        price,
        originalPrice,
        discountPercent,
        brand: 'Westside',
        imageUrl: img,
        productUrl,
        platform: 'westside',
      });
    });

    return results;
  } catch (err) {
    console.error('Error during Westside search:', err);
    return [];
  }
}
