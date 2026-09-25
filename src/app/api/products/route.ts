import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { supabase, getServiceSupabase } from '@/lib/supabase';
import { validateAndSanitizeUrl, validateScrapedPrice, deriveTitleFromUrl } from '@/lib/security';
import { scrapeAmazon } from '@scripts/scrapers/amazon';
import { scrapeFlipkart } from '@scripts/scrapers/flipkart';
import { scrapeMeesho } from '@scripts/scrapers/meesho';
import { scrapeMyntra } from '@scripts/scrapers/myntra';
import { scrapeAjio } from '@scripts/scrapers/ajio';
import { scrapeWestside } from '@scripts/scrapers/westside';
import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

function getAllowedOrigin(origin: string | null, host: string | null): string | null {
  if (!origin) return null;

  // 1. Chrome extension origins
  if (origin.startsWith('chrome-extension://')) {
    return origin;
  }

  // 2. Same-origin match against Host header
  if (host) {
    try {
      const parsedOrigin = new URL(origin);
      if (parsedOrigin.host === host) {
        return origin;
      }
    } catch {}
  }

  // 3. Localhost / local IP for development & tests
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return origin;
  }

  // 4. Configured App URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      const parsedApp = new URL(appUrl);
      if (parsedApp.origin === origin) {
        return origin;
      }
    } catch {}
  }

  // 5. Vercel deployment URL
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl && origin === `https://${vercelUrl}`) {
    return origin;
  }

  return null;
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  const allowedOrigin = getAllowedOrigin(origin, host);

  if (origin && !allowedOrigin) {
    return new NextResponse(null, { status: 403 });
  }

  const responseHeaders: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };

  if (allowedOrigin) {
    responseHeaders['Access-Control-Allow-Origin'] = allowedOrigin;
    responseHeaders['Access-Control-Allow-Credentials'] = 'true';
  }

  return new NextResponse(null, {
    status: 204,
    headers: responseHeaders,
  });
}

function corsResponse(body: unknown, init?: ResponseInit, req?: NextRequest) {
  let origin: string | null = null;
  let host: string | null = null;

  if (req) {
    origin = req.headers.get('origin');
    host = req.headers.get('host');
  } else {
    try {
      const h = headers();
      origin = h.get('origin');
      host = h.get('host');
    } catch {}
  }

  // Block unauthorized cross-origin requests
  if (origin) {
    const allowed = getAllowedOrigin(origin, host);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Cross-origin request blocked by CORS security policy.' },
        { status: 403 }
      );
    }
  }

  const res = NextResponse.json(body, init);
  const allowedOrigin = getAllowedOrigin(origin, host);
  if (allowedOrigin) {
    res.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    res.headers.set('Access-Control-Allow-Credentials', 'true');
  }
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.headers.set('Vary', 'Origin');
  return res;
}

function isValidUuid(id: string | null | undefined): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = verifySessionToken(token || '');

    let db;
    try {
      db = getServiceSupabase();
    } catch {
      db = supabase;
    }

    let query = db.from('products').select('*');

    // If logged in as regular user (not combined access), restrict to user's products
    if (session && !session.isCombined) {
      if (isValidUuid(session.userId)) {
        query = query.eq('user_id', session.userId);
      } else if (session.name) {
        query = query.eq('created_by_name', session.name);
      }
    }

    let { data: products, error } = await query.order('created_at', { ascending: false });

    // Graceful fallback if database column is uuid type and rejected non-uuid query string
    if (error && error.message.includes('invalid input syntax for type uuid')) {
      console.warn('Handling uuid type mismatch in products query, retrying safely...');
      const fallbackQuery = session && !session.isCombined && session.name
        ? db.from('products').select('*').eq('created_by_name', session.name)
        : db.from('products').select('*');
      const fallbackRes = await fallbackQuery.order('created_at', { ascending: false });
      products = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error) {
      return corsResponse({ error: error.message }, { status: 500 });
    }

    return corsResponse({
      products,
      isCombinedAccess: session?.isCombined || false,
      user: session ? { id: session.userId, name: session.name, isCombined: session.isCombined } : null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return corsResponse({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'anon';
    const rateCheck = await checkRateLimit(`rate:products:post:${ip}`, 15, 60);
    if (!rateCheck.allowed) {
      return corsResponse(
        { error: `Too many requests. Please wait ${rateCheck.retryAfterSeconds} seconds before adding more products.` },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfterSeconds) } },
        req
      );
    }

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

    // Extract user from session cookie
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = verifySessionToken(token || '');
    const rawUserId = session?.userId || body.userId || null;
    const defaultUserId = isValidUuid(rawUserId) ? rawUserId : null;
    const createdByName = session?.name || body.createdByName || null;

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
      title = (scrapeRes.title && !scrapeRes.title.endsWith('Product'))
        ? scrapeRes.title
        : deriveTitleFromUrl(cleanUrl, platform) || scrapeRes.title || `${platform.toUpperCase()} Product`;
      imageUrl = scrapeRes.imageUrl || null;
      bankOffers = scrapeRes.bankOffers || [];
    } else if (clientPrice && Number(clientPrice) > 0) {
      price = Number(clientPrice);
      title = clientTitle || deriveTitleFromUrl(cleanUrl, platform) || `${platform.toUpperCase()} Product`;
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
    // 5. Insert new product with authoritative schema fields
    const nowIso = new Date().toISOString();
    const isClientSupplied = Boolean(clientPrice && Number(clientPrice) > 0);
    const insertPayload: Record<string, unknown> = {
      user_id: defaultUserId,
      created_by_name: createdByName,
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
      price_source: isClientSupplied ? 'browser_extension' : 'server_scrape',
      version: 1,
      last_attempted_at: nowIso,
      last_successful_scrape_at: nowIso,
      last_checked_at: nowIso,
    };

    const { data: product, error: insertError } = await db
      .from('products')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      console.error('[API products POST] Database insertion error:', insertError);
      return corsResponse(
        { error: 'Unable to track product. Please verify database migrations are current.' },
        { status: 500 }
      );
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
