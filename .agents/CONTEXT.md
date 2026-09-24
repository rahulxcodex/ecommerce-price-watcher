# Project Context: Ecommerce Price Watcher
- Tech Stack: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Supabase PostgreSQL, Web Push, Cheerio/Playwright.
- Architecture:
  - `src/app`: Pages (`/`, `/dashboard`, `/add`, `/product/[id]`, `/settings`, `/extension`, `/icon`) and API routes (`/api/products`, `/api/push`, `/api/push/test`, `/api/settings`, `/api/alerts/test`, `/api/extension/download`, `/api/telegram/test`, `/api/telegram/webhook`).
  - `src/lib`: `supabase.ts`, `security.ts`, `web-push.ts`, `appscript-email.ts`, `zip.ts`, `utils.ts`.
  - `scripts`: Scrapers (`amazon`, `flipkart`, `myntra`, `ajio`, `meesho`, `westside`), `check-prices.ts`, `notify.ts`, `utils.ts` (`isPlaywrightAvailable`).
  - `extension`: Chrome/Edge/Brave companion extension v1.2.0 (Manifest v3 with `scripting` & `activeTab`, in-page DOM price extraction, 1-click tracking bypass).
  - `supabase/RUN_ALL_PENDING_MIGRATIONS.sql`: Consolidated script for enum additions, variant columns, and alert settings.
- Milestones Completed:
  1. Favicon 404 resolved: Multi-resolution ICO, SVG, PNGs (192, 512, badge-72) and dynamic `/icon` route.
  2. Multi-Account Alert Pipeline: Telegram (comma-separated chat IDs/groups), WhatsApp (multi-number), Email (multi-address).
  3. Push Notification Diagnostics: Byte-converted VAPID keys, blocked permission recovery guidance, native & server test triggers.
  4. Free Alert Alternatives: Discord Webhooks (rich embeds, 100% free), ntfy.sh (zero setup, instant phone lock-screen push), Telegram Bot, CallMeBot WhatsApp, Apps Script Gmail.
  5. Extension Companion v1.2.0: Active tab DOM extraction for live rendered price/title/image, bypassing cloud serverless anti-bot limits, downloadable from `/api/extension/download`.
  6. Resilient Scraper & Schema Architecture:
     - `isPlaywrightAvailable()` guards in all scrapers preventing runtime binary missing crashes on Vercel serverless.
     - Graceful schema cache fallback in `/api/products` and `check-prices.ts` preventing `bank_offers` missing column errors.
     - Anonymous `user_id: null` default preventing `products_user_id_fkey` constraint errors.
     - Actionable diagnostic guidance for `platform_type` store additions.
  7. Production Deployment: Verified live on Vercel (`https://ecommerce-price-watcher-puce.vercel.app`) with 0 errors.
