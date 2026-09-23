# E-Commerce Price Tracker — Project Context

## Project Name
Ecommerce Price Watcher (Amazon, Flipkart, Meesho)

## Status
🟢 Built & Verified — Production Ready & Security Hardened

## Architecture (100% Free Stack)
- **Frontend**: Next.js 14 (App Router) on Vercel (`bom1` region)
- **Database**: Supabase PostgreSQL with strict Row Level Security (RLS)
- **Automation / Scraper**: GitHub Actions cron (`0 */6 * * *`)
- **Scraping Engines**:
  - Amazon India: Fast Cheerio SSR parser with fallback selectors
  - Flipkart: Schema.org JSON-LD extraction + Playwright Chromium fallback
  - Meesho: Preloaded Next.js state parser + Playwright Chromium fallback
- **Alerts**: Telegram Bot API (instant, unlimited, free)
- **Visuals**: Recharts responsive line charts + Tailwind CSS dark slate theme

## Security Architecture Implemented
1. **SSRF Defense**: Strict whitelist regex (`amazon.in`, `flipkart.com`, `meesho.com`), blocked private IP ranges (RFC1918, RFC3927, loopback, cloud metadata `169.254.169.254`).
2. **Price Sanity Checks**: Rejects zero/negative values and flags >98% anomalies.
3. **Database RLS**: Strict per-user isolation, DoS product count cap (50/user).
4. **Webhook Security**: Constant-time token verification (`safeCompare`).
5. **Secret Isolation**: `SUPABASE_SERVICE_ROLE_KEY` isolated to backend scraper only.

## Key Files
- `src/lib/security.ts` — SSRF validator, URL sanitizer, price sanity checker
- `supabase/migrations/001_initial_schema.sql` — RLS policies, tables, indexes
- `scripts/check-prices.ts` — GitHub Actions cron orchestrator
- `scripts/scrapers/` — Amazon, Flipkart, Meesho scrapers
- `scripts/notify.ts` — Telegram Bot alert dispatcher
- `.github/workflows/price-check.yml` — 6-hour cron action
- `src/app/` — Dashboard, Add Product, Product Detail (Chart), Settings, API routes
- `tests/security-and-utils.test.ts` — Security test suite (all passed)
- `docs/telegram-setup.md` — 60-second Telegram bot setup guide
- `vercel.json` — Deployment region config
