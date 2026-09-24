import { getServiceSupabase } from '@/lib/supabase';
import { scrapeAmazon } from './scrapers/amazon';
import { scrapeFlipkart } from './scrapers/flipkart';
import { scrapeMeesho } from './scrapers/meesho';
import { scrapeMyntra } from './scrapers/myntra';
import { scrapeAjio } from './scrapers/ajio';
import { scrapeWestside } from './scrapers/westside';
import { delay, closeSharedBrowser } from './scrapers/utils';
import { dispatchAlerts, sendScraperFailureAlert, sendScraperStaleAlert } from './notify';
import { sendWebPushToAll } from '@/lib/web-push';
import { validateScrapedPrice } from '@/lib/security';
import { Product, AppSettings, ScrapeResult } from '@/types';

async function main() {
  console.log('🚀 Starting Scheduled Price Checker...');
  const startTime = Date.now();

  let supabase: ReturnType<typeof getServiceSupabase>;
  try {
    supabase = getServiceSupabase();
  } catch (err: unknown) {
    console.error('Fatal: Cannot connect to Supabase.', err);
    process.exit(1);
  }

  // 1. Fetch active products using paginated chunking to prevent memory and connection starvation
  const PAGE_SIZE = 50;
  let rawProducts: Product[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data: pageData, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('last_checked_at', { ascending: true, nullsFirst: true })
      .range(from, to);

    if (prodErr) {
      console.error(`Failed to load products batch [page ${page}]:`, prodErr);
      if (rawProducts.length === 0) {
        process.exit(1);
      }
      break;
    }

    if (!pageData || pageData.length === 0) {
      hasMore = false;
    } else {
      rawProducts = rawProducts.concat(pageData as Product[]);
      if (pageData.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  if (rawProducts.length === 0) {
    console.log('No active products found to track.');
    return;
  }

  // 1.1 Watchdog Liveness Check: Alert if scraping hasn't occurred in the last 3 hours
  const checkedTimestamps = rawProducts
    .map((p) => (p.last_checked_at ? new Date(p.last_checked_at).getTime() : 0))
    .filter((t) => t > 0);
  const mostRecentScrape = checkedTimestamps.length > 0 ? Math.max(...checkedTimestamps) : 0;

  if (mostRecentScrape > 0) {
    const elapsedMs = Date.now() - mostRecentScrape;
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    if (elapsedHours >= 3.0) {
      console.warn(`🚨 WATCHDOG: Last scrape was ${elapsedHours.toFixed(1)}h ago (>= 3h threshold). Dispatching stale alert to rahulr24g@gmail.com...`);
      await sendScraperStaleAlert({
        hoursSinceLastScrape: Math.round(elapsedHours * 10) / 10,
        lastScrapedAt: new Date(mostRecentScrape).toISOString(),
        totalActiveProducts: rawProducts.length,
        to: 'rahulr24g@gmail.com',
      });
    }
  }

  // 2. Fetch App Settings
  let settingsData = null;
  const { data: appSettings } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();

  if (appSettings) {
    settingsData = appSettings;
  } else {
    const { data: houseSet } = await supabase
      .from('household_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();
    settingsData = houseSet;
  }

  const appSettingsConfig: Partial<AppSettings> = settingsData || {
    telegram_chat_id: process.env.TELEGRAM_CHAT_ID || null,
    whatsapp_phone: process.env.WHATSAPP_PHONE || null,
    whatsapp_apikey: process.env.WHATSAPP_API_KEY || null,
    email: process.env.APPSCRIPT_TO_EMAIL || null,
    discord_webhook: process.env.DISCORD_WEBHOOK_URL || null,
    ntfy_topic: process.env.NTFY_TOPIC || null,
    notification_preference: 'all_time_low',
  };

  // 3. DSA Optimization: Priority Queue / Adaptive Ordering
  // Prioritize items near target price or checked longest ago
  const products = (rawProducts as Product[]).sort((a, b) => {
    const aTargetDist = a.target_price ? Math.abs(a.current_price - a.target_price) / a.current_price : 1;
    const bTargetDist = b.target_price ? Math.abs(b.current_price - b.target_price) / b.current_price : 1;
    const aTime = new Date(a.last_checked_at || 0).getTime();
    const bTime = new Date(b.last_checked_at || 0).getTime();
    // Lower target distance and older checked time get higher priority
    return aTargetDist - bTargetDist || aTime - bTime;
  });

  console.log(`📋 Found ${products.length} active products to check.`);

  /**
   * Round-robin interleaves products by platform so the scraper never hits the same
   * storefront repeatedly in succession.
   */
  function interleaveProductsByPlatform(productList: Product[]): Product[] {
    const byPlatform = new Map<string, Product[]>();
    for (const p of productList) {
      const list = byPlatform.get(p.platform) || [];
      list.push(p);
      byPlatform.set(p.platform, list);
    }
    const interleaved: Product[] = [];
    let added = true;
    while (added) {
      added = false;
      for (const [, items] of byPlatform) {
        if (items.length > 0) {
          interleaved.push(items.shift()!);
          added = true;
        }
      }
    }
    return interleaved;
  }

  const scheduledProducts = interleaveProductsByPlatform(products);
  let checkedCount = 0;
  let priceDropCount = 0;
  let errorCount = 0;

  // Domain-aware pacing map: track last request timestamp per storefront to prevent rate-limiting
  const lastPlatformCheckTime = new Map<string, number>();
  async function pacePlatform(platform: string): Promise<void> {
    const now = Date.now();
    const last = lastPlatformCheckTime.get(platform) || 0;
    const minSpacing = 3000 + Math.floor(Math.random() * 2000); // 3s - 5s between requests to same domain
    const elapsed = now - last;
    if (elapsed < minSpacing) {
      await delay(minSpacing - elapsed);
    }
    lastPlatformCheckTime.set(platform, Date.now());
  }

  // 4. Bounded Concurrency Scraper Worker Pool (3-5 parallel workers)
  const CONCURRENCY = Math.min(4, scheduledProducts.length);
  console.log(`⚡ Dispatching scrapes with bounded concurrency pool (${CONCURRENCY} parallel workers)...`);

  let currentIndex = 0;

  async function scraperWorker(workerId: number): Promise<void> {
    while (currentIndex < scheduledProducts.length) {
      const itemIdx = currentIndex++;
      const product = scheduledProducts[itemIdx];
      checkedCount++;
      const itemNumber = checkedCount;

      console.log(`\n[W${workerId} ${itemNumber}/${scheduledProducts.length}] Checking: ${product.title.slice(0, 40)}... (${product.platform})`);

      // Domain-aware pacing across concurrent workers
      await pacePlatform(product.platform);

      const MAX_ATTEMPTS = 2;
      let scrapeRes: ScrapeResult | null = null;
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
            console.warn(`Unsupported platform ${product.platform}`);
            break;
          }
        } catch (e: unknown) {
          scrapeRes = { success: false, error: String(e) };
        }

        if (scrapeRes && (scrapeRes.success || scrapeRes.isOutOfStock)) {
          break;
        }

        if (attempt < MAX_ATTEMPTS) {
          console.warn(`  🔄 Attempt ${attempt} failed: ${scrapeRes?.error || 'Unknown error'}. Retrying (${attempt + 1}/${MAX_ATTEMPTS})...`);
          await delay(2500);
        }
      }

      // Handle out of stock detection
      if (scrapeRes && scrapeRes.isOutOfStock) {
        console.log(`  📦 Product is currently Out of Stock: "${product.title.slice(0, 30)}"`);
        await supabase
          .from('products')
          .update({
            check_status: 'out_of_stock',
            error_message: null,
            last_checked_at: new Date().toISOString(),
          })
          .eq('id', product.id);
        continue;
      }

      if (!scrapeRes || !scrapeRes.success || !scrapeRes.price || scrapeRes.price <= 0) {
        errorCount++;
        const errorMessage = scrapeRes?.error || 'Failed to extract price after 2 attempts';
        console.warn(`⚠️ Scraping failed for "${product.title.slice(0, 30)}": ${errorMessage}`);
        await supabase
          .from('products')
          .update({
            check_status: 'error',
            error_message: errorMessage,
            last_checked_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        // Dispatch failure email alert to user
        console.log(`  📧 Dispatching scraper failure alert to rahulr24g@gmail.com...`);
        await sendScraperFailureAlert({
          productTitle: product.title,
          productUrl: product.url,
          platform: product.platform,
          error: errorMessage,
          retryAttempts: attemptsMade,
          to: 'rahulr24g@gmail.com',
        });
        continue;
      }

      const newPrice = scrapeRes.price;

      // Security & sanity check on scraped price
      const sanity = validateScrapedPrice(newPrice, product.current_price);
      if (!sanity.isValid) {
        const sanityReason = `Sanity check: ${sanity.reason}`;
        console.warn(`🛑 Sanity check failed for ${product.id}: ${sanityReason}`);
        await supabase
          .from('products')
          .update({
            check_status: 'error',
            error_message: sanityReason,
            last_checked_at: new Date().toISOString(),
          })
          .eq('id', product.id);

        // Dispatch failure email alert for sanity check violation
        await sendScraperFailureAlert({
          productTitle: product.title,
          productUrl: product.url,
          platform: product.platform,
          error: sanityReason,
          retryAttempts: attemptsMade,
          to: 'rahulr24g@gmail.com',
        });
        continue;
      }

      // State transition analysis
      const wasOutOfStock = product.check_status === 'out_of_stock';
      const isBackInStock = wasOutOfStock && newPrice > 0;
      const isPriceDrop = newPrice < product.current_price;
      const isAllTimeLow = isPriceDrop && newPrice < product.lowest_price;
      const isHitTarget = product.target_price !== null && newPrice <= product.target_price;

      const newLowest = Math.min(product.lowest_price, newPrice);
      const newHighest = Math.max(product.highest_price, newPrice);

      console.log(`  Current: ₹${product.current_price} | New: ₹${newPrice} | All-time Low: ₹${newLowest}`);

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
        console.log(`  🔔 Triggering Alerts (Telegram, WhatsApp, Email, WebPush)...`);

        // 1. Dispatch configured notifications (Telegram, WhatsApp, Email)
        await dispatchAlerts(appSettingsConfig, {
          productTitle: product.title,
          productUrl: product.url,
          previousPrice: product.current_price,
          newPrice: newPrice,
          lowestPrice: newLowest,
          currency: product.currency || 'INR',
          isAllTimeLow: isAllTimeLow,
          isBackInStock: isBackInStock,
          imageUrl: scrapeRes.imageUrl || product.image_url || undefined,
          platform: product.platform,
        });

        // 2. Dispatch Web Push notification to registered browsers
        await sendWebPushToAll({
          title: isBackInStock
            ? `🎉 Back in Stock: ${product.title.slice(0, 30)}`
            : isAllTimeLow
            ? `🔥 All-Time Low: ${product.title.slice(0, 30)}`
            : `📉 Price Drop: ${product.title.slice(0, 30)}`,
          body: `Price is now ₹${newPrice.toLocaleString('en-IN')} (was ₹${product.current_price.toLocaleString('en-IN')})`,
          url: `/product/${product.id}`,
        }).catch((e) => console.warn('Web Push failed:', e));
      }

      // Update product in database (resilient to schema columns)
      const updatePayload: Record<string, unknown> = {
        current_price: newPrice,
        lowest_price: newLowest,
        highest_price: newHighest,
        check_status: 'ok',
        error_message: null,
        last_checked_at: new Date().toISOString(),
        last_price_drop_at: isPriceDrop ? new Date().toISOString() : product.last_price_drop_at,
        last_alerted_price: newLastAlerted,
        image_url: scrapeRes.imageUrl || product.image_url,
        bank_offers: scrapeRes.bankOffers || product.bank_offers || [],
      };

      const { error: updateError } = await supabase
        .from('products')
        .update(updatePayload)
        .eq('id', product.id);

      if (
        updateError &&
        (updateError.message.includes('schema cache') ||
          updateError.message.includes('bank_offers') ||
          updateError.message.includes('last_alerted_price') ||
          updateError.code === 'PGRST204')
      ) {
        await supabase
          .from('products')
          .update({
            current_price: newPrice,
            lowest_price: newLowest,
            highest_price: newHighest,
            check_status: 'ok',
            error_message: null,
            last_checked_at: new Date().toISOString(),
            last_price_drop_at: isPriceDrop ? new Date().toISOString() : product.last_price_drop_at,
            image_url: scrapeRes.imageUrl || product.image_url,
          })
          .eq('id', product.id);
      }

      // Record to price_history table
      await supabase.from('price_history').insert({
        product_id: product.id,
        price: newPrice,
        currency: product.currency || 'INR',
        recorded_at: new Date().toISOString(),
      });
    }
  }

  try {
    const workerPromises = Array.from({ length: CONCURRENCY }, (_, i) => scraperWorker(i + 1));
    await Promise.all(workerPromises);
  } finally {
    await closeSharedBrowser();
  }

  const durationSec = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n🏁 Price Check Completed in ${durationSec}s!`);
  console.log(`   Checked: ${checkedCount} | Drops/Alerts: ${priceDropCount} | Errors: ${errorCount}`);
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
