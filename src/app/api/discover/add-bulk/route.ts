import { NextRequest, NextResponse } from 'next/server';
import { supabase, getServiceSupabase } from '@/lib/supabase';
import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { validateAndSanitizeUrl } from '@/lib/security';
import { Platform } from '@/types';

export const dynamic = 'force-dynamic';

function getDb() {
  try {
    return getServiceSupabase();
  } catch {
    return supabase;
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = verifySessionToken(token || '');
    const userId = session?.userId || null;
    const createdByName = session?.name || null;

    const body = await req.json().catch(() => ({}));
    const rawProducts = body.products;

    if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Products array is required and must not be empty.' },
        { status: 400 }
      );
    }

    // Enforce 15-product bulk-add cap per request
    if (rawProducts.length > 15) {
      return NextResponse.json(
        { success: false, error: 'Maximum 15 products can be bulk added in a single request.' },
        { status: 400 }
      );
    }

    const db = getDb();
    const validItems: Array<{
      url: string;
      platform: Platform;
      title: string;
      current_price: number;
      lowest_price: number;
      highest_price: number;
      currency: string;
      image_url: string | null;
      user_id: string | null;
      created_by_name: string | null;
      is_active: boolean;
      check_status: 'ok';
      price_source: 'browser_extension';
      version: number;
      last_attempted_at: string;
      last_successful_scrape_at: string;
      last_checked_at: string;
    }> = [];

    const skippedUrls: string[] = [];

    const nowIso = new Date().toISOString();

    for (const item of rawProducts) {
      if (!item.url || typeof item.url !== 'string') continue;
      if (item.url.length > 2048) {
        skippedUrls.push(item.url.slice(0, 100));
        continue;
      }

      const urlValidation = validateAndSanitizeUrl(item.url);
      if (!urlValidation.valid || !urlValidation.cleanUrl) {
        skippedUrls.push(item.url);
        continue;
      }

      const cleanUrl = urlValidation.cleanUrl;
      const platform = (item.platform || urlValidation.platform) as Platform;
      const price = Number(item.price);
      if (!price || isNaN(price) || price <= 0) {
        skippedUrls.push(cleanUrl);
        continue;
      }

      validItems.push({
        url: cleanUrl,
        platform,
        title: (item.title || `${platform.toUpperCase()} Product`).slice(0, 500),
        current_price: price,
        lowest_price: price,
        highest_price: item.originalPrice && Number(item.originalPrice) > price ? Number(item.originalPrice) : price,
        currency: 'INR',
        image_url: item.imageUrl ? String(item.imageUrl).slice(0, 2048) : null,
        user_id: userId,
        created_by_name: createdByName,
        is_active: true,
        check_status: 'ok',
        price_source: 'browser_extension',
        version: 1,
        last_attempted_at: nowIso,
        last_successful_scrape_at: nowIso,
        last_checked_at: nowIso,
      });
    }

    if (validItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid products were provided to add.' },
        { status: 400 }
      );
    }

    // Query existing to prevent duplication
    const allCleanUrls = validItems.map((v) => v.url);
    const { data: existingRows } = await db
      .from('products')
      .select('url')
      .in('url', allCleanUrls);

    const existingSet = new Set((existingRows || []).map((r) => r.url));
    const toInsert = validItems.filter((v) => !existingSet.has(v.url));

    if (toInsert.length === 0) {
      return NextResponse.json({
        success: true,
        addedCount: 0,
        skippedCount: validItems.length,
        message: 'All selected products are already being tracked in your watchlist.',
      });
    }

    // Bulk insert into products table
    const { data: insertedProducts, error: insertErr } = await db
      .from('products')
      .insert(toInsert)
      .select();

    if (insertErr) {
      console.error('Failed to bulk insert products:', insertErr);
      return NextResponse.json(
        { success: false, error: insertErr.message },
        { status: 500 }
      );
    }

    // Record initial price history entries
    if (insertedProducts && insertedProducts.length > 0) {
      const historyRows = insertedProducts.map((p) => ({
        product_id: p.id,
        price: p.current_price,
        currency: p.currency || 'INR',
      }));

      try {
        await db.from('price_history').insert(historyRows);
      } catch (histErr) {
        console.warn('Could not record initial price history:', histErr);
      }
    }

    return NextResponse.json({
      success: true,
      addedCount: insertedProducts ? insertedProducts.length : 0,
      skippedCount: existingSet.size + skippedUrls.length,
      products: insertedProducts || [],
    });
  } catch (err: unknown) {
    console.error('Error during bulk add:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Bulk add failed' },
      { status: 500 }
    );
  }
}
