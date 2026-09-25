import fs from 'node:fs';

const SCRAPER_STALE_THRESHOLD_HOURS = 5;
const SCRAPER_EMERGENCY_THRESHOLD_HOURS = 6;
const SCRAPER_CATCHUP_INTERVAL_MINUTES = 30;
const SCRAPER_CRON_INTERVAL_HOURS = 4;

/**
 * Pure deterministic staleness evaluator
 */
export function evaluateScraperStaleness(elapsedHours, force = false) {
  if (force) {
    return {
      shouldRun: true,
      mode: 'forced',
      reason: 'Manual or forced execution requested.',
    };
  }
  if (elapsedHours === null || elapsedHours === undefined || !Number.isFinite(elapsedHours)) {
    return {
      shouldRun: true,
      mode: 'emergency_catchup',
      reason: 'No previous scrape timestamp found. Initializing scraper run.',
    };
  }
  if (elapsedHours >= SCRAPER_EMERGENCY_THRESHOLD_HOURS) {
    return {
      shouldRun: true,
      mode: 'emergency_catchup',
      reason: `Staleness (${elapsedHours.toFixed(1)}h) exceeds emergency threshold (${SCRAPER_EMERGENCY_THRESHOLD_HOURS}h). Accelerated 30m catch-up active until success.`,
    };
  }
  if (elapsedHours >= SCRAPER_CRON_INTERVAL_HOURS) {
    return {
      shouldRun: true,
      mode: 'scheduled_cycle',
      reason: `Elapsed time (${elapsedHours.toFixed(1)}h) reached standard cycle interval (${SCRAPER_CRON_INTERVAL_HOURS}h).`,
    };
  }
  return {
    shouldRun: false,
    mode: 'idle_healthy',
    reason: `System is healthy: Last scrape was ${elapsedHours.toFixed(1)}h ago (< ${SCRAPER_CRON_INTERVAL_HOURS}h cycle). Next check in ${SCRAPER_CATCHUP_INTERVAL_MINUTES}m.`,
  };
}

async function run() {
  const isForce =
    process.env.FORCE_RUN === 'true' ||
    process.argv.includes('--force') ||
    process.env.INPUT_FORCE === 'true';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️ [Preflight] Supabase credentials not found in environment. Defaulting to should_run=true for safety.');
    writeGithubOutput({ shouldRun: true, mode: 'forced', elapsedHours: 99, reason: 'Credentials missing; failing safe.' });
    process.exit(0);
  }

  let elapsedHours = null;
  let mostRecentTime = null;

  try {
    const headers = {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      Accept: 'application/json',
    };

    // 1. Fetch latest active product scrape timestamps using native fetch
    const prodRes = await fetch(
      `${supabaseUrl}/rest/v1/products?is_active=eq.true&select=last_successful_scrape_at,last_checked_at&order=last_checked_at.desc.nullslast&limit=15`,
      { headers, signal: AbortSignal.timeout(6000) }
    );

    if (prodRes.ok) {
      const products = await prodRes.json();
      if (Array.isArray(products) && products.length > 0) {
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
    } else {
      console.warn(`⚠️ [Preflight] REST API returned status ${prodRes.status}.`);
    }

    // 2. Cross-reference with scrape_runs telemetry
    try {
      const runRes = await fetch(
        `${supabaseUrl}/rest/v1/scrape_runs?status=eq.completed&select=finished_at&order=finished_at.desc&limit=1`,
        { headers, signal: AbortSignal.timeout(4000) }
      );
      if (runRes.ok) {
        const runs = await runRes.json();
        if (Array.isArray(runs) && runs[0]?.finished_at) {
          const runTime = new Date(runs[0].finished_at).getTime();
          if (!mostRecentTime || runTime > mostRecentTime) {
            mostRecentTime = runTime;
            elapsedHours = (Date.now() - runTime) / (1000 * 60 * 60);
          }
        }
      }
    } catch {
      // Non-fatal if scrape_runs table query fails
    }
  } catch (err) {
    console.error('⚠️ [Preflight] Network or query error:', err.message || err);
    // On unexpected error, fail-safe to running the scraper so price updates are not blocked
    writeGithubOutput({ shouldRun: true, mode: 'emergency_catchup', elapsedHours: 99, reason: 'Preflight query failed; failing safe.' });
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

function writeGithubOutput(params) {
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

// Execute when invoked directly
if (process.argv[1]?.endsWith('check-staleness.mjs')) {
  run();
}
