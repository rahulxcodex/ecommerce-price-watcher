import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import {
  SCRAPER_CRON_INTERVAL_HOURS,
  SCRAPER_EMERGENCY_THRESHOLD_HOURS,
  SCRAPER_CATCHUP_INTERVAL_MINUTES,
  evaluateScraperStaleness,
} from '../src/lib/constants';

/**
 * Lightweight Preflight Staleness Evaluator
 * Runs in <3 seconds in GitHub Actions and local environments.
 * Determines whether a full scraper cycle is due, in emergency 30-minute catch-up mode, or healthy.
 */
async function main() {
  const isForce =
    process.env.FORCE_RUN === 'true' ||
    process.argv.includes('--force') ||
    process.env.INPUT_FORCE === 'true';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ [Preflight] Supabase credentials not found in environment. Defaulting to should_run=true for safety.');
    writeGithubOutput({ shouldRun: true, mode: 'forced', elapsedHours: 99, reason: 'Credentials missing; failing safe.' });
    process.exit(0);
  }

  let elapsedHours: number | null = null;
  let mostRecentTime: number | null = null;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Query most recent successful scrape across active products
    const { data: products, error: prodErr } = await supabase
      .from('products')
      .select('last_successful_scrape_at, last_checked_at')
      .eq('is_active', true)
      .order('last_checked_at', { ascending: false, nullsFirst: false })
      .limit(10);

    if (prodErr) {
      console.warn(`⚠️ [Preflight] Failed to fetch products: ${prodErr.message}. Failing safe to should_run=true.`);
      writeGithubOutput({ shouldRun: true, mode: 'emergency_catchup', elapsedHours: 99, reason: prodErr.message });
      process.exit(0);
    }

    if (products && products.length > 0) {
      const timestamps = products
        .map((p) => {
          const t = p.last_successful_scrape_at || p.last_checked_at;
          return t ? new Date(t).getTime() : 0;
        })
        .filter((t) => t > 0);

      if (timestamps.length > 0) {
        mostRecentTime = Math.max(...timestamps);
        elapsedHours = (Date.now() - mostRecentTime) / (1000 * 60 * 60);
      }
    }

    // 2. Cross-reference with scrape_runs telemetry for overall pipeline completion
    const { data: latestRun } = await supabase
      .from('scrape_runs')
      .select('finished_at, status')
      .eq('status', 'completed')
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestRun?.finished_at) {
      const runTime = new Date(latestRun.finished_at).getTime();
      if (!mostRecentTime || runTime > mostRecentTime) {
        mostRecentTime = runTime;
        elapsedHours = (Date.now() - runTime) / (1000 * 60 * 60);
      }
    }
  } catch (err) {
    console.error('⚠️ [Preflight] Unexpected error querying database:', err);
    writeGithubOutput({ shouldRun: true, mode: 'emergency_catchup', elapsedHours: 99, reason: String(err) });
    process.exit(0);
  }

  const decision = evaluateScraperStaleness(elapsedHours, isForce);

  console.log('----------------------------------------------------');
  console.log('🔍 SCALABLE PREFLIGHT STALENESS AUDIT');
  console.log('----------------------------------------------------');
  console.log(`⏱️  Elapsed Time:     ${elapsedHours !== null ? `${elapsedHours.toFixed(2)} hours` : 'Unknown (No record)'}`);
  console.log(`🕒 Standard Cycle:   ${SCRAPER_CRON_INTERVAL_HOURS} hours`);
  console.log(`🚨 Emergency Limit:  ${SCRAPER_EMERGENCY_THRESHOLD_HOURS} hours (retries every ${SCRAPER_CATCHUP_INTERVAL_MINUTES}m)`);
  console.log(`🎯 Decision Mode:    [${decision.mode.toUpperCase()}]`);
  console.log(`🚀 Should Execute:   ${decision.shouldRun ? 'YES' : 'NO'}`);
  console.log(`💬 Decision Reason:  ${decision.reason}`);
  console.log('----------------------------------------------------');

  writeGithubOutput({
    shouldRun: decision.shouldRun,
    mode: decision.mode,
    elapsedHours: elapsedHours !== null ? Math.round(elapsedHours * 100) / 100 : 99,
    reason: decision.reason,
  });

  process.exit(0);
}

function writeGithubOutput(params: {
  shouldRun: boolean;
  mode: string;
  elapsedHours: number;
  reason: string;
}) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath && fs.existsSync(outputPath)) {
    const lines = [
      `should_run=${params.shouldRun}`,
      `mode=${params.mode}`,
      `elapsed_hours=${params.elapsedHours}`,
      `reason=${params.reason.replace(/\r?\n/g, ' ')}`,
    ].join('\n') + '\n';
    fs.appendFileSync(outputPath, lines, 'utf8');
  }
}

main();
