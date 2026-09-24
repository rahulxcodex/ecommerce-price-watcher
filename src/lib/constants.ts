/**
 * Centralized Application Constants & Operational Parameters
 */

// Scraper stale watchdog threshold (hours)
export const SCRAPER_STALE_THRESHOLD_HOURS = 5;

// Default scheduled cron frequency (hours)
export const SCRAPER_CRON_INTERVAL_HOURS = 4;

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
