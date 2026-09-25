import { NextRequest, NextResponse } from 'next/server';
import { supabase, getServiceSupabase } from '@/lib/supabase';
import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { searchPlatform, sanitizeSearchQuery } from '@scripts/scrapers/search';
import { rankFilterFacets } from '@/lib/dsa';
import { Platform, SmartFilterFacets } from '@/types';

export const dynamic = 'force-dynamic';

const VALID_PLATFORMS: Platform[] = ['amazon', 'flipkart', 'meesho', 'myntra', 'ajio', 'westside'];

function getDb() {
  try {
    return getServiceSupabase();
  } catch {
    return supabase;
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1. Parse request body
    const body = await req.json().catch(() => ({}));
    const { platform, query, limit = 15, brand, isFilterExpansion = false } = body;

    // 2. Identify client for rate limiting (higher limit for filter expansions & authenticated users)
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = verifySessionToken(token || '');
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    const rateLimitKey = session?.userId || session?.name || clientIp;

    const maxRateRequests = isFilterExpansion || session ? 30 : 10;
    const rateLimitResult = await checkRateLimit(`search:${rateLimitKey}`, maxRateRequests, 60);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit reached. Max ${maxRateRequests} searches per minute. Please wait ${rateLimitResult.retryAfterSeconds} seconds.`,
          retryAfter: rateLimitResult.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfterSeconds),
          },
        }
      );
    }

    if (!platform || !VALID_PLATFORMS.includes(platform as Platform)) {
      return NextResponse.json(
        { success: false, error: 'Invalid platform selected.' },
        { status: 400 }
      );
    }

    const cleanQuery = sanitizeSearchQuery(query || '');
    if (!cleanQuery || cleanQuery.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Search query must be at least 2 characters long.' },
        { status: 400 }
      );
    }

    // 3. Execute Platform Search Scraper
    // When filtering, dynamically scrape more SKUs by targeting brand query expansion
    const cleanBrand = typeof brand === 'string' ? brand.trim() : '';
    const targetedQuery = cleanBrand && !cleanQuery.toLowerCase().includes(cleanBrand.toLowerCase())
      ? `${cleanBrand} ${cleanQuery}`
      : cleanQuery;

    const boundedLimit = Math.min(25, Math.max(5, Number(limit) || 15));
    const results = await searchPlatform(platform as Platform, targetedQuery, boundedLimit);

    // 4. Cross-reference with existing watchlist
    const db = getDb();
    if (results.length > 0) {
      const urls = results.map((r) => r.productUrl);
      try {
        const { data: existingProducts } = await db
          .from('products')
          .select('url')
          .in('url', urls);

        if (existingProducts && existingProducts.length > 0) {
          const trackedUrls = new Set(existingProducts.map((p) => p.url));
          results.forEach((r) => {
            if (trackedUrls.has(r.productUrl)) {
              r.isAlreadyTracked = true;
            }
          });
        }
      } catch (err) {
        console.warn('Could not check existing tracked URLs:', err);
      }
    }

    // 5. Compute dynamic smart facets from actual results
    const brandMap: Record<string, number> = {};
    let minPrice = Infinity;
    let maxPrice = 0;
    const discountCounts: Record<number, number> = { 10: 0, 20: 0, 30: 0, 50: 0 };
    const ratingCounts: Record<number, number> = { 4: 0, 4.5: 0 };

    results.forEach((p) => {
      if (p.brand) {
        brandMap[p.brand] = (brandMap[p.brand] || 0) + 1;
      }
      if (p.price < minPrice) minPrice = p.price;
      if (p.price > maxPrice) maxPrice = p.price;

      const disc = p.discountPercent ?? 0;
      if (disc >= 10) discountCounts[10]++;
      if (disc >= 20) discountCounts[20]++;
      if (disc >= 30) discountCounts[30]++;
      if (disc >= 50) discountCounts[50]++;

      const rat = p.rating ?? 0;
      if (rat >= 4.0) ratingCounts[4]++;
      if (rat >= 4.5) ratingCounts[4.5]++;
    });

    const facets: SmartFilterFacets = {
      brands: Object.entries(brandMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      priceRange: {
        min: minPrice === Infinity ? 0 : Math.floor(minPrice),
        max: maxPrice === 0 ? 10000 : Math.ceil(maxPrice),
      },
      discountRanges: [
        { label: '10%+ Off', min: 10, count: discountCounts[10] },
        { label: '20%+ Off', min: 20, count: discountCounts[20] },
        { label: '30%+ Off', min: 30, count: discountCounts[30] },
        { label: '50%+ Off', min: 50, count: discountCounts[50] },
      ],
      ratings: [
        { minRating: 4.0, count: ratingCounts[4] },
        { minRating: 4.5, count: ratingCounts[4.5] },
      ],
    };

    // 6. Rank facets by Shannon Information Gain
    const facetRanking = rankFilterFacets(results);

    // 7. Save search query into search_history (only for primary searches, not filter expansions)
    if (!isFilterExpansion) {
      try {
        await db.from('search_history').insert({
          user_id: session?.userId || null,
          created_by_name: session?.name || null,
          platform,
          query: cleanQuery,
          result_count: results.length,
        });
      } catch (histErr) {
        console.warn('Failed to insert into search_history:', histErr);
      }
    }

    return NextResponse.json({
      success: true,
      results,
      facets,
      facetRanking,
      count: results.length,
      platform,
      query: cleanQuery,
      remainingRateLimit: rateLimitResult.remaining,
    });
  } catch (err: unknown) {
    console.error('Error during discover search API:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Search failed' },
      { status: 500 }
    );
  }
}
