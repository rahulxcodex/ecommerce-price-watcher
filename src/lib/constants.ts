/**
 * Centralized Application Constants & Operational Parameters
 */

// Scraper stale watchdog threshold (hours)
export const SCRAPER_STALE_THRESHOLD_HOURS = 5;

// Scraper emergency catch-up threshold (hours) - triggers accelerated 30-minute retries
export const SCRAPER_EMERGENCY_THRESHOLD_HOURS = 6;

// High-frequency catch-up retry cadence (minutes) when in emergency mode
export const SCRAPER_CATCHUP_INTERVAL_MINUTES = 30;

// Default scheduled cron frequency (hours)
export const SCRAPER_CRON_INTERVAL_HOURS = 4;

export type ScraperRunDecision = {
  shouldRun: boolean;
  mode: 'forced' | 'emergency_catchup' | 'scheduled_cycle' | 'idle_healthy';
  reason: string;
};

/**
 * Pure deterministic evaluator for scraper scheduling, emergency catch-up, and preflight checks.
 * - If forced: executes immediately.
 * - If elapsed >= 6h: triggers emergency 30-minute catch-up until a successful run is recorded.
 * - If elapsed >= 4h: triggers regular scheduled 4h cycle.
 * - Otherwise: skips execution to conserve compute.
 */
export function evaluateScraperStaleness(
  elapsedHours: number | null,
  force = false
): ScraperRunDecision {
  if (force) {
    return {
      shouldRun: true,
      mode: 'forced',
      reason: 'Manual or forced execution requested.',
    };
  }
  if (elapsedHours === null || elapsedHours === undefined || !isFinite(elapsedHours)) {
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

// Default fallback administrator email for notifications & special combined access
export const DEFAULT_ADMIN_EMAIL = 'rahulr24g@gmail.com';

// Resolves runtime admin email from environment variables with graceful fallback
export function getAdminEmail(): string {
  return (
    process.env.ADMIN_EMAIL?.trim() ||
    process.env.COMBINED_ACCESS_EMAIL?.trim() ||
    DEFAULT_ADMIN_EMAIL
  );
}

// Scraper batch pagination chunk size to prevent memory accumulation in CI runners
export const SCRAPER_BATCH_SIZE = 50;

// Maximum parallel concurrent scraper workers
export const MAX_SCRAPER_WORKERS = 4;

// Minimum and maximum randomized pacing delay between consecutive requests to the same storefront (ms)
export const PLATFORM_PACING_MIN_MS = 3000;
export const PLATFORM_PACING_JITTER_MS = 2000;

// Maximum items permitted in a single bulk discovery addition
export const MAX_BULK_ADD_ITEMS = 15;

// Maximum permitted lengths for user-provided fields to prevent buffer exhaustion DoS
export const MAX_URL_LENGTH = 2048;
export const MAX_TITLE_LENGTH = 500;
export const MAX_NOTES_LENGTH = 1000;
