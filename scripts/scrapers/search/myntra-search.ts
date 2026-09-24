import * as cheerio from 'cheerio';
import { DiscoveryResult } from '@/types';
import { getRandomUserAgent, parsePrice } from '../utils';
import { calculateDiscount, cleanText, generateDiscoveryId } from './search-utils';

export async function searchMyntra(query: string, limit: number = 15): Promise<DiscoveryResult[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const searchUrl = `https://www.myntra.com/${encodeURIComponent(cleanQ)}`;
  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8',
        'Referer': 'https://www.myntra.com/',
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.warn(`Myntra search returned status ${res.status}`);
      return [];
    }

    const html = await res.text();
    const results: DiscoveryResult[] = [];

    // Strategy 1: Preloaded hydration state script (window.__myx)
    const myxIdx = html.indexOf('window.__myx');
    if (myxIdx !== -1) {
      const pIdx = html.indexOf('"products":', myxIdx);
      if (pIdx !== -1) {
        try {
          const slice = html.slice(pIdx + 11, pIdx + 80000);
          // Find matching end bracket
          let depth = 0;
          let endIdx = -1;
          for (let i = 0; i < slice.length; i++) {
            if (slice[i] === '[') depth++;
            else if (slice[i] === ']') {
              depth--;
              if (depth === 0) {
                endIdx = i + 1;
                break;
              }
            }
          }

          if (endIdx > 0) {
            const rawJson = slice.slice(0, endIdx);
            const prods = JSON.parse(rawJson);

            for (const p of prods) {
              const price = Number(p.price || p.discountedPrice);
              if (!price || isNaN(price) || price <= 0) continue;

              const originalPrice = p.mrp ? Number(p.mrp) : undefined;
              const discountPercent = calculateDiscount(price, originalPrice);
              const brand = cleanText(p.brand || '');
              const name = cleanText(p.productName || p.name || 'Myntra Product');
              const title = brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${name}` : name;
              const productUrl = p.landingPageUrl ? `https://www.myntra.com/${p.landingPageUrl}` : '';
              if (!productUrl) continue;

              const imageUrl = p.searchImage || p.images?.[0]?.src || undefined;
              const rating = p.rating ? Number(p.rating) : undefined;
              const reviewCount = p.ratingCount ? Number(p.ratingCount) : undefined;

              results.push({
                id: generateDiscoveryId('myntra', productUrl),
                title,
                price,
                originalPrice,
                discountPercent,
                brand: brand || undefined,
                imageUrl,
                productUrl,
                rating,
                reviewCount,
                platform: 'myntra',
              });

              if (results.length >= limit) break;
            }

            if (results.length > 0) return results;
          }
        } catch (err) {
          console.warn('Myntra __myx parse warning:', err);
        }
      }
    }

    // Strategy 2: Cheerio DOM parse
    const $ = cheerio.load(html);
    $('li.product-base').each((_, el) => {
      if (results.length >= limit) return;
      const $el = $(el);
      const link = $el.find('a').first().attr('href');
      if (!link) return;

      const productUrl = `https://www.myntra.com/${link.startsWith('/') ? link.slice(1) : link}`;
      const brand = cleanText($el.find('.product-brand').text());
      const name = cleanText($el.find('.product-product').text());
      const title = brand && name ? `${brand} ${name}` : name || brand || 'Myntra Product';

      const priceText = $el.find('.product-discountedPrice, .product-price').first().text();
      const price = parsePrice(priceText);
      if (!price || price <= 0) return;

      const originalText = $el.find('.product-strike').first().text();
      const originalPrice = parsePrice(originalText) || undefined;
      const discountPercent = calculateDiscount(price, originalPrice);

      const img = $el.find('img').first().attr('src');

      results.push({
        id: generateDiscoveryId('myntra', productUrl),
        title,
        price,
        originalPrice,
        discountPercent,
        brand: brand || undefined,
        imageUrl: img,
        productUrl,
        platform: 'myntra',
      });
    });

    return results;
  } catch (err) {
    console.error('Error during Myntra search:', err);
    return [];
  }
}
