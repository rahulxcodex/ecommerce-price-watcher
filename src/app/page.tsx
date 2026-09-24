'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Compass,
  ShieldCheck,
  TrendingDown,
  Clock,
  Layers,
} from 'lucide-react';
import { PlatformBadge } from '@/components/platform-badge';

export default function HomePage() {
  const [url, setUrl] = useState('');
  const router = useRouter();

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      router.push(`/add?url=${encodeURIComponent(url.trim())}`);
    }
  };

  return (
    <div className="space-y-16 sm:space-y-24 py-4 sm:py-8">
      {/* Hero Section */}
      <section className="relative text-center max-w-4xl mx-auto space-y-5 sm:space-y-7 pt-4 sm:pt-10">
        <div className="inline-flex items-center justify-center gap-2 px-3 py-1 rounded-sm bg-surface border border-surface-border text-champagne text-[11px] font-mono tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-gold" />
          <span>Multi-Store Price Intelligence • 6 Storefronts</span>
        </div>

        <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-normal tracking-tight text-champagne leading-[1.02]">
          Track any product. <br />
          Capture the{' '}
          <span className="text-gold italic font-normal">
            All-Time Lowest Price.
          </span>
        </h1>

        <p className="text-sm sm:text-base md:text-lg text-champagne-muted max-w-2xl mx-auto leading-relaxed px-2 font-normal">
          Automated multi-store price monitoring with ordinary least squares trajectory forecasting and Pareto optimization. 
          Checks prices every 4 hours and sends immediate alerts to your Telegram, WhatsApp, or Webhooks.
        </p>

        {/* Quick URL Input Bar & Discover Link */}
        <div className="max-w-2xl mx-auto mt-6 space-y-3">
          <form
            onSubmit={handleQuickSubmit}
            className="flex flex-col sm:flex-row items-center gap-2 bg-surface p-1.5 rounded-sm border border-surface-border focus-within:border-gold/50 transition-colors"
          >
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste product link from Amazon, Flipkart, Meesho, Myntra, Ajio, Westside..."
              required
              className="w-full bg-transparent px-3 sm:px-4 py-2.5 text-xs sm:text-sm text-champagne placeholder:text-champagne-faint focus:outline-none"
            />
            <button
              type="submit"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gold hover:bg-gold-hover text-obsidian font-semibold px-5 py-2.5 rounded-sm text-xs sm:text-sm transition-colors whitespace-nowrap"
            >
              <span>Track URL</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Quick Discover CTA */}
          <div className="flex items-center justify-center gap-2 text-xs text-champagne-faint pt-1">
            <span>Don&apos;t have a direct link?</span>
            <Link
              href="/discover"
              className="text-gold hover:underline inline-flex items-center gap-1 font-medium"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Search products with Smart Filtering →</span>
            </Link>
          </div>
        </div>

        {/* Supported Platforms Strip */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
          <span className="text-[11px] font-mono text-champagne-faint uppercase tracking-wider">Stores:</span>
          <PlatformBadge platform="amazon" />
          <PlatformBadge platform="flipkart" />
          <PlatformBadge platform="meesho" />
          <PlatformBadge platform="myntra" />
          <PlatformBadge platform="ajio" />
          <PlatformBadge platform="westside" />
        </div>
      </section>

      {/* 3 Pillars Architecture */}
      <section className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl sm:text-4xl text-champagne">Decision Science &amp; Automation</h2>
          <p className="text-champagne-faint text-xs sm:text-sm mt-1.5 font-mono">
            Mathematical price modeling • 4-hour background cycle
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-surface border border-surface-border p-6 rounded-sm relative group hover:border-gold/30 transition-colors">
            <div className="w-10 h-10 rounded-sm bg-surface-subtle border border-surface-border flex items-center justify-center text-gold font-mono text-sm mb-4">
              01
            </div>
            <h3 className="font-display text-xl text-champagne mb-2">Discovery &amp; Search</h3>
            <p className="text-champagne-muted text-xs leading-relaxed">
              Explore 10–15 candidate products across any storefront. Multi-objective Pareto frontier filtering isolates non-dominated price-to-rating options.
            </p>
          </div>

          <div className="bg-surface border border-surface-border p-6 rounded-sm relative group hover:border-gold/30 transition-colors">
            <div className="w-10 h-10 rounded-sm bg-surface-subtle border border-surface-border flex items-center justify-center text-gold font-mono text-sm mb-4">
              02
            </div>
            <h3 className="font-display text-xl text-champagne mb-2">Automated 4-Hour Cron</h3>
            <p className="text-champagne-muted text-xs leading-relaxed">
              GitHub Actions schedules continuous extractions every 4 hours with exponential jitter backoff and SSRF loopback defense.
            </p>
          </div>

          <div className="bg-surface border border-surface-border p-6 rounded-sm relative group hover:border-gold/30 transition-colors">
            <div className="w-10 h-10 rounded-sm bg-surface-subtle border border-surface-border flex items-center justify-center text-gold font-mono text-sm mb-4">
              03
            </div>
            <h3 className="font-display text-xl text-champagne mb-2">Predictive Decision Alerts</h3>
            <p className="text-champagne-muted text-xs leading-relaxed">
              Ordinary Least Squares slope analysis and optimal stopping theory (Secretary problem) decide optimal purchase timing with multi-channel alerts.
            </p>
          </div>
        </div>
      </section>

      {/* Security & System Reliability */}
      <section className="max-w-5xl mx-auto bg-surface border border-surface-border p-6 sm:p-8 rounded-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 pb-6 border-b border-surface-border">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-gold mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Security &amp; Rate-Limiting</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl text-champagne">Defensive Engineering Standards</h2>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 bg-surface-subtle hover:bg-surface-hover border border-surface-border text-champagne px-4 py-2 rounded-sm text-xs transition-colors"
          >
            <span>Open Watchlist</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-sm bg-obsidian border border-surface-border">
            <p className="font-medium text-champagne">SSRF Loopback Defense</p>
            <p className="text-champagne-faint text-[11px] mt-1">Strict domain whitelists and private octal/hex IP blocking protect against internal network probes.</p>
          </div>

          <div className="p-3.5 rounded-sm bg-obsidian border border-surface-border">
            <p className="font-medium text-champagne">Sliding Rate Limiter</p>
            <p className="text-champagne-faint text-[11px] mt-1">Search requests are strictly rate-limited to 5 requests per minute with automated Retry-After headers.</p>
          </div>

          <div className="p-3.5 rounded-sm bg-obsidian border border-surface-border">
            <p className="font-medium text-champagne">Row-Level Security (RLS)</p>
            <p className="text-champagne-faint text-[11px] mt-1">PostgreSQL RLS locks down personal credentials and isolates user watchlist entries.</p>
          </div>

          <div className="p-3.5 rounded-sm bg-obsidian border border-surface-border">
            <p className="font-medium text-champagne">Pareto Frontier Optimizer</p>
            <p className="text-champagne-faint text-[11px] mt-1">Multi-objective algorithms calculate non-dominated deals balancing price, discount, and ratings.</p>
          </div>

          <div className="p-3.5 rounded-sm bg-obsidian border border-surface-border">
            <p className="font-medium text-champagne">Optimal Stopping Theory</p>
            <p className="text-champagne-faint text-[11px] mt-1">1/e statistical cutoff rules compute buy vs. wait probabilities from log-normal price volatility.</p>
          </div>

          <div className="p-3.5 rounded-sm bg-obsidian border border-surface-border">
            <p className="font-medium text-champagne">5-Channel Alert Dispatcher</p>
            <p className="text-champagne-faint text-[11px] mt-1">Real-time dispatches across Telegram, WhatsApp, Discord, ntfy.sh, and Email via Google Apps Script.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
