import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { supabase as publicSupabase } from '@/lib/supabase';
import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { getAdminEmail } from '@/lib/constants';
import { Platform } from '@/types';

export const dynamic = 'force-dynamic';

function getDbClient() {
  try {
    return getServiceSupabase();
  } catch {
    return publicSupabase;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
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
    const isAuthorized = Boolean(session) || isApiKeyValid;

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Authentication required to view scraper health telemetry.' },
        { status: 401 }
      );
    }

    const db = getDbClient();

    // 1. Fetch recent scrape_runs (last 30 runs)
    const { data: runs, error: runsErr } = await db
      .from('scrape_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(30);

    if (runsErr) {
      console.warn('[Scraper Health API] scrape_runs query warning:', runsErr);
    }

    const runList = runs || [];

    // Calculate aggregated metrics
    const totalRuns = runList.length;
    let totalProductsChecked = 0;
    let totalSuccessCount = 0;
    let totalErrorCount = 0;
    let totalDurationMs = 0;
    let durationCount = 0;

    for (const r of runList) {
      totalProductsChecked += r.total_products || 0;
      totalSuccessCount += r.success_count || 0;
      totalErrorCount += r.error_count || 0;
      if (r.duration_ms && r.duration_ms > 0) {
        totalDurationMs += r.duration_ms;
        durationCount++;
      }
    }

    const globalSuccessRate =
      totalProductsChecked > 0
        ? Number(((totalSuccessCount / totalProductsChecked) * 100).toFixed(1))
        : 100;

    const avgDurationSeconds =
      durationCount > 0
        ? Number((totalDurationMs / durationCount / 1000).toFixed(1))
        : 0;

    // 2. Fetch recent scrape_run_items to aggregate platform breakdown (last 200 items)
    const { data: items } = await db
      .from('scrape_run_items')
      .select('platform, status, error, created_at, duration_ms')
      .order('created_at', { ascending: false })
      .limit(200);

    const platformStats: Record<string, { total: number; success: number; errors: number; errorRate: number }> = {
      amazon: { total: 0, success: 0, errors: 0, errorRate: 0 },
      flipkart: { total: 0, success: 0, errors: 0, errorRate: 0 },
      meesho: { total: 0, success: 0, errors: 0, errorRate: 0 },
      myntra: { total: 0, success: 0, errors: 0, errorRate: 0 },
      ajio: { total: 0, success: 0, errors: 0, errorRate: 0 },
      westside: { total: 0, success: 0, errors: 0, errorRate: 0 },
    };

    const recentErrors: Array<{ platform: string; error: string; created_at: string }> = [];

    if (items) {
      for (const item of items) {
        const plat = (item.platform || 'unknown').toLowerCase();
        if (!platformStats[plat]) {
          platformStats[plat] = { total: 0, success: 0, errors: 0, errorRate: 0 };
        }
        platformStats[plat].total++;
        if (item.status === 'ok' || item.status === 'out_of_stock') {
          platformStats[plat].success++;
        } else {
          platformStats[plat].errors++;
          if (item.error && recentErrors.length < 8) {
            recentErrors.push({
              platform: item.platform,
              error: item.error,
              created_at: item.created_at,
            });
          }
        }
      }

      for (const key of Object.keys(platformStats)) {
        const p = platformStats[key];
        p.errorRate = p.total > 0 ? Number(((p.errors / p.total) * 100).toFixed(1)) : 0;
      }
    }

    // 3. Fetch count of active products
    const { count: activeProductCount } = await db
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    return NextResponse.json({
      success: true,
      metrics: {
        totalRuns,
        activeProductCount: activeProductCount || 0,
        globalSuccessRate,
        avgDurationSeconds,
        lastRun: runList[0] || null,
      },
      platformStats,
      recentErrors,
      recentRuns: runList.slice(0, 10),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
