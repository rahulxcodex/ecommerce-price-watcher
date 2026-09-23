import { getServiceSupabase } from '@/lib/supabase';
import { scrapeAmazon } from './scrapers/amazon';
import { scrapeFlipkart } from './scrapers/flipkart';
import { scrapeMeesho } from './scrapers/meesho';
import { delay } from './scrapers/utils';
import { sendTelegramAlert } from './notify';
import { validateScrapedPrice } from '@/lib/security';
import { Product, UserProfile } from '@/types';

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
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true);

  if (prodErr) {
    console.error('Failed to load products from database:', prodErr);
    process.exit(1);
  }

  if (!products || products.length === 0) {
    console.log('No active products found to track.');
    return;
  }

  console.log(`📋 Found ${products.length} active products to check.`);

  // 2. Fetch user notification profiles
  const userIds = Array.from(new Set(products.map((p: Product) => p.user_id)));
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('*')
    .in('id', userIds);

  const profileMap = new Map<string, UserProfile>();
  if (profiles) {
    profiles.forEach((p: UserProfile) => profileMap.set(p.id, p));
  }

  let checkedCount = 0;
  let priceDropCount = 0;
  let errorCount = 0;

  // 3. Process products sequentially with polite pacing
  for (const product of products as Product[]) {
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
      } else {
        console.warn(`Unsupported platform ${product.platform}`);
        continue;
      }
    } catch (e: unknown) {
      scrapeRes = { success: false, error: String(e) };
    }

    if (!scrapeRes.success || !scrapeRes.price) {
      errorCount++;
      console.warn(`⚠️ Scraping failed for "${product.title.slice(0, 30)}": ${scrapeRes.error}`);
      await supabase
        .from('products')
        .update({
          check_status: scrapeRes.isOutOfStock ? 'out_of_stock' : 'error',
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

    const isPriceDrop = newPrice < product.current_price;
    const isAllTimeLow = newPrice <= product.lowest_price;
    const isHitTarget = product.target_price !== null && newPrice <= product.target_price;

    const newLowest = Math.min(product.lowest_price, newPrice);
    const newHighest = Math.max(product.highest_price, newPrice);

    console.log(`  Current: ₹${product.current_price} | New: ₹${newPrice} | All-time Low: ₹${newLowest}`);

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
        image_url: scrapeRes.imageUrl || product.image_url,
      })
      .eq('id', product.id);

    // Record to price_history table
    await supabase.from('price_history').insert({
      product_id: product.id,
      price: newPrice,
      currency: product.currency || 'INR',
      recorded_at: new Date().toISOString(),
    });

    // Check if notification should fire
    const userProfile = profileMap.get(product.user_id);
    if (userProfile && userProfile.telegram_chat_id && (isAllTimeLow || isHitTarget || (isPriceDrop && userProfile.notification_preference === 'any_drop'))) {
      priceDropCount++;
      console.log(`  🔔 Triggering Telegram alert to chat ${userProfile.telegram_chat_id}...`);
      await sendTelegramAlert({
        chatId: userProfile.telegram_chat_id,
        productTitle: product.title,
        productUrl: product.url,
        previousPrice: product.current_price,
        newPrice: newPrice,
        lowestPrice: newLowest,
        currency: product.currency || 'INR',
        isAllTimeLow: isAllTimeLow,
      });
    }

    // Polite delay between requests to prevent IP rate-limiting
    await delay(2500);
  }

  const durationSec = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n🏁 Price Check Completed in ${durationSec}s!`);
  console.log(`   Checked: ${checkedCount} | Drops/Alerts: ${priceDropCount} | Errors: ${errorCount}`);
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
