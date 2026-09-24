# Project Context: Ecommerce Price Watcher
- Tech Stack: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Supabase PostgreSQL, Web Push, Cheerio/Scrapers.
- Architecture:
  - `src/app`: Pages (Dashboard, Add, Product, Settings) and API routes (`/api/products`, `/api/push`, `/api/settings`, `/api/telegram`).
  - `src/lib`: Supabase clients, notification dispatchers, types, and db helpers.
  - `scripts`: Scrapers (`amazon`, `flipkart`, `myntra`, `ajio`, `meesho`, `westside`), `check-prices.ts`, `notify.ts`.
  - `extension`: Chrome extension (Manifest v3, popup) for one-click product tracking.
- Status:
  - Multi-channel notification pipeline (Push, Email, Telegram, WhatsApp/Discord).
  - Vercel-deployed application.
