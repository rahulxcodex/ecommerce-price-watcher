import { DiscoveryResult } from '@/types';
import { getRandomUserAgent } from '../utils';
import { calculateDiscount, cleanText, generateDiscoveryId } from './search-utils';

export async function searchAjio(query: string, limit: number = 15): Promise<DiscoveryResult[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const pageSize = Math.min(20, Math.max(10, limit));
  const searchUrl = `https://www.ajio.com/api/search?fields=DEFAULT&query=${encodeURIComponent(cleanQ)}&pageSize=${pageSize}`;

  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.ajio.com/',
        'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8',
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.warn(`Ajio search API responded with status ${res.status}`);
      return [];
    }

    const data = await res.json();
    const products = data.products || [];
    const results: DiscoveryResult[] = [];

    for (const p of products) {
      if (!p || !p.price || !p.price.value) continue;

      const price = Number(p.price.value);
      if (isNaN(price) || price <= 0) continue;

      const originalPrice = p.wasPriceData?.value ? Number(p.wasPriceData.value) : undefined;
      const discountPercent = calculateDiscount(price, originalPrice);
      const brand = p.fnlColorVariantData?.brandName || p.brandName || undefined;
      const name = cleanText(p.name || 'Ajio Product');
      const title = brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${name}` : name;

      let productUrl = p.url ? `https://www.ajio.com${p.url.startsWith('/') ? '' : '/'}${p.url}` : '';
      if (!productUrl && p.code) {
        productUrl = `https://www.ajio.com/p/${p.code}`;
      }
      if (!productUrl) continue;

      const imageUrl =
        p.images?.[0]?.url ||
        p.fnlColorVariantData?.outfitPictureURL ||
        undefined;

      const rating = p.averageRating ? Number(p.averageRating) : undefined;
      const reviewCount = p.ratingCount ? Number(p.ratingCount) : undefined;

      results.push({
        id: generateDiscoveryId('ajio', productUrl),
        title,
        price,
        originalPrice,
        discountPercent,
        brand,
        imageUrl,
        productUrl,
        rating,
        reviewCount,
        platform: 'ajio',
      });

      if (results.length >= limit) break;
    }

    return results;
  } catch (err) {
    console.error('Error during Ajio search:', err);
    return [];
  }
}
