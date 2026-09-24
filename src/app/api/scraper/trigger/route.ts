import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { getServiceSupabase } from '@/lib/supabase';
import { supabase as publicSupabase } from '@/lib/supabase';
import { scrapeAmazon } from '@scripts/scrapers/amazon';
import { scrapeFlipkart } from '@scripts/scrapers/flipkart';
import { scrapeMeesho } from '@scripts/scrapers/meesho';
import { scrapeMyntra } from '@scripts/scrapers/myntra';
import { scrapeAjio } from '@scripts/scrapers/ajio';
import { scrapeWestside } from '@scripts/scrapers/westside';
import { delay } from '@scripts/scrapers/utils';
import { dispatchAlerts, sendScraperFailureAlert, sendScraperStaleAlert } from '@scripts/notify';
import { validateScrapedPrice } from '@/lib/security';
import { Product, AppSettings } from '@/types';
import { getAdminEmail } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for serverless execution

function getDbClient() {
  try {
    return getServiceSupabase();
  } catch {
    return publicSupabase;
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const db = getDbClient();
    let body: { productId?: string; limit?: number } = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    // 1. Verify user session:
    // Single product refresh is permitted for any authenticated session.
    // Full batch scraper trigger is restricted strictly to rahulr24g@gmail.com / combined account.
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = verifySessionToken(token || '');

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized: Please log in to refresh prices.',
        },
        { status: 401 }
      );
    }

    const adminEmail = getAdminEmail().toLowerCase().trim();
    const isAuthorized =
      Boolean(session?.isCombined) ||
      session?.email?.toLowerCase().trim() === adminEmail;

    if (!body.productId && !isAuthorized) {
      return NextResponse.json(
        {
          success: false,
          error: `Forbidden: Manual batch scraper trigger is exclusively available to authorized account (${adminEmail}).`,
        },
        { status: 403 }
      );
    }

    // 2. Fetch active products
    let query = db.from('products').select('*').eq('is_active', true);
    if (body.productId) {
      query = query.eq('id', body.productId);
    } else {
      query = query.order('last_checked_at', { ascending: true, nullsFirst: true }).limit(body.limit || 15);
    }

    const { data: productsData, error: prodErr } = await query;
    if (prodErr || !productsData || productsData.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active products found to scrape.',
        checkedCount: 0,
        priceDropCount: 0,
        errorCount: 0,
        durationMs: Date.now() - startTime,
      });
    }

    const products = productsData as Product[];

    // 3. Watchdog check: Has scraping completed in the last 3 hours?
    const checkedTimestamps = products
      .map((p) => (p.last_checked_at ? new Date(p.last_checked_at).getTime() : 0))
      .filter((t) => t > 0);
    const mostRecentCheck = checkedTimestamps.length > 0 ? Math.max(...checkedTimestamps) : 0;

    if (mostRecentCheck > 0) {
      const elapsedHours = (Date.now() - mostRecentCheck) / (1000 * 60 * 60);
      if (elapsedHours >= 5.0) {
        console.warn(`🚨 WATCHDOG: Last scrape was ${elapsedHours.toFixed(1)}h ago (>= 5h threshold). Dispatching alert...`);
        await sendScraperStaleAlert({
          hoursSinceLastScrape: Math.round(elapsedHours * 10) / 10,
          lastScrapedAt: new Date(mostRecentCheck).toISOString(),
          totalActiveProducts: products.length,
          to: getAdminEmail(),
        });
      }
    }

    // 4. Fetch notification settings
    const { data: appSettings } = await db
      .from('app_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    const appSettingsConfig: Partial<AppSettings> = appSettings || {
      telegram_chat_id: process.env.TELEGRAM_CHAT_ID || null,
      whatsapp_phone: process.env.WHATSAPP_PHONE || null,
      whatsapp_apikey: process.env.WHATSAPP_API_KEY || null,
      email: process.env.APPSCRIPT_TO_EMAIL || getAdminEmail(),
      discord_webhook: process.env.DISCORD_WEBHOOK_URL || null,
      ntfy_topic: process.env.NTFY_TOPIC || null,
      notification_preference: 'all_time_low',
    };

    let checkedCount = 0;
    let priceDropCount = 0;
    let errorCount = 0;
    const resultsSummary: Array<{ id: string; title: string; status: string; price?: number }> = [];

    // 5. Scrape each product with 2-attempt retry
    for (const product of products) {
      checkedCount++;
      const MAX_ATTEMPTS = 2;
      let scrapeRes: { success?: boolean; price?: number; error?: string; isOutOfStock?: boolean; imageUrl?: string } | null = null;
      let attemptsMade = 0;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        attemptsMade = attempt;
        try {
          if (product.platform === 'amazon') {
            scrapeRes = await scrapeAmazon(product.url);
          } else if (product.platform === 'flipkart') {
            scrapeRes = await scrapeFlipkart(product.url);
          } else if (product.platform === 'meesho') {
            scrapeRes = await scrapeMeesho(product.url);
          } else if (product.platform === 'myntra') {
            scrapeRes = await scrapeMyntra(product.url);
          } else if (product.platform === 'ajio') {
            scrapeRes = await scrapeAjio(product.url);
          } else if (product.platform === 'westside') {
            scrapeRes = await scrapeWestside(product.url);
          } else {
            break;
          }
        } catch (e: unknown) {
          scrapeRes = { success: false, error: String(e) };
        }

        if (scrapeRes && (scrapeRes.success || scrapeRes.isOutOfStock)) {
          break;
        }

        if (attempt < MAX_ATTEMPTS) {
          await delay(2000);
        }
      }

      // Out of stock
      if (scrapeRes && scrapeRes.isOutOfStock) {
        await db
          .from('products')
          .update({
            check_status: 'out_of_stock',
            error_message: null,
            last_checked_at: new Date().toISOString(),
          })
          .eq('id', product.id);
        resultsSummary.push({ id: product.id, title: product.title, status: 'out_of_stock' });
        continue;
      }

      // Scraper extraction failure
      if (!scrapeRes || !scrapeRes.success || !scrapeRes.price || scrapeRes.price <= 0) {
        errorCount++;
        const errorMessage = scrapeRes?.error || 'Failed to extract price after 2 attempts';
        await db
          .from('products')
          .update({
            check_status: 'error',
            error_message: errorMessage,
            last_checked_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        // Dispatch failure email alert
        await sendScraperFailureAlert({
          productTitle: product.title,
          productUrl: product.url,
          platform: product.platform,
          error: errorMessage,
          retryAttempts: attemptsMade,
          to: getAdminEmail(),
        });

        resultsSummary.push({ id: product.id, title: product.title, status: 'error' });
        continue;
      }

      const newPrice = scrapeRes.price;

      // Sanity check
      const sanity = validateScrapedPrice(newPrice, product.current_price);
      if (!sanity.isValid) {
        errorCount++;
        const sanityReason = `Sanity check: ${sanity.reason}`;
        await db
          .from('products')
          .update({
            check_status: 'error',
            error_message: sanityReason,
            last_checked_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        await sendScraperFailureAlert({
          productTitle: product.title,
          productUrl: product.url,
          platform: product.platform,
          error: sanityReason,
          retryAttempts: attemptsMade,
          to: getAdminEmail(),
        });
        resultsSummary.push({ id: product.id, title: product.title, status: 'sanity_failed' });
        continue;
      }

      // Update price history and product state
      const wasOutOfStock = product.check_status === 'out_of_stock';
      const isBackInStock = wasOutOfStock && newPrice > 0;
      const isPriceDrop = newPrice < product.current_price;
      const isAllTimeLow = isPriceDrop && newPrice < product.lowest_price;
      const isHitTarget = product.target_price !== null && newPrice <= product.target_price;

      const newLowest = Math.min(product.lowest_price, newPrice);
      const newHighest = Math.max(product.highest_price, newPrice);

      const hasAlreadyAlertedThisPrice = product.last_alerted_price !== null && product.last_alerted_price === newPrice;
      const preference = appSettingsConfig.notification_preference || 'all_time_low';

      const shouldAlert =
        !hasAlreadyAlertedThisPrice &&
        (isBackInStock ||
          isAllTimeLow ||
          (isHitTarget && isPriceDrop) ||
          (isPriceDrop && preference === 'any_drop'));

      let newLastAlerted = product.last_alerted_price;
      if (shouldAlert) {
        priceDropCount++;
        newLastAlerted = newPrice;
        await dispatchAlerts(appSettingsConfig, {
          productTitle: product.title,
          productUrl: product.url,
          previousPrice: product.current_price,
          newPrice,
          lowestPrice: newLowest,
          currency: product.currency || 'INR',
          isAllTimeLow,
          isBackInStock,
          imageUrl: scrapeRes.imageUrl || product.image_url || undefined,
          platform: product.platform,
        });
      }

      await db
        .from('products')
        .update({
          current_price: newPrice,
          lowest_price: newLowest,
          highest_price: newHighest,
          last_checked_at: new Date().toISOString(),
          last_price_drop_at: isPriceDrop ? new Date().toISOString() : product.last_price_drop_at,
          last_alerted_price: newLastAlerted,
          check_status: 'ok',
          error_message: null,
          image_url: scrapeRes.imageUrl || product.image_url,
        })
        .eq('id', product.id);

      // Record price history
      try {
        await db.from('price_history').insert({
          product_id: product.id,
          price: newPrice,
        });
      } catch {
        // Non-blocking
      }

      resultsSummary.push({ id: product.id, title: product.title, status: 'ok', price: newPrice });
    }

    return NextResponse.json({
      success: true,
      message: `Manual scrape finished: ${checkedCount} products checked, ${priceDropCount} price drops, ${errorCount} errors.`,
      checkedCount,
      priceDropCount,
      errorCount,
      durationMs: Date.now() - startTime,
      results: resultsSummary,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
