'use client';

import Link from 'next/link';
import { Download, Sparkles, Chrome, CheckCircle2, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export default function ExtensionPage() {
  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8 space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center gap-2 px-3 py-1 rounded-sm bg-surface border border-surface-border text-champagne text-[11px] font-mono tracking-wide">
          <Sparkles className="w-3.5 h-3.5 text-gold flex-shrink-0" />
          <span>Chrome, Brave &amp; Edge Companion</span>
        </div>
        <h1 className="font-display text-3xl sm:text-5xl font-normal text-champagne tracking-tight leading-tight">
          Track Prices in 1-Click with the <span className="text-gold italic">Browser Extension</span>
        </h1>
        <p className="text-xs sm:text-sm text-champagne-muted max-w-2xl mx-auto px-2">
          Browse Amazon, Flipkart, Myntra, Ajio, Meesho, or Westside, tap the extension icon, and instantly add any product to your monitored watchlist.
        </p>
        <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3">
          <a
            href="/api/extension/download"
            download="PriceWatcher-Companion-Extension.zip"
            className="w-full sm:w-auto bg-gold hover:bg-gold-hover text-obsidian font-semibold px-6 py-2.5 rounded-sm text-xs sm:text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Download Extension (.zip)</span>
          </a>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto bg-surface hover:bg-surface-subtle text-champagne border border-surface-border px-5 py-2.5 rounded-sm text-xs sm:text-sm transition-colors flex items-center justify-center gap-2"
          >
            <span>Go to Watchlist</span>
            <ArrowRight className="w-3.5 h-3.5 text-champagne-faint" />
          </Link>
        </div>
      </div>

      {/* 3-Step Installation Guide */}
      <div className="bg-surface border border-surface-border rounded-sm p-6 sm:p-8 space-y-6">
        <h2 className="font-display text-xl text-champagne flex items-center gap-2">
          <Chrome className="w-5 h-5 text-gold" />
          <span>1-Minute Installation Guide</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-obsidian border border-surface-border p-4 rounded-sm space-y-2">
            <div className="w-6 h-6 rounded-sm bg-surface border border-gold/30 text-gold font-mono text-xs flex items-center justify-center">
              01
            </div>
            <h3 className="font-medium text-xs text-champagne">Download &amp; Extract</h3>
            <p className="text-[11px] text-champagne-faint leading-relaxed font-mono">
              Click the button above to download <code>PriceWatcher-Companion-Extension.zip</code>, then extract it to a folder on your computer.
            </p>
          </div>

          <div className="bg-obsidian border border-surface-border p-4 rounded-sm space-y-2">
            <div className="w-6 h-6 rounded-sm bg-surface border border-gold/30 text-gold font-mono text-xs flex items-center justify-center">
              02
            </div>
            <h3 className="font-medium text-xs text-champagne">Open Extensions Page</h3>
            <p className="text-[11px] text-champagne-faint leading-relaxed font-mono">
              Navigate to <code>chrome://extensions</code> (or <code>edge://extensions</code> or <code>brave://extensions</code>) in your browser.
            </p>
          </div>

          <div className="bg-obsidian border border-surface-border p-4 rounded-sm space-y-2">
            <div className="w-6 h-6 rounded-sm bg-surface border border-gold/30 text-gold font-mono text-xs flex items-center justify-center">
              03
            </div>
            <h3 className="font-medium text-xs text-champagne">Load Unpacked</h3>
            <p className="text-[11px] text-champagne-faint leading-relaxed font-mono">
              Turn ON <strong>&quot;Developer mode&quot;</strong> in the top-right corner. Click <strong>&quot;Load unpacked&quot;</strong> and select the unzipped <code>extension</code> folder!
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-sm bg-obsidian border border-surface-border text-xs text-champagne-muted flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-sage flex-shrink-0 mt-0.5" />
          <span>
            <strong className="text-champagne">Setup Complete:</strong> Pin the PriceWatcher icon in your browser toolbar. When browsing Amazon, Flipkart, Myntra, Ajio, Meesho, or Westside, tap the icon to monitor in 1 second.
          </span>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-surface border border-surface-border p-5 rounded-sm space-y-2">
          <div className="flex items-center gap-2 text-gold">
            <Zap className="w-4 h-4" />
            <h4 className="font-medium text-xs text-champagne">Auto Store Detection</h4>
          </div>
          <p className="text-[11px] text-champagne-faint leading-relaxed">
            Automatically detects the current storefront, validates canonical product URLs, and strips tracking affiliate cookies.
          </p>
        </div>

        <div className="bg-surface border border-surface-border p-5 rounded-sm space-y-2">
          <div className="flex items-center gap-2 text-gold">
            <ShieldCheck className="w-4 h-4" />
            <h4 className="font-medium text-xs text-champagne">Automated Alert Dispatch</h4>
          </div>
          <p className="text-[11px] text-champagne-faint leading-relaxed">
            Synchronizes with your PriceWatcher watchlist to trigger Telegram, WhatsApp, Discord, Email, and Web Push notifications.
          </p>
        </div>
      </div>
    </div>
  );
}
