import { NextRequest, NextResponse } from 'next/server';
import { supabase, getServiceSupabase } from '@/lib/supabase';
import { validateAndSanitizeUrl, validateScrapedPrice } from '@/lib/security';
import { scrapeAmazon } from '@scripts/scrapers/amazon';
import { scrapeFlipkart } from '@scripts/scrapers/flipkart';
import { scrapeMeesho } from '@scripts/scrapers/meesho';
import { scrapeMyntra } from '@scripts/scrapers/myntra';
import { scrapeAjio } from '@scripts/scrapers/ajio';
import { scrapeWestside } from '@scripts/scrapers/westside';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function corsResponse(body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || '00000000-0000-0000-0000-000000000000';

    let db;
    try {
      db = getServiceSupabase();
    } catch {
      db = supabase;
    }

    const { data: products, error } = await db
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return corsResponse({ error: error.message }, { status: 500 });
    }

    return corsResponse({ products });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return corsResponse({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      url: rawUrl,
      targetPrice,
      selectedSize,
      selectedColor,
      notes,
      clientPrice,
      clientTitle,
      clientImageUrl,
    } = body;

    // 1. Strict Security & SSRF Validation
    const validation = validateAndSanitizeUrl(rawUrl);
    if (!validation.valid || !validation.cleanUrl || !validation.platform) {
      return corsResponse(
        { error: validation.error || 'Invalid or untrusted URL provided.' },
        { status: 400 }
      );
    }

    const cleanUrl = validation.cleanUrl;
    const platform = validation.platform;

    let db;
    try {
      db = getServiceSupabase();
    } catch {
      db = supabase;
    }

    // Default user ID for personal instance (null allows anonymous tracking without FK violation)
    const defaultUserId = body.userId || null;

    // 2. Check if product already tracked
    const { data: existing } = await db
      .from('products')
      .select('*')
      .eq('url', cleanUrl)
      .maybeSingle();

    if (existing) {
      return corsResponse(
        {
          error: 'This product is already in your watchlist!',
          productId: existing.id,
          product: existing,
        },
        { status: 409 }
      );
    }

    // 3. Scrape initial price and details
    let scrapeRes;
    try {
      if (platform === 'amazon') {
        scrapeRes = await scrapeAmazon(cleanUrl);
      } else if (platform === 'flipkart') {
        scrapeRes = await scrapeFlipkart(cleanUrl);
      } else if (platform === 'meesho') {
        scrapeRes = await scrapeMeesho(cleanUrl);
      } else if (platform === 'myntra') {
        scrapeRes = await scrapeMyntra(cleanUrl);
      } else if (platform === 'ajio') {
        scrapeRes = await scrapeAjio(cleanUrl);
      } else if (platform === 'westside') {
        scrapeRes = await scrapeWestside(cleanUrl);
      }
    } catch (scrapeErr: unknown) {
      console.warn('Scraping error:', scrapeErr);
    }

    let price: number | null = null;
    let title: string = '';
    let imageUrl: string | null = null;
    let bankOffers: unknown[] = [];

    if (scrapeRes && scrapeRes.success && scrapeRes.price) {
      price = scrapeRes.price;
      title = scrapeRes.title || `${platform.toUpperCase()} Product`;
      imageUrl = scrapeRes.imageUrl || null;
      bankOffers = scrapeRes.bankOffers || [];
    } else if (clientPrice && Number(clientPrice) > 0) {
      price = Number(clientPrice);
      title = clientTitle || `${platform.toUpperCase()} Product`;
      imageUrl = clientImageUrl || null;
      bankOffers = [];
    } else {
      return corsResponse(
        {
          error:
            scrapeRes?.error ||
            'Unable to extract price automatically from this link due to store anti-bot protections. Please enter the current price manually or use the PriceWatcher Companion Extension.',
        },
        { status: 422 }
      );
    }

    // 4. Sanity check price
    const sanity = validateScrapedPrice(price);
    if (!sanity.isValid) {
      return corsResponse(
        { error: `Price sanity check failed: ${sanity.reason}` },
        { status: 422 }
      );
    }

    // 5. Insert new product (with graceful schema cache fallback)
    const insertPayload: Record<string, unknown> = {
      user_id: defaultUserId,
      url: cleanUrl,
      platform,
      title,
      image_url: imageUrl,
      current_price: price,
      lowest_price: price,
      highest_price: price,
      target_price: targetPrice ? Number(targetPrice) : null,
      selected_size: selectedSize || null,
      selected_color: selectedColor || null,
      notes: notes || null,
      bank_offers: bankOffers,
      currency: 'INR',
      is_active: true,
      last_checked_at: new Date().toISOString(),
    };

    let product;
    const { data: initialInsert, error: insertError } = await db
      .from('products')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      const isSchemaCacheError =
        insertError.message.includes('schema cache') ||
        insertError.message.includes('bank_offers') ||
        insertError.message.includes('selected_size') ||
        insertError.message.includes('selected_color') ||
        insertError.message.includes('notes') ||
        insertError.code === 'PGRST204';

      if (isSchemaCacheError) {
        // Fallback to core columns in case migration 004 was not yet applied
        const corePayload: Record<string, unknown> = {
          user_id: defaultUserId,
          url: cleanUrl,
          platform,
          title,
          image_url: imageUrl,
          current_price: price,
          lowest_price: price,
          highest_price: price,
          target_price: targetPrice ? Number(targetPrice) : null,
          currency: 'INR',
          is_active: true,
          last_checked_at: new Date().toISOString(),
        };

        const { data: retryProduct, error: retryError } = await db
          .from('products')
          .insert(corePayload)
          .select()
          .single();

        if (retryError) {
          if (
            retryError.message.includes('products_user_id_fkey') ||
            retryError.message.includes('violates not-null constraint')
          ) {
            return corsResponse(
              {
                error:
                  'Database Setup Notice: Please run "supabase/RUN_ALL_PENDING_MIGRATIONS.sql" in your Supabase SQL Editor.',
                details: retryError.message,
              },
              { status: 500 }
            );
          } else if (retryError.message.includes('platform_type')) {
            return corsResponse(
              {
                error:
                  `Database Migration Required: Your Supabase database is missing support for ${platform.toUpperCase()}. Please run the script in "supabase/RUN_ALL_PENDING_MIGRATIONS.sql" in your Supabase SQL Editor to enable all stores.`,
                details: retryError.message,
              },
              { status: 500 }
            );
          }
          return corsResponse({ error: retryError.message }, { status: 500 });
        }
        product = retryProduct;
      } else if (
        insertError.message.includes('products_user_id_fkey') ||
        insertError.message.includes('violates not-null constraint')
      ) {
        return corsResponse(
          {
            error:
              'Database Setup Notice: Please run the SQL in "supabase/RUN_ALL_PENDING_MIGRATIONS.sql" in your Supabase SQL Editor to allow public tracking without auth.',
            details: insertError.message,
          },
          { status: 500 }
        );
      } else if (insertError.message.includes('platform_type')) {
        return corsResponse(
          {
            error:
              `Database Migration Required: Your Supabase database is missing support for ${platform.toUpperCase()}. Please run the script in "supabase/RUN_ALL_PENDING_MIGRATIONS.sql" in your Supabase SQL Editor to enable all stores and features.`,
            details: insertError.message,
          },
          { status: 500 }
        );
      } else {
        return corsResponse({ error: insertError.message }, { status: 500 });
      }
    } else {
      product = initialInsert;
    }

    // 6. Record initial price history entry
    await db.from('price_history').insert({
      product_id: product.id,
      price: price,
      currency: 'INR',
      recorded_at: new Date().toISOString(),
    });

    return corsResponse({ success: true, product }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return corsResponse({ error: `Server error: ${msg}` }, { status: 500 });
  }
}
