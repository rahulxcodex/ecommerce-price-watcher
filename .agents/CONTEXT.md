# Project Context: Ecommerce Price Watcher
- Tech Stack: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Supabase PostgreSQL, Web Push, Cheerio/Playwright.
- Architecture:
  - `src/app`: Pages (`/`, `/dashboard`, `/add`, `/product/[id]`, `/settings`, `/extension`, `/icon`) and API routes (`/api/products`, `/api/push`, `/api/push/test`, `/api/settings`, `/api/alerts/test`, `/api/extension/download`, `/api/telegram/test`, `/api/telegram/webhook`).
  - `src/lib`: `supabase.ts`, `security.ts`, `web-push.ts`, `appscript-email.ts`, `zip.ts`, `utils.ts`.
  - `scripts`: Scrapers (`amazon`, `flipkart`, `myntra`, `ajio`, `meesho`, `westside`), `check-prices.ts`, `notify.ts`.
  - `extension`: Chrome/Edge/Brave extension companion (Manifest v3, popup UI, store auto-detection, direct dashboard sync).
- Milestones Completed:
  1. Favicon 404 resolved: Valid multi-resolution ICO, SVG, PNGs (192, 512, badge-72) and dynamic `/icon` route.
  2. Multi-Account Alert Pipeline: Telegram (comma-separated chat IDs/groups), WhatsApp (multi-number), Email (multi-address).
  3. Push Notification Diagnostics: Byte-converted VAPID keys, blocked permission recovery guidance, native & server test triggers.
  4. Free Alert Alternatives: Discord Webhooks (rich embeds, 100% free), ntfy.sh (zero setup, instant phone lock-screen push), Telegram Bot, CallMeBot WhatsApp, Apps Script Gmail.
  5. Extension Companion: Auto store detection, 1-click tracking, `/api/extension/download` dynamic zip bundling, dedicated `/extension` guide.
  6. Production Deployment: Verified live on Vercel (`https://ecommerce-price-watcher-puce.vercel.app`) with 0 errors.
