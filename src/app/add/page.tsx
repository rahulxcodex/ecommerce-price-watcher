'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlusCircle, Loader2, ArrowLeft, CheckCircle, AlertCircle, Info, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { PlatformBadge } from '@/components/platform-badge';
import { deriveTitleFromUrl, validateAndSanitizeUrl } from '@/lib/security';
import { Platform } from '@/types';

function AddProductForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [url, setUrl] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [derivedTitle, setDerivedTitle] = useState('');
  const [showManualPrice, setShowManualPrice] = useState(false);
  const [selectedSize, setSelectedSize] = useState('');
  const [notes, setNotes] = useState('');
  const [detectedPlatform, setDetectedPlatform] = useState<Platform | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const queryUrl = searchParams.get('url');
    if (queryUrl) {
      setUrl(queryUrl);
      detectPlatform(queryUrl);
    }
  }, [searchParams]);

  const detectPlatform = (val: string) => {
    const trimmed = val.toLowerCase();
    let plat: Platform | null = null;
    if (trimmed.includes('amazon.in') || trimmed.includes('amzn.to') || trimmed.includes('amazon.com')) {
      plat = 'amazon';
    } else if (trimmed.includes('flipkart.com') || trimmed.includes('fkrt.it')) {
      plat = 'flipkart';
    } else if (trimmed.includes('meesho.com')) {
      plat = 'meesho';
    } else if (trimmed.includes('myntra.com')) {
      plat = 'myntra';
    } else if (trimmed.includes('ajio.com')) {
      plat = 'ajio';
    } else if (trimmed.includes('westside.com')) {
      plat = 'westside';
    }

    setDetectedPlatform(plat);

    if (plat) {
      const title = deriveTitleFromUrl(val, plat);
      if (title) setDerivedTitle(title);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUrl(val);
    setError(null);
    detectPlatform(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const urlCheck = validateAndSanitizeUrl(url.trim());
    if (!urlCheck.valid) {
      setError(urlCheck.error || 'Please enter a valid e-commerce product URL.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          targetPrice: targetPrice ? Number(targetPrice) : null,
          clientPrice: currentPrice ? Number(currentPrice) : null,
          clientTitle: derivedTitle || undefined,
          selectedSize: selectedSize.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (
          data.error &&
          (data.error.includes('extract price') ||
            data.error.includes('anti-bot') ||
            data.error.includes('sanity check'))
        ) {
          setShowManualPrice(true);
        }
        throw new Error(data.error || 'Failed to add product.');
      }

      setSuccess(`Successfully tracking "${data.product.title.slice(0, 45)}..."!`);
      setTimeout(() => {
        router.push(`/product/${data.product.id}`);
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Dashboard</span>
      </Link>

      <div className="bg-slate-900/60 border border-slate-800 p-4 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Track New Product</h1>
            <p className="text-xs text-slate-400">Add any Amazon, Flipkart, Meesho, Myntra, Ajio, or Westside item link</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3.5 sm:p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Unable to Track Link</p>
              <p>{error}</p>
              <p className="text-[11px] text-slate-400 pt-1">
                Tip: If the store blocks cloud servers, use our <Link href="/extension" className="text-emerald-400 underline">Browser Extension</Link> for 1-click tracking, or enter the current price below.
              </p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-3.5 sm:p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 text-emerald-400 text-xs">
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Product Added!</p>
              <p className="mt-0.5">{success} Redirecting...</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          {/* URL Input */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
              <label htmlFor="url-input" className="text-xs font-semibold text-slate-200">
                Product URL <span className="text-red-400">*</span>
              </label>
              {detectedPlatform && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400">Detected:</span>
                  <PlatformBadge platform={detectedPlatform} />
                </div>
              )}
            </div>
            <input
              id="url-input"
              type="url"
              value={url}
              onChange={handleUrlChange}
              placeholder="Paste product link (Amazon, Flipkart, Meesho, Myntra, Ajio, Westside)..."
              required
              disabled={isLoading}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>

          {/* Manual Current Price (Bypasses Store Anti-Bot) */}
          {(showManualPrice || currentPrice) && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="current-price-input" className="block text-xs font-semibold text-amber-300">
                  Current Store Price in ₹ (Anti-Bot Bypass)
                </label>
                <Link
                  href="/extension"
                  className="text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/30 font-semibold transition-all inline-flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>1-Click Extension</span>
                </Link>
              </div>
              {derivedTitle && (
                <div className="text-[11px] text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                  <CheckCircle className="w-3 h-3 flex-shrink-0" />
                  <span>Identified item: <strong className="text-slate-100">{derivedTitle}</strong></span>
                </div>
              )}
              <p className="text-[11px] text-slate-400">
                {detectedPlatform ? detectedPlatform.toUpperCase() : 'This store'} protects against automated cloud scrapers. Enter the live price you see on the product page so PriceWatcher can start tracking history and price drop alerts immediately.
              </p>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-sm">
                  ₹
                </span>
                <input
                  id="current-price-input"
                  type="number"
                  min="1"
                  step="1"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                  placeholder="e.g. 1499"
                  disabled={isLoading}
                  className="w-full bg-slate-950 border border-amber-500/40 rounded-xl pl-8 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 transition-colors"
                />
              </div>
            </div>
          )}

          {!showManualPrice && !currentPrice && (
            <div className="flex justify-end -mt-3">
              <button
                type="button"
                onClick={() => setShowManualPrice(true)}
                className="text-[11px] text-slate-500 hover:text-emerald-400 transition-colors"
              >
                + Enter current price manually (bypasses store anti-bot)
              </button>
            </div>
          )}

          {/* Optional Target Price */}
          <div>
            <label htmlFor="target-price-input" className="block text-xs font-semibold text-slate-200 mb-1">
              Custom Target Price in ₹ (Optional)
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              By default, you get alerted whenever the price hits an all-time low. If you have a specific budget in mind, specify it here.
            </p>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-sm">
                ₹
              </span>
              <input
                id="target-price-input"
                type="number"
                min="1"
                step="1"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="e.g. 1499"
                disabled={isLoading}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Optional Variant / Size & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="size-input" className="block text-xs font-semibold text-slate-200 mb-1">
                Size / Variant (Optional)
              </label>
              <input
                id="size-input"
                type="text"
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
                placeholder="e.g. M, L, UK 9, 256GB"
                disabled={isLoading}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <div>
              <label htmlFor="notes-input" className="block text-xs font-semibold text-slate-200 mb-1">
                Personal Notes (Optional)
              </label>
              <input
                id="notes-input"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Birthday gift, wait for Diwali"
                disabled={isLoading}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
          </div>

          {/* SSRF & Security notice */}
          <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 text-[11px] text-slate-400 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p>
              Links are automatically sanitized to remove tracking affiliate cookies and validated against our strict hostname whitelist to protect against SSRF vulnerabilities.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold py-3.5 px-4 rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Fetching live product & price details...</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                <span>Start Tracking Product</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AddProductPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex flex-col items-center justify-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-2" />
          <p className="text-xs">Loading form...</p>
        </div>
      }
    >
      <AddProductForm />
    </Suspense>
  );
}
