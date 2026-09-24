'use client';

import Link from 'next/link';
import { Download, Sparkles, Chrome, CheckCircle2, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export default function ExtensionPage() {
  return (
    <div className="max-w-4xl mx-auto py-4 sm:py-8 space-y-6 sm:space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <div className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold max-w-full">
          <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Chrome, Brave &amp; Edge Extension Companion</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-100 tracking-tight leading-tight">
          Track Prices in 1-Click with the <span className="text-emerald-400">PriceWatcher Extension</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto px-2">
          Never copy-paste URLs again. Browse Amazon, Flipkart, Myntra, Ajio, Meesho, or Westside, tap the extension icon, and instantly start tracking price drops!
        </p>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3">
          <a
            href="/api/extension/download"
            download="PriceWatcher-Companion-Extension.zip"
            className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-6 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Download Extension (.zip)</span>
          </a>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold px-5 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm transition-all border border-slate-700 flex items-center justify-center gap-2"
          >
            <span>Go to Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* 3-Step Installation Guide */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl sm:rounded-3xl p-4 sm:p-8 space-y-5 sm:space-y-6">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <Chrome className="w-5 h-5 text-emerald-400" />
          <span>Quick 1-Minute Setup Guide (Chrome, Edge &amp; Brave)</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-950 border border-slate-800/80 p-5 rounded-2xl space-y-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold flex items-center justify-center text-xs">
              1
            </div>
            <h3 className="font-semibold text-sm text-slate-200">Download &amp; Extract</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Click the button above to download <code>PriceWatcher-Companion-Extension.zip</code>, then right-click and extract it to a folder on your computer.
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 p-5 rounded-2xl space-y-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold flex items-center justify-center text-xs">
              2
            </div>
            <h3 className="font-semibold text-sm text-slate-200">Open Extensions Page</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Open your browser and navigate to <code>chrome://extensions</code> (or <code>edge://extensions</code> or <code>brave://extensions</code>).
            </p>
          </div>

          <div className="bg-slate-950 border border-slate-800/80 p-5 rounded-2xl space-y-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold flex items-center justify-center text-xs">
              3
            </div>
            <h3 className="font-semibold text-sm text-slate-200">Load Unpacked</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Turn ON the <strong>&quot;Developer mode&quot;</strong> toggle in the top-right corner. Click <strong>&quot;Load unpacked&quot;</strong> and select the unzipped <code>extension</code> folder!
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-xs text-emerald-300 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <span>
            <strong>You are all set!</strong> Pin the PriceWatcher icon in your browser toolbar. When you are on any Amazon, Flipkart, Myntra, Ajio, Meesho, or Westside product page, click the icon to track it in 1 second.
          </span>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-emerald-400">
            <Zap className="w-4 h-4" />
            <h4 className="text-sm font-semibold text-slate-200">Auto Store Detection</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            The extension automatically identifies whether you are on Amazon, Flipkart, Myntra, Ajio, Meesho, or Westside, validates clean canonical product links, and strips affiliate tracking bloat.
          </p>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 text-sky-400">
            <ShieldCheck className="w-4 h-4" />
            <h4 className="text-sm font-semibold text-slate-200">Direct Cloud Sync</h4>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Syncs directly with your PriceWatcher dashboard and triggers Telegram, WhatsApp, Discord, Email, and Web Push notifications automatically when prices fall.
          </p>
        </div>
      </div>
    </div>
  );
}
