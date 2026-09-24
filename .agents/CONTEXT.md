# E-Commerce Price Tracker — Project Context

## Project Name
Ecommerce Price Watcher (Amazon, Flipkart, Meesho, Myntra, Ajio, Westside)

## Status
🟢 Built & Verified — Production Ready Personal Tracker (Web Push, WhatsApp, Chrome Ext, DS Analytics)

## Architecture (100% Free Stack)
- **Frontend**: Next.js 14 (App Router) on Vercel (`bom1` region)
- **Database**: Supabase PostgreSQL with anonymous single-user support
- **Automation / Scraper**: GitHub Actions cron (`0 */6 * * *`)
- **Scraping Engines**: Amazon, Flipkart, Meesho, Myntra, Ajio, Westside with variant & bank offer extraction
- **Alert Dispatchers**:
  - Telegram Bot API (instant MarkdownV2 alerts)
  - Free WhatsApp Gateway (CallMeBot personal API)
  - Free Email Alerts (Google Apps Script Gmail API)
  - Native In-Browser Web Push API (Service Worker with VAPID)
- **Companion Chrome Extension**: Manifest V3 1-click product tracker
- **Data Science Analytics**: "Buy Now vs Wait" predictive model + Deceptive MRP anchor detector
- **Visuals**: Recharts price history curves + Tailwind dark theme

## Key Files
- `src/lib/security.ts` — SSRF validator, URL sanitizer, price sanity checker
- `src/lib/web-push.ts` — Web Push VAPID dispatcher
- `public/sw.js` — Service Worker for instant push notifications
- `scripts/check-prices.ts` — GitHub Actions cron orchestrator with priority queue & back-in-stock alerts
- `scripts/notify.ts` — Multi-channel alert dispatcher (Telegram, WhatsApp, Email)
- `scripts/scrapers/` — Amazon, Flipkart, Meesho, Myntra, Ajio, Westside resilient scrapers
- `extension/` — Chrome / Edge 1-click tracker companion extension
- `src/app/` — Personal Dashboard, Add Product, Product Detail (DS Analytics), Settings
- `supabase/migrations/004_personal_settings_and_variants.sql` — Variants, bank offers, app settings schema

## Deployments
- **GitHub**: [rahulxcodex/ecommerce-price-watcher](https://github.com/rahulxcodex/ecommerce-price-watcher)
- **Vercel Production**: [ecommerce-price-watcher-puce.vercel.app](https://ecommerce-price-watcher-puce.vercel.app) (Region: `bom1`, Status: `READY`)
- **Google Apps Script Web App**: Connected and verified for email dispatching
