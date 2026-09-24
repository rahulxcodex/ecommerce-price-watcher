import * as cheerio from 'cheerio';
import { DiscoveryResult } from '@/types';
import { getDefaultHeaders, parsePrice } from '../utils';
import { calculateDiscount, cleanText, generateDiscoveryId } from './search-utils';

export async function searchMeesho(query: string, limit: number = 15): Promise<DiscoveryResult[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  try {
    const searchUrl = `https://www.meesho.com/search?q=${encodeURIComponent(cleanQ)}`;
    const res = await fetch(searchUrl, {
      headers: getDefaultHeaders(),
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.warn(`Meesho search returned status ${res.status}`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const results: DiscoveryResult[] = [];

    // Strategy 1: Check __NEXT_DATA__
    const nextDataRaw = $('#__NEXT_DATA__').html();
    if (nextDataRaw) {
      try {
        const nextData = JSON.parse(nextDataRaw);
        const productList =
          nextData?.props?.pageProps?.initialState?.search?.products ||
          nextData?.props?.pageProps?.initialState?.plp?.products ||
          nextData?.props?.pageProps?.products ||
          [];

        for (const p of productList) {
          const price = Number(p.discounted_price || p.price || p.selling_price);
          if (!price || isNaN(price) || price <= 0) continue;

          const originalPrice = p.original_price || p.mrp ? Number(p.original_price || p.mrp) : undefined;
          const discountPercent = calculateDiscount(price, originalPrice);
          const title = cleanText(p.name || p.title || 'Meesho Product');
          const imageUrl = p.images?.[0] || p.valid_images?.[0] || undefined;
          const productUrl = p.id ? `https://www.meesho.com/s/p/${p.id}` : p.slug ? `https://www.meesho.com/${p.slug}/p` : '';
          if (!productUrl) continue;

          const rating = p.rating?.average_rating ? Number(p.rating.average_rating) : undefined;
          const reviewCount = p.rating?.rating_count ? Number(p.rating.rating_count) : undefined;

          results.push({
            id: generateDiscoveryId('meesho', productUrl),
            title,
            price,
            originalPrice,
            discountPercent,
            brand: 'Meesho',
            imageUrl,
            productUrl,
            rating,
            reviewCount,
            platform: 'meesho',
          });

          if (results.length >= limit) break;
        }

        if (results.length > 0) return results;
      } catch (err) {
        console.warn('Meesho __NEXT_DATA__ parse warning:', err);
      }
    }

    // Strategy 2: DOM fallback
    $('a[href*="/p/"]').each((_, el) => {
      if (results.length >= limit) return;
      const $el = $(el);
      const href = $el.attr('href');
      if (!href) return;

      const productUrl = href.startsWith('http') ? href : `https://www.meesho.com${href}`;
      const title = cleanText($el.find('p, span, h5').first().text()) || 'Meesho Product';
      const priceMatch = $el.text().match(/₹\s*([\d,]+)/);
      if (!priceMatch) return;

      const price = parsePrice(priceMatch[1]);
      if (!price || price <= 0) return;

      const img = $el.find('img').first().attr('src');

      results.push({
        id: generateDiscoveryId('meesho', productUrl),
        title,
        price,
        brand: 'Meesho',
        imageUrl: img,
        productUrl,
        platform: 'meesho',
      });
    });

    return results;
  } catch (err) {
    console.error('Error during Meesho search:', err);
    return [];
  }
}
