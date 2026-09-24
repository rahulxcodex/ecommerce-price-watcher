import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { supabase as publicSupabase } from '@/lib/supabase';
import { sendScraperStaleAlert } from '@scripts/notify';

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
    const db = getDbClient();
    const { searchParams } = new URL(req.url);
    const forceAlert = searchParams.get('force') === 'true';

    // Query active products
    const { data: products, error } = await db
      .from('products')
      .select('id, last_checked_at')
      .eq('is_active', true);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const totalActiveProducts = products ? products.length : 0;
    const timestamps = (products || [])
      .map((p) => (p.last_checked_at ? new Date(p.last_checked_at).getTime() : 0))
      .filter((t) => t > 0);

    const mostRecentTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : 0;
    const now = Date.now();
    const elapsedMs = mostRecentTimestamp > 0 ? now - mostRecentTimestamp : Infinity;
    const elapsedHours = Math.round((elapsedMs / (1000 * 60 * 60)) * 10) / 10;
    const isStale = elapsedHours >= 3.0 || forceAlert;

    let alertSent = false;
    let alertError: string | undefined;

    if (isStale && totalActiveProducts > 0) {
      const res = await sendScraperStaleAlert({
        hoursSinceLastScrape: isFinite(elapsedHours) ? elapsedHours : 99,
        lastScrapedAt: mostRecentTimestamp > 0 ? new Date(mostRecentTimestamp).toISOString() : null,
        totalActiveProducts,
        to: 'rahulr24g@gmail.com',
      });
      alertSent = res.success;
      alertError = res.error;
    }

    return NextResponse.json({
      success: true,
      status: isStale ? 'stale' : 'healthy',
      thresholdHours: 3,
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
