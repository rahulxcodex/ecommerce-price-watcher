import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { supabase as publicSupabase } from '@/lib/supabase';
import { sendScraperStaleAlert } from '@scripts/notify';
import {
  SCRAPER_STALE_THRESHOLD_HOURS,
  SCRAPER_EMERGENCY_THRESHOLD_HOURS,
  SCRAPER_CATCHUP_INTERVAL_MINUTES,
  getAdminEmail,
  evaluateScraperStaleness,
} from '@/lib/constants';

import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getDbClient() {
  try {
    return getServiceSupabase();
  } catch {
    return publicSupabase;
  }
}

export async function GET(req: NextRequest) {
  return handleWatchdog(req);
}

export async function POST(req: NextRequest) {
  return handleWatchdog(req);
}

async function handleWatchdog(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Security Gate: Authenticated user session or valid API secret
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = verifySessionToken(token || '');

    const watchdogSecret =
      process.env.WATCHDOG_API_KEY ||
      process.env.CRON_SECRET ||
      process.env.AUTH_SECRET;
    const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    const apiKeyParam = searchParams.get('key')?.trim();

    const isApiKeyValid = Boolean(
      watchdogSecret && (authHeader === watchdogSecret || apiKeyParam === watchdogSecret)
    );

    const adminEmail = getAdminEmail().toLowerCase().trim();
    const isUserAdmin = Boolean(
      session?.isCombined ||
      session?.role === 'combined' ||
      (session?.email && session.email.toLowerCase().trim() === adminEmail)
    );
    const isAuthorized = isUserAdmin || isApiKeyValid;

    if (!isAuthorized) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: Access to scraper watchdog requires administrator authorization or valid API key.',
        },
        { status: session ? 403 : 401 }
      );
    }

    const db = getDbClient();
    const forceAlert = searchParams.get('force') === 'true';

    // Query active products with both successful scrape and check timestamps
    const { data: products, error } = await db
      .from('products')
      .select('id, last_successful_scrape_at, last_checked_at')
      .eq('is_active', true);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const totalActiveProducts = products ? products.length : 0;
    const timestamps = (products || [])
      .map((p) => {
        const t = p.last_successful_scrape_at || p.last_checked_at;
        return t ? new Date(t).getTime() : 0;
      })
      .filter((t) => t > 0);

    const mostRecentTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : 0;
    const now = Date.now();
    const elapsedMs = mostRecentTimestamp > 0 ? now - mostRecentTimestamp : Infinity;
    const elapsedHours = Math.round((elapsedMs / (1000 * 60 * 60)) * 10) / 10;

    const decision = evaluateScraperStaleness(
      isFinite(elapsedHours) ? elapsedHours : null,
      forceAlert
    );

    const isStale = elapsedHours >= SCRAPER_STALE_THRESHOLD_HOURS || forceAlert;
    const isEmergency = elapsedHours >= SCRAPER_EMERGENCY_THRESHOLD_HOURS || decision.mode === 'emergency_catchup';

    let alertSent = false;
    let alertError: string | undefined;

    if (isStale && totalActiveProducts > 0) {
      const res = await sendScraperStaleAlert({
        hoursSinceLastScrape: isFinite(elapsedHours) ? elapsedHours : 99,
        lastScrapedAt: mostRecentTimestamp > 0 ? new Date(mostRecentTimestamp).toISOString() : null,
        totalActiveProducts,
        to: getAdminEmail(),
      });
      alertSent = res.success;
      alertError = res.error;
    }

    return NextResponse.json({
      success: true,
      status: isEmergency ? 'emergency_catchup' : isStale ? 'stale' : 'healthy',
      mode: decision.mode,
      shouldRun: decision.shouldRun,
      reason: decision.reason,
      thresholdHours: SCRAPER_STALE_THRESHOLD_HOURS,
      emergencyThresholdHours: SCRAPER_EMERGENCY_THRESHOLD_HOURS,
      catchupIntervalMinutes: SCRAPER_CATCHUP_INTERVAL_MINUTES,
      elapsedHours: isFinite(elapsedHours) ? elapsedHours : null,
      lastScrapedAt: mostRecentTimestamp > 0 ? new Date(mostRecentTimestamp).toISOString() : null,
      totalActiveProducts,
      alertSent,
      alertError,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
