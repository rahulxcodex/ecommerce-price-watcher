# Ecommerce Price Watcher — Project Context

## Architecture
- **Framework**: Next.js 14 App Router on Vercel free tier
- **Database**: Supabase PostgreSQL with RLS (6 migrations, including 006 composite performance indexes)
- **Scraper**: 5-tier resilient architecture with truncated exponential backoff & full jitter
- **Decision Science & DSA**: Monotonic deque O(N) sliding window minimums, Ordinary Least Squares (OLS) linear regression price trajectory prediction
- **Notifications**: 5 channels (Telegram, WhatsApp/CallMeBot, Email/Google Apps Script, Discord Webhook, ntfy.sh)
- **Extension**: Chrome extension (Manifest V3) with scoped domain permissions and CSP
- **Charts**: Recharts SVG line charts with memoized data pipelines

## Platforms Supported
Amazon India, Flipkart, Meesho, Myntra, Ajio, Westside

## Key File Map
| Path | Purpose |
|------|---------|
| `src/app/page.tsx` | Landing page |
| `src/app/dashboard/page.tsx` | Product dashboard with filtering/sorting (memoized) + CSV/JSON export |
| `src/app/add/page.tsx` | Add product URL form with client-side SSRF validation |
| `src/app/product/[id]/page.tsx` | Product detail with next/image + DSA predictive analytics & rolling lows |
| `src/app/settings/page.tsx` | Multi-channel alert configuration |
| `src/app/api/` | Secure API routes with strict CORS origin allowlist and input sanitizers |
| `src/lib/security.ts` | SSRF defense, push endpoint verification, settings input sanitization |
| `src/lib/dsa.ts` | Monotonic deque sliding window minimums, linear regression slope predictor |
| `src/lib/zip.ts` | Pure-JS ZIP archiver for extension download |
| `scripts/check-prices.ts` | Main scraper orchestrator with GitHub Actions concurrency protection |
| `scripts/notify.ts` | Multi-channel notification dispatcher |
| `scripts/scrapers/utils.ts` | Scraper headers, price parser, and fetchWithBackoff jitter |
| `extension/` | Chrome extension popup + scoped manifest |

## Current Milestone (Completed & Deployed)
- [x] Phase 1: Dead code & redundant types deleted (`HouseholdSettings`, `PushSubscriptionRecord`, `UserProfile`, duplicate `appscript-email.ts`, dead Tailwind paths).
- [x] Phase 2: Security hardening (scoped CORS allowlist, scoped extension `host_permissions` + CSP, VAPID fallback removal, push endpoint validator, settings sanitizer, client URL validation).
- [x] Phase 3: Performance optimization (`next/image` in product cards & detail pages, memoized filtering/sorting/counting in dashboard, memoized chart data).
- [x] Phase 4: DSA & Architecture (O(N) monotonic deque sliding window minimum, AWS full jitter backoff in scrapers, performance database indexes in `006_add_performance_indexes.sql`).
- [x] Phase 5: New features (CSV export on dashboard, price trend directional prediction badge, 7d/30d rolling floor indicators, restock detection).
- [x] Phase 6: Full test suite passing (100% across 6 test suites, 70+ assertions).
- [x] Phase 7: Pushed to GitHub `main` and deployed to Vercel production.
- [x] Phase 8: Mobile-Friendly & Responsive UI Overhaul (Next.js Viewport export, mobile hamburger navigation drawer, touch-scrollable platform chips, responsive dashboard/detail/settings/add/extension pages, zero horizontal scroll, full build and test verification).
