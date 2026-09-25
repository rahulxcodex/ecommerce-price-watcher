# About Ecommerce Price Watcher

## Mission & Executive Overview

**Ecommerce Price Watcher** is an institutional-grade, multi-storefront e-commerce intelligence and price tracking engine designed to restore radical pricing transparency across India's leading digital retail marketplaces.

In modern online commerce, major retail storefronts continuously modulate SKU pricing using dynamic algorithmic pricing, flash promotions, simulated discounts, and artificial list prices. Without historical context, consumers and procurement managers routinely pay inflated amounts for products that were available at significantly lower prices days or hours prior.

Our core commitment is **pure mathematical transparency**:
- **Zero Advertising**: We accept no sponsored product placements.
- **Zero Affiliate Bias**: Recommendations are purely determined by data structures and algorithmic scoring.
- **Automated 4-Hour Background Cycles**: Persistent monitoring on automated cron runners.
- **Predictive Decision Science**: Algorithms advise whether an item is at its true price floor or trending downward.

---

## Supported Storefronts

We provide deep, resilient extraction across six of India's most prominent digital storefronts:

| Storefront | Extraction Technology | Resilience Mechanisms |
|---|---|---|
| **Amazon India** (`amazon.in`) | Desktop/Mobile JSON-LD + Cheerio Fallback | Automatic mobile user-agent fallback upon robot-check detection |
| **Flipkart** (`flipkart.com`) | Microdata Schema.org + OpenGraph Meta | DOM class variance tolerance, context-aware discount parser |
| **Meesho** (`meesho.com`) | `__NEXT_DATA__` Hydration State | Deep JSON tree query parsing with zero DOM rendering dependency |
| **Myntra** (`myntra.com`) | `window.__myx` Preloaded Store | High-speed hydration slice extraction with bracket depth balancing |
| **Ajio** (`ajio.com`) | Internal Search API Endpoint | Cloudflare/Akamai 403 bypass via native internal catalog gateway |
| **Westside** (`westside.com`) | Shopify JSON-LD + Native Catalog | Currency-aware price parser with multi-variant handling |

---

## Decision Science & Mathematical Core

Every price alert and discovery recommendation is grounded in algorithmic and statistical models:

### 1. Monotonic Deque Sliding Window Minimums ($O(N)$)
Maintains historical rolling price floors across 7-day and 30-day temporal windows. By utilizing a double-ended queue, the algorithm updates in amortized $O(1)$ time per checkpoint, instantly identifying all-time lows and localized price troughs.

### 2. Ordinary Least Squares (OLS) Linear Regression
Computes the slope $\beta$ of historical price observations:
$$\beta = \frac{\sum (t_i - \bar{t})(p_i - \bar{p})}{\sum (t_i - \bar{t})^2}$$
The trajectory classifies the price momentum into:
- **Sharp Decline** ($\le -5\%$ per interval): High probability of imminent bottom.
- **Moderate Decline**: Steady downward trajectory.
- **Stable Floor**: Price volatility within $\pm 1\%$ of rolling minimum.
- **Upward Spike**: Post-sale price rebound.

### 3. Pareto Frontier Multi-Objective Deal Filtering
In product discovery (`/discover`), deals are evaluated simultaneously across three competing vectors:
1. Minimizing Price ($p$)
2. Maximizing Customer Rating ($r$)
3. Maximizing Percentage Discount ($d$)

A SKU is Pareto-optimal if no other SKU in the catalog dominates it across all three attributes.

### 4. Shannon Entropy Facet Ranking
To provide the most effective filter navigation, catalog facets are ranked by Information Gain:
$$H(S) = - \sum_{i=1}^k p_i \log_2 p_i$$
Facets with maximum entropy partition the search space most uniformly, allowing users to reach target SKUs with the fewest clicks.

### 5. Optimal Stopping Theory (The Secretary Problem)
Leverages the $1/e \approx 36.8\%$ statistical cutoff principle against log-normal volatility distributions to calculate confidence thresholds: whether to purchase immediately or defer.

---

## Zero-Trust Security Architecture

1. **SSRF Loopback Defense**: Strict domain allowlists, loopback IP blocking (`127.0.0.1`, `0.0.0.0`, `::1`), private RFC 1918 subnets, octal/hex evasion neutralization, and AWS EC2 IMDSv1 metadata endpoint isolation.
2. **Constant-Time Cryptographic Sessions**: Stateless authentication tokens signed via HMAC-SHA256 and compared using `crypto.timingSafeEqual`.
3. **Database Row-Level Security (RLS)**: PostgreSQL tenancy isolation protecting user watchlist items, alert configurations, and webhook secrets.
4. **Context-Aware Price Sanitizer**: Prevents zero-price scraper bugs and rejects EMI figures, discount percentages, and pack quantities masquerading as product prices.
5. **Sliding Window Rate Limiter**: Atomic in-memory throttling with HTTP `429 Too Many Requests` and standard `Retry-After` headers.
6. **Watchdog Liveness Monitor**: 5-hour health watchdog auditing background scraper execution timestamps with automated incident dispatch.

---

## Multi-Channel Dispatch Engine

Users configure real-time alerts across five independent communication protocols:
- **Telegram Bot API**: Instant push notifications with Markdown formatting and direct store links.
- **WhatsApp**: Direct mobile messaging via CallMeBot API gateway.
- **Discord**: Channel webhook notifications with structured embed layouts.
- **ntfy.sh**: Open-source, self-hostable push notifications for Android, iOS, and Web.
- **Email / Google Apps Script**: Serverless, zero-cost email delivery without third-party email subscription fees.

---

## Technical Governance & Standards

- **Runtime**: Node.js 22 LTS
- **Framework**: Next.js 14 App Router
- **Design System**: Obsidian & Champagne Luxury Editorial (Instrument Serif + Satoshi typography)
- **Database**: Supabase PostgreSQL with 11 production migrations
- **Continuous Integration**: GitHub Actions CI with automated typechecking, linting, and 7 comprehensive test suites (100% assertions passing).
