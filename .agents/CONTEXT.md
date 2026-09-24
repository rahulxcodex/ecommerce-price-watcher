# Ecommerce Price Watcher — Project Context

## Architecture
- **Framework**: Next.js 14 App Router on Vercel free tier
- **Database**: Supabase PostgreSQL with RLS (5 migrations)
- **Scraper**: 5-tier resilient architecture (JSON-LD → Platform APIs → OpenGraph → CSS selectors → Playwright headless), runs via GitHub Actions cron every 6h
- **Notifications**: 5 channels (Telegram, WhatsApp/CallMeBot, Email/Google Apps Script, Discord Webhook, ntfy.sh)
- **Extension**: Chrome extension (Manifest V3) for 1-click product tracking
- **Charts**: Recharts SVG line charts

## Platforms Supported
Amazon India, Flipkart, Meesho, Myntra, Ajio, Westside

## Key File Map
| Path | Purpose |
|------|---------|
| `src/app/page.tsx` | Landing page |
| `src/app/dashboard/page.tsx` | Product dashboard with filtering/sorting |
| `src/app/add/page.tsx` | Add product URL form |
| `src/app/product/[id]/page.tsx` | Product detail with price chart |
| `src/app/settings/page.tsx` | Notification settings (800+ line monolith) |
| `src/app/api/` | 9 API routes (products CRUD, settings, push, telegram, alerts, extension) |
| `src/lib/security.ts` | SSRF defense, URL validation, anti-hallucination guards |
| `src/lib/zip.ts` | Pure-JS ZIP archiver for extension download |
| `scripts/check-prices.ts` | Main scraper orchestrator |
| `scripts/notify.ts` | Multi-channel notification dispatcher |
| `scripts/scrapers/*.ts` | 6 platform-specific scrapers |
| `extension/` | Chrome extension popup + manifest |
| `google-apps-script/Code.gs` | Gmail email dispatch backend |

## Current Milestone
Full audit completed (Sep 2024). 36-item implementation plan created covering:
- 6 items: dead code deletion (~200 lines)
- 7 items: security hardening (CORS wildcard, extension perms)
- 5 items: performance optimization (next/image, useMemo)
- 5 items: DSA/architecture (monotonic deque, strategy pattern, indexes)
- 8 items: new features (price prediction, thresholds, comparison, CSV export)
- UI/UX web craft overhaul
- Test coverage gaps identified
