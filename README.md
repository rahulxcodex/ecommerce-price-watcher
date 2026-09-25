# 🏷️ E-Commerce Price Watcher & Market Intelligence

[![CI Quality Gates](https://github.com/rahulxcodex/ecommerce-price-watcher/actions/workflows/ci.yml/badge.svg)](https://github.com/rahulxcodex/ecommerce-price-watcher/actions/workflows/ci.yml)
[![Price Watcher Cron](https://github.com/rahulxcodex/ecommerce-price-watcher/actions/workflows/price-check.yml/badge.svg)](https://github.com/rahulxcodex/ecommerce-price-watcher/actions/workflows/price-check.yml)
[![Node.js 22 LTS](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)
[![Next.js 14](https://img.shields.io/badge/next.js-14.2-black.svg)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/database-Supabase%20PostgreSQL-3ECF8E.svg)](https://supabase.com/)

An institutional-grade, automated multi-platform e-commerce price tracking and market intelligence platform for **Amazon India**, **Flipkart**, **Meesho**, **Myntra**, **Ajio**, and **Westside**. Track any product URL, explore dynamic discovery catalogs with smart facet filtering, view historical price trajectories, and receive instant alerts whenever prices hit an **all-time low**.

Deployed **100% free** on Vercel, Supabase, GitHub Actions, and multi-channel notification gateways.

---

## 🏛️ System Architecture

```
[ Next.js 14 Web App ] (Vercel Free Tier - Obsidian & Champagne Design)
         │
         ├──► [ Discovery & Search Engine ] (Live Storefront Scrapers + Smart Filters)
         │
         ▼
[ Supabase PostgreSQL ] (Free Tier with Row-Level Security & 11 Migrations)
         ▲
         │
[ GitHub Actions Cron ] (Runs every 4 hours on Node.js 22 LTS runners)
         │  Scrapes Amazon, Flipkart, Meesho, Myntra, Ajio, Westside
         ▼
[ 5-Channel Dispatcher ]
   ├── Telegram Bot API (Instant Push)
   ├── WhatsApp (CallMeBot Gateway)
   ├── Discord Webhook (Rich Embeds)
   ├── ntfy.sh (Open-source Push Notifications)
   └── Email (Google Apps Script / Gmail API)
```

---

## ⚡ Core Capabilities

- **Multi-Storefront Support**: Real-time extraction across Amazon India, Flipkart, Meesho, Myntra, Ajio, and Westside.
- **Product Discovery Engine (`/discover`)**: Search 10–25 candidate products across storefronts, dynamically scrape additional SKUs on facet filtering, and bulk-monitor up to 15 items in a single click.
- **Mathematical Decision Science**:
  - **Monotonic Deque $O(N)$ Sliding Window**: Real-time 7-day and 30-day rolling price minimums.
  - **Ordinary Least Squares (OLS) Linear Regression**: Price trajectory and velocity forecasting.
  - **Pareto Frontier Optimization**: Multi-objective non-dominated deal identification (Price vs. Rating vs. Discount).
  - **Shannon Entropy Ranking**: Optimal facet partitioning for smart search navigation.
  - **Optimal Stopping (Secretary Problem)**: 1/e statistical confidence scoring for buy vs. wait decisions.
- **5-Channel Alert Dispatcher**: Immediate delivery across Telegram, WhatsApp, Discord, ntfy.sh, and Email.
- **Defensive Engineering**: SSRF defense with private IP / cloud metadata blocking, constant-time HMAC-SHA256 session auth, PostgreSQL Row-Level Security (RLS), and in-memory rate limiting.
- **Chrome Extension (Manifest V3)**: Pure-JS packaged companion extension for 1-click tracking directly from product pages.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14 App Router (React 18, TypeScript 5)
- **Design System**: Obsidian & Champagne Luxury Editorial (Instrument Serif + Satoshi typography, Tailwind CSS)
- **Database**: Supabase PostgreSQL with strict Row Level Security (RLS)
- **Scraper Engine**: 5-Tier Resilient Architecture (JSON-LD + Native Hydration States + OpenGraph Meta + Cheerio Fallbacks + Headless Chromium with Jitter)
- **Automation**: GitHub Actions Cron (`0 */4 * * *`) with 5-Hour Watchdog Monitor
- **Testing**: 7 comprehensive test suites covering SSRF defense, DSA algorithms, ecommerce URL patterns, smart filtering, and hardening audits.

---

## ⚙️ Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/rahulxcodex/ecommerce-price-watcher.git
cd ecommerce-price-watcher
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local` and add your credentials:
```bash
cp .env.example .env.local
```

Required variables:
```ini
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AUTH_SECRET=generate-a-strong-random-secret-at-least-32-chars-long
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database Setup
Apply all migrations sequentially from `supabase/migrations/` in your Supabase SQL Editor:
- `001_initial_schema.sql` through `011_production_ready_hardening.sql`.

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Run Verification & Test Suite
```bash
npm run typecheck
npm run lint
npm test
```

### 6. Run Scraper Manually
```bash
npm run scrape
```

---

## 🌐 Production Deployment

### 1. Vercel Deployment
1. Connect your GitHub repository to [Vercel](https://vercel.com).
2. Configure Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `AUTH_SECRET`
   - `NEXT_PUBLIC_APP_URL`
3. Deploy to production.

### 2. GitHub Actions Automated Cron
In your GitHub repository **Settings** > **Secrets and variables** > **Actions**, add:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN` (optional, for alerts)

The workflow `.github/workflows/price-check.yml` executes automatically every 4 hours (`0 */4 * * *`).

---

## 📖 Documentation

- [About Us & Architectural Memo](docs/ABOUT.md)
- [Telegram Bot Alert Setup Guide](docs/telegram-setup.md)
- [Google Apps Script Email Alert Setup](docs/appscript-email-setup.md)
- [Chrome Extension Documentation](extension/README.md)
- [Database Migrations Log](supabase/MIGRATION_README.md)

---

## 📄 License

MIT License. Crafted with mathematical precision for e-commerce price transparency.
