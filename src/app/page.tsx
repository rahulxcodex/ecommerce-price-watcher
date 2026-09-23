'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  TrendingDown,
  BellRing,
  ShieldCheck,
  Zap,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Lock,
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
    <div className="space-y-20 py-4">
      {/* Hero Section */}
      <section className="relative text-center max-w-4xl mx-auto space-y-6 pt-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>100% Free • Amazon • Flipkart • Meesho</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-100">
          Paste any link. <br />
          Get alerted at{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
            All-Time Lowest Price.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Stop constantly refreshing product pages. Paste a link from Amazon, Flipkart, or Meesho.
          Our automated GitHub Actions tracker checks prices 4× daily and pings your Telegram immediately when prices drop.
        </p>

        {/* Quick URL Input Bar */}
        <form
          onSubmit={handleQuickSubmit}
          className="max-w-2xl mx-auto mt-8 flex flex-col sm:flex-row items-center gap-2 bg-slate-900/90 p-2 rounded-2xl border border-slate-800 shadow-2xl shadow-emerald-500/5 focus-within:border-emerald-500/50 transition-colors"
        >
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste product link (Amazon, Flipkart, Meesho)..."
            required
            className="w-full bg-transparent px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-md shadow-emerald-500/20 whitespace-nowrap"
          >
            <span>Track Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Supported Platforms Strip */}
        <div className="flex items-center justify-center gap-3 pt-3">
          <span className="text-xs text-slate-500">Supported:</span>
          <PlatformBadge platform="amazon" />
          <PlatformBadge platform="flipkart" />
          <PlatformBadge platform="meesho" />
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">How It Works</h2>
          <p className="text-slate-400 text-sm mt-1">Zero monthly cost, powered by free open-source infrastructure</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-lg mb-4">
              1
            </div>
            <h3 className="font-semibold text-slate-200 text-base mb-2">Paste Product Link</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Drop any item link from Amazon India, Flipkart, or Meesho. We automatically fetch the current price, title, and initial snapshot.
            </p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 font-bold text-lg mb-4">
              2
            </div>
            <h3 className="font-semibold text-slate-200 text-base mb-2">Automated Background Checks</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              GitHub Actions runs on a recurring schedule (every 6 hours) on free serverless runners to check the live prices of your products.
            </p>
          </div>

          <div className="bg-slate-900/40 border border-slate-800/80 p-6 rounded-2xl relative overflow-hidden group hover:border-slate-700 transition-colors">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-lg mb-4">
              3
            </div>
            <h3 className="font-semibold text-slate-200 text-base mb-2">Instant Telegram Alert</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              The moment an item hits its all-time lowest price (or your custom target price), a Telegram notification arrives directly on your phone.
            </p>
          </div>
        </div>
      </section>

      {/* Security & Reliability Features */}
      <section className="max-w-5xl mx-auto bg-gradient-to-b from-slate-900/60 to-slate-950 border border-slate-800 p-8 rounded-3xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Built-in Security Architecture</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-100">Enterprise Security on Free Infrastructure</h2>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-4 py-2.5 rounded-xl text-xs transition-colors border border-slate-700"
          >
            <span>Open Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-200">SSRF Defense</p>
              <p className="text-slate-400 mt-0.5">Strict hostname whitelist & private IP blocking prevent internal network probes.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-200">Price Anomaly Detection</p>
              <p className="text-slate-400 mt-0.5">Protects against 0-rupee glitches and selector breakage hallucinations.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-200">Supabase Row-Level Security</p>
              <p className="text-slate-400 mt-0.5">Database policies restrict read/write access strictly to verified owners.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-200">Anti-Scrape Evasion</p>
              <p className="text-slate-400 mt-0.5">Polite pacing, randomized User-Agents, and dual HTTP + Playwright fallback.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-200">Webhook Token Authentication</p>
              <p className="text-slate-400 mt-0.5">Constant-time verification prevents spoofed Telegram notification callbacks.</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/60">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-200">Zero Server Cost</p>
              <p className="text-slate-400 mt-0.5">Runs comfortably within Vercel, Supabase, and GitHub Actions free tiers.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
