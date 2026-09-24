import { getServiceSupabase } from '@/lib/supabase';
import { scrapeAmazon } from './scrapers/amazon';
import { scrapeFlipkart } from './scrapers/flipkart';
import { scrapeMeesho } from './scrapers/meesho';
import { scrapeMyntra } from './scrapers/myntra';
import { scrapeAjio } from './scrapers/ajio';
import { scrapeWestside } from './scrapers/westside';
import { delay } from './scrapers/utils';
import { dispatchAlerts } from './notify';
import { sendWebPushToAll } from '@/lib/web-push';
import { validateScrapedPrice } from '@/lib/security';
import { Product, AppSettings } from '@/types';

async function main() {
  console.log('🚀 Starting Scheduled Price Checker...');
  const startTime = Date.now();

  let supabase;
  try {
    supabase = getServiceSupabase();
  } catch (err: unknown) {
    console.error('Fatal: Cannot connect to Supabase.', err);
    process.exit(1);
  }

  // 1. Fetch active products
  const { data: rawProducts, error: prodErr } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true);

  if (prodErr) {
    console.error('Failed to load products from database:', prodErr);
    process.exit(1);
  }

  if (!rawProducts || rawProducts.length === 0) {
    console.log('No active products found to track.');
    return;
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

  let checkedCount = 0;
  let priceDropCount = 0;
  let errorCount = 0;

  // 4. Process products with domain-aware pacing
  for (const product of products) {
    checkedCount++;
    console.log(`\n[${checkedCount}/${products.length}] Checking: ${product.title.slice(0, 40)}... (${product.platform})`);

    let scrapeRes;
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
        continue;
      }
    } catch (e: unknown) {
      scrapeRes = { success: false, error: String(e) };
    }

    // Handle out of stock detection
    if (scrapeRes.isOutOfStock) {
      console.log(`  📦 Product is currently Out of Stock: "${product.title.slice(0, 30)}"`);
      await supabase
        .from('products')
        .update({
          check_status: 'out_of_stock',
          error_message: null,
          last_checked_at: new Date().toISOString(),
        })
        .eq('id', product.id);
      await delay(2000);
      continue;
    }

    if (!scrapeRes.success || !scrapeRes.price || scrapeRes.price <= 0) {
      errorCount++;
      console.warn(`⚠️ Scraping failed for "${product.title.slice(0, 30)}": ${scrapeRes.error}`);
      await supabase
        .from('products')
        .update({
          check_status: 'error',
          error_message: scrapeRes.error || 'Failed to extract price',
          last_checked_at: new Date().toISOString(),
        })
        .eq('id', product.id);

      await delay(2000);
      continue;
    }

    const newPrice = scrapeRes.price;

    // Security & sanity check on scraped price
    const sanity = validateScrapedPrice(newPrice, product.current_price);
    if (!sanity.isValid) {
      console.warn(`🛑 Sanity check failed for ${product.id}: ${sanity.reason}`);
      await supabase
        .from('products')
        .update({
          check_status: 'error',
          error_message: `Sanity check: ${sanity.reason}`,
          last_checked_at: new Date().toISOString(),
        })
        .eq('id', product.id);
      continue;
    }

    // State transition analysis
    const wasOutOfStock = product.check_status === 'out_of_stock';
    const isBackInStock = wasOutOfStock && newPrice > 0;
    const isPriceDrop = newPrice < product.current_price;
    // Bug 1 fix: All-time low MUST be strictly lower than previous lowest AND lower than current price
    const isAllTimeLow = isPriceDrop && newPrice < product.lowest_price;
    const isHitTarget = product.target_price !== null && newPrice <= product.target_price;

    const newLowest = Math.min(product.lowest_price, newPrice);
    const newHighest = Math.max(product.highest_price, newPrice);

    console.log(`  Current: ₹${product.current_price} | New: ₹${newPrice} | All-time Low: ₹${newLowest}`);

    // Determine whether an alert should be dispatched
    // Prevent duplicate alert loop if we already alerted at this exact price
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

    // Update product in database
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
        last_alerted_price: newLastAlerted,
        image_url: scrapeRes.imageUrl || product.image_url,
        bank_offers: scrapeRes.bankOffers || product.bank_offers,
      })
      .eq('id', product.id);

    // Record to price_history table
    await supabase.from('price_history').insert({
      product_id: product.id,
      price: newPrice,
      currency: product.currency || 'INR',
      recorded_at: new Date().toISOString(),
    });

    // Polite delay between requests
    await delay(2000);
  }

  const durationSec = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n🏁 Price Check Completed in ${durationSec}s!`);
  console.log(`   Checked: ${checkedCount} | Drops/Alerts: ${priceDropCount} | Errors: ${errorCount}`);
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
