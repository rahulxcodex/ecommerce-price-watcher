import Link from 'next/link';
import {
  ShieldCheck,
  TrendingDown,
  Compass,
  Cpu,
  Zap,
  Globe2,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
  BarChart3,
  Layers,
  Scale,
} from 'lucide-react';
import { PlatformBadge } from '@/components/platform-badge';

export const metadata = {
  title: 'About Us — Multi-Store Price Intelligence & Algorithmic Monitoring',
  description: 'Learn about our mission, mathematical decision science models, resilient scraping architecture, and zero-compromise security engineering.',
};

export default function AboutPage() {
  return (
    <div className="space-y-16 sm:space-y-24 py-4 sm:py-8 max-w-5xl mx-auto">
      {/* Hero Section */}
      <section className="text-center space-y-5 pt-4 sm:pt-8">
        <div className="inline-flex items-center justify-center gap-2 px-3 py-1 rounded-sm bg-surface border border-surface-border text-champagne text-[11px] font-mono tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-gold" />
          <span>About Price Watcher Intelligence</span>
        </div>

        <h1 className="font-display text-4xl sm:text-6xl font-normal tracking-tight text-champagne leading-[1.05]">
          Engineering Price Transparency <br />
          <span className="text-gold italic font-normal">
            for Modern E-Commerce.
          </span>
        </h1>

        <p className="text-sm sm:text-base md:text-lg text-champagne-muted max-w-2xl mx-auto leading-relaxed font-normal">
          We combine distributed web scraping, mathematical decision science, and zero-trust security 
          to protect shoppers and procurement teams from artificial discounts and algorithmic price surges.
        </p>
      </section>

      {/* Mission & Problem Statement */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-surface border border-surface-border p-6 sm:p-10 rounded-sm">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-gold">
            <Scale className="w-3.5 h-3.5" />
            <span>The Challenge</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl text-champagne">
            The Illusion of &quot;Limited-Time Deals&quot;
          </h2>
          <p className="text-xs sm:text-sm text-champagne-muted leading-relaxed">
            Major retail storefronts continuously modulate SKU pricing using dynamic demand algorithms, flash promotions, and artificial list prices. Without historical context, consumers frequently purchase items marked as &quot;discounted&quot; that were significantly cheaper days earlier.
          </p>
          <p className="text-xs sm:text-sm text-champagne-muted leading-relaxed">
            Our mission is absolute mathematical transparency: persistent tracking of true price floors, automated 4-hour checks, and predictive analytics that advise whether to buy immediately or wait for an impending price drop.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="p-4 rounded-sm bg-obsidian border border-surface-border">
            <span className="font-display text-2xl text-gold block mb-1">6</span>
            <span className="text-xs font-medium text-champagne block">Storefronts Tracked</span>
            <span className="text-[10px] text-champagne-faint font-mono mt-1 block">Amazon, Flipkart, Meesho, Myntra, Ajio, Westside</span>
          </div>

          <div className="p-4 rounded-sm bg-obsidian border border-surface-border">
            <span className="font-display text-2xl text-gold block mb-1">4h</span>
            <span className="text-xs font-medium text-champagne block">Monitoring Cadence</span>
            <span className="text-[10px] text-champagne-faint font-mono mt-1 block">Continuous background cron on GitHub Actions</span>
          </div>

          <div className="p-4 rounded-sm bg-obsidian border border-surface-border">
            <span className="font-display text-2xl text-gold block mb-1">5</span>
            <span className="text-xs font-medium text-champagne block">Alert Channels</span>
            <span className="text-[10px] text-champagne-faint font-mono mt-1 block">Telegram, WhatsApp, Discord, ntfy.sh, Email</span>
          </div>

          <div className="p-4 rounded-sm bg-obsidian border border-surface-border">
            <span className="font-display text-2xl text-gold block mb-1">0</span>
            <span className="text-xs font-medium text-champagne block">Commercial Bias</span>
            <span className="text-[10px] text-champagne-faint font-mono mt-1 block">Zero ads, zero affiliate manipulation</span>
          </div>
        </div>
      </section>

      {/* Mathematical & Algorithmic Core */}
      <section className="space-y-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-gold">
            <Cpu className="w-3.5 h-3.5" />
            <span>Decision Science &amp; DSA</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl text-champagne">
            Mathematical Price Modeling
          </h2>
          <p className="text-xs sm:text-sm text-champagne-faint font-mono">
            Rigorous data structures and statistical algorithms driving every recommendation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface border border-surface-border p-6 rounded-sm space-y-3">
            <div className="w-9 h-9 rounded-sm bg-surface-subtle border border-surface-border flex items-center justify-center text-gold font-mono text-xs">
              01
            </div>
            <h3 className="font-display text-lg text-champagne">Monotonic Deque Minimums</h3>
            <p className="text-xs text-champagne-muted leading-relaxed">
              Maintains optimal O(N) sliding window price minimums over 7-day and 30-day temporal horizons to instantly signal all-time lows and localized price troughs.
            </p>
          </div>

          <div className="bg-surface border border-surface-border p-6 rounded-sm space-y-3">
            <div className="w-9 h-9 rounded-sm bg-surface-subtle border border-surface-border flex items-center justify-center text-gold font-mono text-xs">
              02
            </div>
            <h3 className="font-display text-lg text-champagne">OLS Trajectory Prediction</h3>
            <p className="text-xs text-champagne-muted leading-relaxed">
              Applies Ordinary Least Squares (OLS) linear regression to historical price checkpoints, calculating directional velocity and predicting short-term trend trajectories.
            </p>
          </div>

          <div className="bg-surface border border-surface-border p-6 rounded-sm space-y-3">
            <div className="w-9 h-9 rounded-sm bg-surface-subtle border border-surface-border flex items-center justify-center text-gold font-mono text-xs">
              03
            </div>
            <h3 className="font-display text-lg text-champagne">Pareto Multi-Objective</h3>
            <p className="text-xs text-champagne-muted leading-relaxed">
              In discovery mode, computes non-dominated frontier sets across competing objectives: lowest price, highest customer rating, and maximum percentage discount.
            </p>
          </div>

          <div className="bg-surface border border-surface-border p-6 rounded-sm space-y-3">
            <div className="w-9 h-9 rounded-sm bg-surface-subtle border border-surface-border flex items-center justify-center text-gold font-mono text-xs">
              04
            </div>
            <h3 className="font-display text-lg text-champagne">Shannon Entropy Ranking</h3>
            <p className="text-xs text-champagne-muted leading-relaxed">
              Ranks catalog facets by Information Gain to automatically recommend the most informative filter attributes, minimizing candidate space with maximum entropy reduction.
            </p>
          </div>

          <div className="bg-surface border border-surface-border p-6 rounded-sm space-y-3">
            <div className="w-9 h-9 rounded-sm bg-surface-subtle border border-surface-border flex items-center justify-center text-gold font-mono text-xs">
              05
            </div>
            <h3 className="font-display text-lg text-champagne">Optimal Stopping (Secretary)</h3>
            <p className="text-xs text-champagne-muted leading-relaxed">
              Employs statistical 1/e optimal stopping probability cutoffs against log-normal volatility distributions to calculate high-confidence purchase windows.
            </p>
          </div>

          <div className="bg-surface border border-surface-border p-6 rounded-sm space-y-3">
            <div className="w-9 h-9 rounded-sm bg-surface-subtle border border-surface-border flex items-center justify-center text-gold font-mono text-xs">
              06
            </div>
            <h3 className="font-display text-lg text-champagne">Resilient 5-Tier Extraction</h3>
            <p className="text-xs text-champagne-muted leading-relaxed">
              Hierarchical scraping fallbacks: JSON-LD Microdata, Native Hydration States, OpenGraph Meta, Cheerio Multi-Selector Fallbacks, and Playwright Headless Chromium with jitter.
            </p>
          </div>
        </div>
      </section>

      {/* Security & Integrity Architecture */}
      <section className="bg-surface border border-surface-border p-6 sm:p-8 rounded-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-border">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-gold mb-1">
              <Lock className="w-3.5 h-3.5" />
              <span>Zero-Trust Architecture</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl text-champagne">
              Security &amp; Data Integrity
            </h2>
          </div>
          <span className="text-[11px] font-mono text-champagne-faint bg-obsidian px-3 py-1.5 rounded-sm border border-surface-border">
            100% Automated CI Quality Gates
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-sm bg-obsidian border border-surface-border space-y-1.5">
            <h4 className="font-medium text-champagne">SSRF Attack Probing Defense</h4>
            <p className="text-champagne-faint leading-relaxed">
              Whitelisted domain filtering, private RFC 1918 subnet blocking, octal/hex IPv4 evasion traps, and AWS IMDSv1 loopback neutralization.
            </p>
          </div>

          <div className="p-4 rounded-sm bg-obsidian border border-surface-border space-y-1.5">
            <h4 className="font-medium text-champagne">Timing-Safe Constant Time Auth</h4>
            <p className="text-champagne-faint leading-relaxed">
              Stateless HMAC-SHA256 session token verification using <code className="text-gold font-mono">crypto.timingSafeEqual</code> to prevent side-channel timing exploits.
            </p>
          </div>

          <div className="p-4 rounded-sm bg-obsidian border border-surface-border space-y-1.5">
            <h4 className="font-medium text-champagne">Row-Level Security (RLS)</h4>
            <p className="text-champagne-faint leading-relaxed">
              PostgreSQL database policies strictly enforce tenancy isolation across watchlist items, personal settings, and alert webhook tokens.
            </p>
          </div>

          <div className="p-4 rounded-sm bg-obsidian border border-surface-border space-y-1.5">
            <h4 className="font-medium text-champagne">Context-Aware Price Sanitizer</h4>
            <p className="text-champagne-faint leading-relaxed">
              Parses textual currencies safely, rejecting discount percentage figures, EMI plans, pack quantities, and anomalous 99% DOM collapses.
            </p>
          </div>

          <div className="p-4 rounded-sm bg-obsidian border border-surface-border space-y-1.5">
            <h4 className="font-medium text-champagne">Sliding Window Rate Limiter</h4>
            <p className="text-champagne-faint leading-relaxed">
              In-memory sliding window throttling throttles excessive discovery and signin requests with standards-compliant Retry-After HTTP headers.
            </p>
          </div>

          <div className="p-4 rounded-sm bg-obsidian border border-surface-border space-y-1.5">
            <h4 className="font-medium text-champagne">Watchdog Liveness Monitor</h4>
            <p className="text-champagne-faint leading-relaxed">
              A 5-hour health watchdog audits scraper timestamps and dispatches automated outage diagnostics if scheduled cycles stall.
            </p>
          </div>
        </div>
      </section>

      {/* Supported Storefronts */}
      <section className="text-center space-y-4">
        <h3 className="font-display text-xl text-champagne">Deep Storefront Integrations</h3>
        <p className="text-xs text-champagne-faint font-mono">
          Custom parsers and reverse-engineered API gateways optimized for each platform:
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <PlatformBadge platform="amazon" />
          <PlatformBadge platform="flipkart" />
          <PlatformBadge platform="meesho" />
          <PlatformBadge platform="myntra" />
          <PlatformBadge platform="ajio" />
          <PlatformBadge platform="westside" />
        </div>
      </section>

      {/* CTA Strip */}
      <section className="p-8 rounded-sm bg-surface border border-gold/30 text-center space-y-4">
        <h3 className="font-display text-2xl sm:text-3xl text-champagne">
          Experience Price Intelligence Today
        </h3>
        <p className="text-xs sm:text-sm text-champagne-muted max-w-xl mx-auto">
          Start monitoring any product across Amazon, Flipkart, Myntra, Ajio, Meesho, or Westside. 
          Receive automatic alerts the instant prices drop.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/discover"
            className="flex items-center gap-2 bg-gold hover:bg-gold-hover text-obsidian font-semibold px-5 py-2.5 rounded-sm text-xs sm:text-sm transition-colors"
          >
            <Compass className="w-4 h-4" />
            <span>Discover Products</span>
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 bg-surface hover:bg-surface-subtle border border-surface-border text-champagne px-5 py-2.5 rounded-sm text-xs sm:text-sm transition-colors"
          >
            <span>Open Watchlist</span>
            <ArrowRight className="w-4 h-4 text-champagne-faint" />
          </Link>
        </div>
      </section>
    </div>
  );
}
