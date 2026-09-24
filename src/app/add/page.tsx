'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlusCircle, Loader2, ArrowLeft, CheckCircle, AlertCircle, Info } from 'lucide-react';
import Link from 'next/link';
import { PlatformBadge } from '@/components/platform-badge';
import { Platform } from '@/types';

function AddProductForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [url, setUrl] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
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
    if (trimmed.includes('amazon.in') || trimmed.includes('amzn.to') || trimmed.includes('amazon.com')) {
      setDetectedPlatform('amazon');
    } else if (trimmed.includes('flipkart.com') || trimmed.includes('fkrt.it')) {
      setDetectedPlatform('flipkart');
    } else if (trimmed.includes('meesho.com')) {
      setDetectedPlatform('meesho');
    } else if (trimmed.includes('myntra.com')) {
      setDetectedPlatform('myntra');
    } else if (trimmed.includes('ajio.com')) {
      setDetectedPlatform('ajio');
    } else if (trimmed.includes('westside.com')) {
      setDetectedPlatform('westside');
    } else {
      setDetectedPlatform(null);
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
    setIsLoading(true);

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          targetPrice: targetPrice ? Number(targetPrice) : null,
          selectedSize: selectedSize.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
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

      <div className="bg-slate-900/60 border border-slate-800 p-6 sm:p-8 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Track New Product</h1>
            <p className="text-xs text-slate-400">Add any Amazon, Flipkart, Meesho, Myntra, Ajio, or Westside item link</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Unable to Track Link</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 text-emerald-400 text-xs">
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Product Added!</p>
              <p className="mt-0.5">{success} Redirecting...</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* URL Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
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
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>

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
