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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ products });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url: rawUrl, targetPrice } = body;

    // 1. Strict Security & SSRF Validation
    const validation = validateAndSanitizeUrl(rawUrl);
    if (!validation.valid || !validation.cleanUrl || !validation.platform) {
      return NextResponse.json(
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

    // Default demo user ID for anonymous/public usage
    const defaultUserId = '00000000-0000-0000-0000-000000000000';

    // 2. Check if product already tracked
    const { data: existing } = await db
      .from('products')
      .select('id, title')
      .eq('url', cleanUrl)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'This product is already being tracked in your list!', productId: existing.id },
        { status: 409 }
      );
    }

    // 3. Scrape initial price and details
    let scrapeRes;
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

    if (!scrapeRes || !scrapeRes.success || !scrapeRes.price) {
      return NextResponse.json(
        {
          error:
            scrapeRes?.error ||
            'Unable to extract price from this link. Please check if the product is in stock or try again.',
        },
        { status: 422 }
      );
    }

    // 4. Sanity check price
    const sanity = validateScrapedPrice(scrapeRes.price);
    if (!sanity.isValid) {
      return NextResponse.json(
        { error: `Scraped price sanity check failed: ${sanity.reason}` },
        { status: 422 }
      );
    }

    const price = scrapeRes.price;
    const title = scrapeRes.title || `${platform.toUpperCase()} Product`;
    const imageUrl = scrapeRes.imageUrl || null;

    // 5. Insert new product
    const insertPayload: Record<string, unknown> = {
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

    const { data: product, error: insertError } = await db
      .from('products')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      if (
        insertError.message.includes('products_user_id_fkey') ||
        insertError.message.includes('violates not-null constraint')
      ) {
        return NextResponse.json(
          {
            error:
              'Database Setup Notice: Please run the SQL in "supabase/migrations/002_allow_anonymous_products.sql" (or ALTER TABLE public.products ALTER COLUMN user_id DROP NOT NULL;) in your Supabase SQL Editor to enable public tracking.',
            details: insertError.message,
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 6. Record initial price history entry
    await db.from('price_history').insert({
      product_id: product.id,
      price: price,
      currency: 'INR',
      recorded_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Server error: ${msg}` }, { status: 500 });
  }
}
