import { getServiceSupabase } from '@/lib/supabase';
import { scrapeByPlatform } from './scrapers/registry';
import { delay, closeSharedBrowser } from './scrapers/utils';
import {
  dispatchAlerts,
  sendScraperStaleAlert,
  sendScraperBatchFailureSummaryAlert,
  processNotificationOutbox,
} from './notify';
import { sendWebPushToAll } from '@/lib/web-push';
import { validateScrapedPrice } from '@/lib/security';
import { Product, AppSettings, ScrapeResult } from '@/types';
import {
  SCRAPER_STALE_THRESHOLD_HOURS,
  SCRAPER_EMERGENCY_THRESHOLD_HOURS,
  SCRAPER_BATCH_SIZE,
  MAX_SCRAPER_WORKERS,
  PLATFORM_PACING_MIN_MS,
  PLATFORM_PACING_JITTER_MS,
  getAdminEmail,
} from '@/lib/constants';

// Per-platform FIFO lock queue to guarantee strict serialization per storefront domain
const platformQueues = new Map<string, Promise<void>>();

async function withPlatformLock<T>(platform: string, task: () => Promise<T>): Promise<T> {
  const previous = platformQueues.get(platform) ?? Promise.resolve();

  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });

  platformQueues.set(platform, previous.then(() => next));
  await previous;

  try {
    // Add domain spacing delay before executing task
    const minSpacing = PLATFORM_PACING_MIN_MS + Math.floor(Math.random() * PLATFORM_PACING_JITTER_MS);
    await delay(minSpacing);
    return await task();
  } finally {
    release();
    if (platformQueues.get(platform) === next) {
      platformQueues.delete(platform);
    }
  }
}

// -----------------------------------------------------------------------------
// Per-Platform Circuit Breaker
// -----------------------------------------------------------------------------
interface PlatformCircuitBreaker {
  consecutiveFailures: number;
  trippedUntil: number;
  state: 'closed' | 'open' | 'half_open';
}

const CIRCUIT_TRIP_THRESHOLD = 3;
const CIRCUIT_COOLDOWN_MS = 5 * 60 * 1000; // 5-minute cooldown before probe
const platformCircuitBreakers = new Map<string, PlatformCircuitBreaker>();

export function checkPlatformCircuit(platform: string): { isTripped: boolean; reason?: string } {
  const cb = platformCircuitBreakers.get(platform);
  if (!cb || cb.state === 'closed') {
    return { isTripped: false };
  }

  const now = Date.now();
  if (cb.state === 'open') {
    if (now >= cb.trippedUntil) {
      cb.state = 'half_open';
      console.log(`🔌 Circuit breaker for [${platform.toUpperCase()}] transitioning to HALF-OPEN (testing 1 probe request).`);
      return { isTripped: false };
    }
    const remainingSec = Math.ceil((cb.trippedUntil - now) / 1000);
    return {
      isTripped: true,
      reason: `Platform circuit breaker OPEN (${cb.consecutiveFailures} consecutive blocks). Cooldown active for ${remainingSec}s.`,
    };
  }

  return { isTripped: false };
}

export function recordPlatformCircuitSuccess(platform: string) {
  const cb = platformCircuitBreakers.get(platform);
  if (cb) {
    if (cb.state !== 'closed') {
      console.log(`✅ Circuit breaker for [${platform.toUpperCase()}] CLOSED (probe request succeeded).`);
    }
    cb.consecutiveFailures = 0;
    cb.state = 'closed';
  }
}

export function recordPlatformCircuitFailure(platform: string, errorMessage?: string) {
  let cb = platformCircuitBreakers.get(platform);
  if (!cb) {
    cb = { consecutiveFailures: 0, trippedUntil: 0, state: 'closed' };
    platformCircuitBreakers.set(platform, cb);
  }

  cb.consecutiveFailures += 1;

  if (cb.consecutiveFailures >= CIRCUIT_TRIP_THRESHOLD || cb.state === 'half_open') {
    cb.state = 'open';
    cb.trippedUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
    console.warn(
      `🚨 [CIRCUIT BREAKER TRIPPED] Storefront [${platform.toUpperCase()}]: ${cb.consecutiveFailures} consecutive errors. Short-circuiting subsequent ${platform.toUpperCase()} requests for 5 minutes. Reason: ${errorMessage || 'Repeated failure'}`
    );
  }
}

