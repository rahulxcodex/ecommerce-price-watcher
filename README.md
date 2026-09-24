# 🏷️ E-Commerce Price Watcher

An automated, multi-platform product price tracking web application for **Amazon India**, **Flipkart**, **Meesho**, **Myntra**, **Ajio**, and **Westside**. Paste any product link, view price trends over time, and receive instant Telegram alerts whenever an item hits its **all-time lowest price**.

Deployed **100% free** on Vercel, Supabase, GitHub Actions, and Telegram Bot API.

---

## 🚀 Free-Tier Architecture

```
[ Next.js 14 Web App ] (Vercel Free Tier)
         │
         ▼
[ Supabase PostgreSQL ] (Free 500MB DB with RLS Security)
         ▲
         │
[ GitHub Actions Cron ] (Runs every 4 hours on free Linux runners)
         │  Scrapes Amazon, Flipkart, Meesho, Myntra, Ajio, Westside
         ▼
[ Telegram Bot Alerts ] (100% Free, Unlimited Instant Push Notifications)
```

---

## 🔒 Built-in Security Architecture

1. **SSRF (Server-Side Request Forgery) Defense**:
   - Strict hostname regex whitelisting (`amazon.in`, `flipkart.com`, `meesho.com`, `myntra.com`, `ajio.com`, `westside.com`).
   - Rejection of private IPv4/IPv6 ranges (RFC 1918, RFC 3927), localhost, loopback (`127.0.0.1`), and cloud metadata IP endpoints (`169.254.169.254`).
   - Automatic stripping of affiliate and tracking parameters.

2. **Price Anomaly & Anti-Hallucination Guards**:
   - Rejection of negative or zero values.
   - Upper bound constraints and detection of abnormal >98% price collapses caused by DOM selector mismatch or shipping badge mixups.

3. **Database Row-Level Security (RLS)**:
   - Supabase RLS policies enforce that users can strictly read, update, and delete only products they track.
   - DoS guard: Maximum 50 products per account limit enforced at PostgreSQL policy level.

4. **Webhook Timing-Attack Resistance**:
   - Telegram webhook validation uses constant-time string comparison (`safeCompare`).

5. **Secret Isolation**:
   - `SUPABASE_SERVICE_ROLE_KEY` is strictly reserved for the background scraper and never exposed to the frontend bundle.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS with dark slate theme
- **Database**: Supabase PostgreSQL with Row Level Security
- **Scraper Engine**: 5-Tier Resilient Architecture (JSON-LD Schema.org + Platform Native APIs/Hydration State + OpenGraph Meta Tags + Multi-Selector Fallback + Headless Playwright Chromium)
- **Automation**: GitHub Actions Cron (`0 */6 * * *`)
- **Notifications**: Telegram Bot API
- **Charts**: Recharts responsive SVG line charts

---

## ⚙️ Quick Start

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd "Ecommerce tracker"
npm install
```

### 2. Environment Variables
Copy `.env.example` to `.env.local` and add your keys:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

### 3. Database Migration
Run the SQL script located at:
`supabase/migrations/001_initial_schema.sql`
inside your Supabase SQL Editor.

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Run Scraper Manually
```bash
npm run scrape
```

---

## 🌐 1-Click Free Deployment

1. **Database**: Create a free project on [Supabase](https://supabase.com) and paste `supabase/migrations/001_initial_schema.sql` into the SQL Editor.
2. **Frontend**: Push repository to GitHub, connect to [Vercel](https://vercel.com), and deploy.
3. **Automated Cron**: In your GitHub repository **Settings** > **Secrets and variables** > **Actions**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TELEGRAM_BOT_TOKEN`

The GitHub Actions workflow `.github/workflows/price-check.yml` will automatically check prices every 4 hours and ping your Telegram on price drops.
