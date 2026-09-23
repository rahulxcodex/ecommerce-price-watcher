import { NextRequest, NextResponse } from 'next/server';
import { supabase, getServiceSupabase } from '@/lib/supabase';
import { validateAndSanitizeUrl, validateScrapedPrice } from '@/lib/security';
import { scrapeAmazon } from '@scripts/scrapers/amazon';
import { scrapeFlipkart } from '@scripts/scrapers/flipkart';
import { scrapeMeesho } from '@scripts/scrapers/meesho';

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
    const { data: product, error: insertError } = await db
      .from('products')
      .insert({
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
      })
      .select()
      .single();

    if (insertError) {
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