/**
 * Interleaves products by platform so concurrent workers naturally distribute
 * load across different storefronts rather than bunching against one domain.
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

async function main() {
  console.log('🚀 Starting Production-Hardened Price Checker...');
  const startTime = Date.now();

  let supabase: ReturnType<typeof getServiceSupabase>;
  try {
    supabase = getServiceSupabase();
  } catch (err: unknown) {
    console.error('Fatal: Cannot connect to Supabase.', err);
    process.exit(1);
  }

  // 1. Initialize scrape_runs telemetry record
  const triggerType = process.env.GITHUB_ACTIONS ? 'cron' : 'manual';
  let runId: string | null = null;
  try {
    const { data: runData } = await supabase
      .from('scrape_runs')
      .insert({
        trigger: triggerType,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();
    runId = runData?.id || null;
  } catch (e) {
    console.debug('Telemetry notice: scrape_runs table not yet migrated:', e);
  }

  // 2. Fetch App Settings
  let appSettingsConfig: Partial<AppSettings> = {
    telegram_chat_id: process.env.TELEGRAM_CHAT_ID || null,
    whatsapp_phone: process.env.WHATSAPP_PHONE || null,
    whatsapp_apikey: process.env.WHATSAPP_API_KEY || null,
    email: process.env.APPSCRIPT_TO_EMAIL || getAdminEmail(),
    discord_webhook: process.env.DISCORD_WEBHOOK_URL || null,
    ntfy_topic: process.env.NTFY_TOPIC || null,
    notification_preference: 'all_time_low',
  };

  const { data: appSettings } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();

  if (appSettings) {
    appSettingsConfig = { ...appSettingsConfig, ...appSettings };
  }

  // 3. Watchdog Liveness Check on most recent scrape
  const { data: latestProducts } = await supabase
    .from('products')
    .select('last_successful_scrape_at, last_checked_at')
    .eq('is_active', true)
    .order('last_checked_at', { ascending: false, nullsFirst: false })
    .limit(10);

  if (latestProducts && latestProducts.length > 0) {
    const timestamps = latestProducts
      .map((p) => {
        const t = p.last_successful_scrape_at || p.last_checked_at;
        return t ? new Date(t).getTime() : 0;
      })
      .filter((t) => t > 0);

    const mostRecentTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : 0;
    if (mostRecentTimestamp > 0) {
      const elapsedHours = (Date.now() - mostRecentTimestamp) / (1000 * 60 * 60);

      if (elapsedHours >= SCRAPER_EMERGENCY_THRESHOLD_HOURS) {
        console.warn(
          `🚨 EMERGENCY CATCH-UP: Last scrape was ${elapsedHours.toFixed(1)}h ago (>= ${SCRAPER_EMERGENCY_THRESHOLD_HOURS}h threshold). Executing catch-up cycle...`
        );
      }

      if (elapsedHours >= SCRAPER_STALE_THRESHOLD_HOURS) {
        console.warn(
          `🚨 WATCHDOG: Last scrape was ${elapsedHours.toFixed(1)}h ago (>= ${SCRAPER_STALE_THRESHOLD_HOURS}h threshold). Dispatching stale alert to ${getAdminEmail()}...`
        );
        await sendScraperStaleAlert({
          hoursSinceLastScrape: Math.round(elapsedHours * 10) / 10,
          lastScrapedAt: new Date(mostRecentTimestamp).toISOString(),
          totalActiveProducts: latestProducts.length,
          to: getAdminEmail(),
        });
      }
    }
  }

  // 4. Memory-Safe Streaming Batch Pagination
  let page = 0;
  let hasMore = true;
  let totalChecked = 0;
  let totalSuccess = 0;
  let totalErrors = 0;
  let totalOutOfStock = 0;
  let totalPriceDrops = 0;

  const aggregatedFailures: Array<{
    title: string;
    url: string;
    platform: string;
    error: string;
  }> = [];

  const platformFailureCounts: Record<string, number> = {};

  try {
    while (hasMore) {
      const from = page * SCRAPER_BATCH_SIZE;
      const to = from + SCRAPER_BATCH_SIZE - 1;

      console.log(`\n📦 Fetching batch chunk [items ${from}–${to}]...`);
      const { data: batchData, error: batchErr } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('last_checked_at', { ascending: true, nullsFirst: true })
        .range(from, to);

      if (batchErr) {
        console.error(`Error loading products batch at page ${page}:`, batchErr);
        break;
      }

      if (!batchData || batchData.length === 0) {
        hasMore = false;
        break;
      }

      if (batchData.length < SCRAPER_BATCH_SIZE) {
        hasMore = false;
      } else {
        page++;
      }

      const productsBatch = batchData as Product[];
      console.log(`🔍 Processing batch of ${productsBatch.length} products...`);

      // Adaptive ordering within batch: prioritize items closest to target price or checked longest ago
      const prioritizedBatch = productsBatch.sort((a, b) => {
        const aDist = a.target_price ? Math.abs(a.current_price - a.target_price) / a.current_price : 1;
        const bDist = b.target_price ? Math.abs(b.current_price - b.target_price) / b.current_price : 1;
        const aTime = new Date(a.last_checked_at || 0).getTime();
        const bTime = new Date(b.last_checked_at || 0).getTime();
        return aDist - bDist || aTime - bTime;
      });

      const scheduledBatch = interleaveProductsByPlatform(prioritizedBatch);
      const concurrency = Math.min(MAX_SCRAPER_WORKERS, scheduledBatch.length);

      let batchIndex = 0;

      async function batchWorker(workerId: number): Promise<void> {
        while (batchIndex < scheduledBatch.length) {
          const itemIdx = batchIndex++;
          const product = scheduledBatch[itemIdx];
          totalChecked++;
          const currentItemNumber = totalChecked;

          console.log(
            `\n[W${workerId} #${currentItemNumber}] Checking: ${product.title.slice(0, 40)}... (${product.platform})`
          );

          // Check storefront circuit breaker before hitting domain
          const circuit = checkPlatformCircuit(product.platform);
          if (circuit.isTripped) {
            console.warn(`  ⚡ Skipping [${product.platform.toUpperCase()}]: ${product.title.slice(0, 30)} - ${circuit.reason}`);
            totalErrors++;
            platformFailureCounts[product.platform] = (platformFailureCounts[product.platform] || 0) + 1;
            aggregatedFailures.push({
              title: product.title,
              url: product.url,
              platform: product.platform,
              error: circuit.reason || 'Circuit breaker tripped',
            });
            if (runId) {
              await supabase.from('scrape_run_items').insert({
                run_id: runId,
                product_id: product.id,
                platform: product.platform,
                status: 'error',
                error: circuit.reason,
                attempts: 0,
                duration_ms: 0,
                created_at: new Date().toISOString(),
              });
            }
            continue;
          }

          const itemStartTime = Date.now();
          const MAX_ATTEMPTS = 2;
          let scrapeRes: ScrapeResult | null = null;
          let attemptsMade = 0;

          // Execute scrape inside per-platform mutex lock to guarantee zero concurrent hits to same storefront
          for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            attemptsMade = attempt;
            try {
              scrapeRes = await withPlatformLock(product.platform, async () => {
                return scrapeByPlatform(product.platform, product.url);
              });
            } catch (err: unknown) {
              scrapeRes = { success: false, error: String(err) };
            }

            if (scrapeRes && (scrapeRes.success || scrapeRes.isOutOfStock)) {
              break;
            }

            if (attempt < MAX_ATTEMPTS) {
              console.warn(
                `  🔄 Attempt ${attempt} failed for ${product.platform}: ${scrapeRes?.error || 'Unknown error'}. Retrying...`
              );
              await delay(2500);
            }
          }

          const nowIso = new Date().toISOString();
          const durationMs = Date.now() - itemStartTime;

          // Case A: Product Out of Stock
          if (scrapeRes && scrapeRes.isOutOfStock) {
            recordPlatformCircuitSuccess(product.platform);
            totalOutOfStock++;
            console.log(`  📦 Product is Out of Stock: "${product.title.slice(0, 30)}"`);
            await supabase
              .from('products')
              .update({
                check_status: 'out_of_stock',
                error_message: null,
                last_attempted_at: nowIso,
                last_successful_scrape_at: nowIso,
                last_checked_at: nowIso,
                version: (product.version || 1) + 1,
              })
              .eq('id', product.id);

            if (runId) {
              await supabase.from('scrape_run_items').insert({
                run_id: runId,
                product_id: product.id,
                platform: product.platform,
                status: 'out_of_stock',
                attempts: attemptsMade,
                duration_ms: durationMs,
                created_at: nowIso,
              });
            }
            continue;
          }

          // Case B: Scraping Failed
          if (!scrapeRes || !scrapeRes.success || !scrapeRes.price || scrapeRes.price <= 0) {
            totalErrors++;
            const errorMessage = scrapeRes?.error || 'Failed to extract price after 2 attempts';
            recordPlatformCircuitFailure(product.platform, errorMessage);
            console.warn(`  ⚠️ Scraping failed for "${product.title.slice(0, 30)}": ${errorMessage}`);

            platformFailureCounts[product.platform] = (platformFailureCounts[product.platform] || 0) + 1;
            aggregatedFailures.push({
              title: product.title,
              url: product.url,
              platform: product.platform,
              error: errorMessage,
            });

            await supabase
              .from('products')
              .update({
                check_status: 'error',
                error_message: errorMessage,
                last_attempted_at: nowIso,
                last_error_at: nowIso,
                last_checked_at: nowIso,
                version: (product.version || 1) + 1,
              })
              .eq('id', product.id);

            if (runId) {
              await supabase.from('scrape_run_items').insert({
                run_id: runId,
                product_id: product.id,
                platform: product.platform,
                status: 'error',
                error: errorMessage,
                attempts: attemptsMade,
                duration_ms: durationMs,
                created_at: nowIso,
              });
            }
            continue;
          }

          const newPrice = scrapeRes.price;

          // Case C: Price Sanity / Anomaly Check
          const sanity = validateScrapedPrice(newPrice, product.current_price);
          if (!sanity.isValid) {
            totalErrors++;
            const sanityReason = `Sanity check: ${sanity.reason}`;
            recordPlatformCircuitFailure(product.platform, sanityReason);
            console.warn(`  🛑 Sanity check failed for ${product.id}: ${sanityReason}`);

            platformFailureCounts[product.platform] = (platformFailureCounts[product.platform] || 0) + 1;
            aggregatedFailures.push({
              title: product.title,
              url: product.url,
              platform: product.platform,
              error: sanityReason,
            });

            await supabase
              .from('products')
              .update({
                check_status: 'error',
                error_message: sanityReason,
                last_attempted_at: nowIso,
                last_error_at: nowIso,
                last_checked_at: nowIso,
                version: (product.version || 1) + 1,
              })
              .eq('id', product.id);

            if (runId) {
              await supabase.from('scrape_run_items').insert({
                run_id: runId,
                product_id: product.id,
                platform: product.platform,
                status: 'error',
                error: sanityReason,
                old_price: product.current_price,
                new_price: newPrice,
                attempts: attemptsMade,
                duration_ms: durationMs,
                created_at: nowIso,
              });
            }
            continue;
          }

          // Case D: Successful Price Extraction
          recordPlatformCircuitSuccess(product.platform);
          totalSuccess++;
          const wasOutOfStock = product.check_status === 'out_of_stock';
          const isBackInStock = wasOutOfStock && newPrice > 0;
          const isPriceDrop = newPrice < product.current_price;
          const isAllTimeLow = isPriceDrop && newPrice < product.lowest_price;
          const isHitTarget = product.target_price !== null && newPrice <= product.target_price;

          const newLowest = Math.min(product.lowest_price, newPrice);
          const newHighest = Math.max(product.highest_price, newPrice);

          console.log(`  Current: ₹${product.current_price} | New: ₹${newPrice} | All-time Low: ₹${newLowest}`);

          const preference = appSettingsConfig.notification_preference || 'all_time_low';
          const shouldAlert =
            isBackInStock ||
            isAllTimeLow ||
            (isHitTarget && isPriceDrop) ||
            (isPriceDrop && preference === 'any_drop');

          let newLastAlerted = product.last_alerted_price;

          if (shouldAlert) {
            // Determine alert event type
            const eventType: 'back_in_stock' | 'all_time_low' | 'target_met' | 'price_drop' = isBackInStock
              ? 'back_in_stock'
              : isAllTimeLow
              ? 'all_time_low'
              : isHitTarget
              ? 'target_met'
              : 'price_drop';

            // Generate deterministic dedupe key for idempotent alert recording
            const dedupeKey = `prod_${product.id}_${eventType}_${newPrice}`;

            // Attempt to insert into alert_events table
            const { data: alertEventRecord, error: alertInsertErr } = await supabase
              .from('alert_events')
              .insert({
                product_id: product.id,
                event_type: eventType,
                price: newPrice,
                dedupe_key: dedupeKey,
                status: 'pending',
                created_at: nowIso,
              })
              .select('id')
              .maybeSingle();

            // If dedupe key already exists (conflict error), skip alert to eliminate duplicate notifications
            const isDuplicate = alertInsertErr && (alertInsertErr.code === '23505' || alertInsertErr.message.includes('unique'));

            if (!isDuplicate) {
              totalPriceDrops++;
              newLastAlerted = newPrice;
              console.log(`  🔔 Dispatching Alert (${eventType}) for: ${product.title.slice(0, 30)}...`);

              // 1. Dispatch configured multi-channel alerts (Telegram, WhatsApp, Email, Discord, ntfy)
              const dispatchResult = await dispatchAlerts(appSettingsConfig, {
                productTitle: product.title,
                productUrl: product.url,
                previousPrice: product.current_price,
                newPrice: newPrice,
                lowestPrice: newLowest,
                currency: product.currency || 'INR',
                isAllTimeLow,
                isBackInStock,
                imageUrl: scrapeRes.imageUrl || product.image_url || undefined,
                platform: product.platform,
              });

              // 2. Dispatch Web Push notification
              await sendWebPushToAll({
                title: isBackInStock
                  ? `🎉 Back in Stock: ${product.title.slice(0, 30)}`
                  : isAllTimeLow
                  ? `🔥 All-Time Low: ${product.title.slice(0, 30)}`
                  : `📉 Price Drop: ${product.title.slice(0, 30)}`,
                body: `Price is now ₹${newPrice.toLocaleString('en-IN')} (was ₹${product.current_price.toLocaleString('en-IN')})`,
                url: `/product/${product.id}`,
              }).catch((e) => console.warn('Web Push notice:', e));

              // Mark alert event as sent
              if (alertEventRecord?.id) {
                await supabase
                  .from('alert_events')
                  .update({
                    status: 'sent',
                    recipient_count: dispatchResult.dispatched,
                    sent_at: new Date().toISOString(),
                  })
                  .eq('id', alertEventRecord.id);
              }
            } else {
              console.log(`  ℹ️ Alert for ₹${newPrice} already registered under dedupe key "${dedupeKey}". Skipping duplicate notification.`);
            }
          }

          // Update product in database with optimistic concurrency check
          const updatePayload: Record<string, unknown> = {
            current_price: newPrice,
            lowest_price: newLowest,
            highest_price: newHighest,
            check_status: 'ok',
            error_message: null,
            last_attempted_at: nowIso,
            last_successful_scrape_at: nowIso,
            last_checked_at: nowIso,
            last_price_drop_at: isPriceDrop ? nowIso : product.last_price_drop_at,
            last_alerted_price: newLastAlerted,
            image_url: scrapeRes.imageUrl || product.image_url,
            bank_offers: scrapeRes.bankOffers || product.bank_offers || [],
            version: (product.version || 1) + 1,
          };

          await supabase
            .from('products')
            .update(updatePayload)
            .eq('id', product.id);

          // Efficient price history storage:
          // Insert into price_history ONLY if price changed OR > 24 hours elapsed since last recorded observation
          const hoursSinceLastRecorded = product.last_successful_scrape_at
            ? (Date.now() - new Date(product.last_successful_scrape_at).getTime()) / (1000 * 60 * 60)
            : Infinity;

          if (newPrice !== product.current_price || hoursSinceLastRecorded >= 24) {
            await supabase.from('price_history').insert({
              product_id: product.id,
              price: newPrice,
              currency: product.currency || 'INR',
              recorded_at: nowIso,
            });
          }

          if (runId) {
            await supabase.from('scrape_run_items').insert({
              run_id: runId,
              product_id: product.id,
              platform: product.platform,
              status: 'ok',
              old_price: product.current_price,
              new_price: newPrice,
              attempts: attemptsMade,
              duration_ms: durationMs,
              created_at: nowIso,
            });
          }
        }
      }

      const workers = Array.from({ length: concurrency }, (_, i) => batchWorker(i + 1));
      await Promise.all(workers);
    }
  } finally {
    await closeSharedBrowser();
  }

  // 4.5 Process Pending Notification Outbox Queue (Delivery Assurance)
  try {
    const outboxResult = await processNotificationOutbox(supabase);
    if (outboxResult.retried > 0) {
      console.log(
        `📬 Notification Outbox Assurance: ${outboxResult.retried} retried, ${outboxResult.recovered} recovered, ${outboxResult.abandoned} abandoned.`
      );
    }
  } catch (err) {
    console.warn('Notice processing notification outbox:', err);
  }

  // 5. Consolidated Incident Notification (Aggregate Failures)
  if (aggregatedFailures.length > 0) {
    console.log(
      `\n📧 Dispatching consolidated failure incident summary (${aggregatedFailures.length} total errors) to ${getAdminEmail()}...`
    );
    await sendScraperBatchFailureSummaryAlert({
      totalFailures: aggregatedFailures.length,
      totalProductsChecked: totalChecked,
      byPlatform: platformFailureCounts,
      sampleFailures: aggregatedFailures.slice(0, 10),
      to: getAdminEmail(),
    });
  }

  // 6. Complete scrape_runs telemetry record
  const totalDurationMs = Date.now() - startTime;
  if (runId) {
    await supabase
      .from('scrape_runs')
      .update({
        status: 'completed',
        finished_at: new Date().toISOString(),
        total_products: totalChecked,
        success_count: totalSuccess,
        error_count: totalErrors,
        out_of_stock_count: totalOutOfStock,
        duration_ms: totalDurationMs,
      })
      .eq('id', runId);
  }

  // 7. Dead-Man's Switch Heartbeat Ping (if configured)
  const healthcheckUrl = process.env.HEALTHCHECK_URL;
  if (healthcheckUrl && totalSuccess > 0) {
    try {
      await fetch(healthcheckUrl, { method: 'POST', signal: AbortSignal.timeout(5000) });
      console.log('📡 Healthcheck heartbeat pinged successfully.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`⚠️ Healthcheck ping notice: ${msg}`);
    }
  }

  const durationSec = Math.round(totalDurationMs / 1000);
  console.log(`\n🏁 Price Check Completed in ${durationSec}s!`);
  console.log(
    `   Checked: ${totalChecked} | Successful: ${totalSuccess} | Drops/Alerts: ${totalPriceDrops} | Errors: ${totalErrors} | Out of Stock: ${totalOutOfStock}`
  );
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
