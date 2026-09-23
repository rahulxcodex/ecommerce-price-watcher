# E-Commerce Price Tracker — Project Context

## Project Name
Ecommerce Price Watcher (Amazon, Flipkart, Meesho, Myntra, Ajio, Westside)

## Status
🟢 Built & Verified — Production Ready & Multi-Platform Resilient

## Architecture (100% Free Stack)
- **Frontend**: Next.js 14 (App Router) on Vercel (`bom1` region)
- **Database**: Supabase PostgreSQL with strict Row Level Security (RLS)
- **Automation / Scraper**: GitHub Actions cron (`0 */6 * * *`)
- **Scraping Engines (5-Tier HTML-Change Resilient)**:
  - Amazon India: Fast Cheerio SSR + JSON-LD / Meta fallback
  - Flipkart: Schema.org JSON-LD + Meta fallback + Playwright Chromium
  - Meesho: Preloaded Next.js state parser + JSON-LD / Meta + Playwright Chromium
  - Myntra: window.__myx pdpData hydration + JSON-LD + Meta + Playwright Chromium
  - Ajio: Native JSON API (/api/p/{code}) + JSON-LD + Preloaded state + Playwright Chromium
  - Westside: Shopify Product JSON API (/products/{handle}.js) + JSON-LD + Meta + Playwright Chromium
- **Alerts**: Telegram Bot API (instant, unlimited, free)
- **Visuals**: Recharts responsive line charts + Tailwind CSS dark slate theme

## Security Architecture Implemented
1. **SSRF Defense**: Strict whitelist regex (`amazon.in`, `flipkart.com`, `meesho.com`, `myntra.com`, `ajio.com`, `westside.com`), blocked private IP ranges (RFC1918, RFC3927, loopback, cloud metadata `169.254.169.254`).
2. **Price Sanity Checks**: Rejects zero/negative values and flags >98% anomalies.
3. **Database RLS**: Strict per-user isolation, DoS product count cap (50/user).
4. **Webhook Security**: Constant-time token verification (`safeCompare`).
5. **Secret Isolation**: `SUPABASE_SERVICE_ROLE_KEY` isolated to backend scraper only.

## Key Files
- `src/lib/security.ts` — SSRF validator, URL sanitizer, price sanity checker
- `supabase/migrations/001_initial_schema.sql` — RLS policies, tables, indexes
- `scripts/check-prices.ts` — GitHub Actions cron orchestrator
- `scripts/scrapers/` — Amazon, Flipkart, Meesho, Myntra, Ajio, Westside resilient scrapers
- `scripts/scrapers/resilient-extractor.ts` — Common 5-tier HTML-change agnostic extractor
- `scripts/notify.ts` — Telegram Bot alert dispatcher
- `.github/workflows/price-check.yml` — 6-hour cron action
- `src/app/` — Dashboard, Add Product, Product Detail (Chart), Settings, API routes
- `tests/security-and-utils.test.ts` — Security test suite (all passed)
- `tests/ecommerce-urls.test.ts` — 22/22 multi-platform URL tests passed
- `tests/resilient-scrapers.test.ts` — 5/5 HTML-change resilience tests passed
- `tests/red-hat-security.test.ts` — 33/33 adversarial security tests passed
- `tests/browser-e2e.test.ts` — 8/8 Playwright headless browser E2E tests passed
- `tests/appscript-email.test.ts` — Apps Script payload & client tests passed
- `docs/appscript-email-setup.md` — 60-second Apps Script email setup guide
- `docs/telegram-setup.md` — 60-second Telegram bot setup guide
- `vercel.json` — Deployment region config
- `supabase/migrations/002_allow_anonymous_products.sql` — Anonymous product tracking schema fix
- `supabase/migrations/003_add_myntra_ajio_westside.sql` — Platform enum extension migration

## Deployments
- **GitHub**: [rahulxcodex/ecommerce-price-watcher](https://github.com/rahulxcodex/ecommerce-price-watcher)
- **Vercel Production**: [ecommerce-price-watcher-puce.vercel.app](https://ecommerce-price-watcher-puce.vercel.app) (Region: `bom1`, Status: `READY`, 0 errors)
- **Google Apps Script Web App**: `https://script.google.com/macros/s/AKfycbzTDNDaK0ePs8gco-LMnZin2Aw8PYB_UQumhquVb8f90uKHN_ylQ_6UobJJEBkxzL342Q/exec` (Status: `active`, Quota: 98 remaining)
