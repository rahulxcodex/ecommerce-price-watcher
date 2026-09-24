'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlusCircle, Loader2, ArrowLeft, CheckCircle, AlertCircle, Info, Sparkles, Crown, User as UserIcon, Compass } from 'lucide-react';
import Link from 'next/link';
import { PlatformBadge } from '@/components/platform-badge';
import { deriveTitleFromUrl, validateAndSanitizeUrl } from '@/lib/security';
import { Platform } from '@/types';
import { useAuth } from '@/contexts/auth-context';

function AddProductForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

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
    if (isLoading) return;
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
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-champagne-faint hover:text-champagne transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Watchlist</span>
        </Link>

        <Link
          href="/discover"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-gold hover:underline"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Or Discover 10-15 Products</span>
        </Link>
      </div>

      <div className="bg-surface border border-surface-border p-6 sm:p-8 rounded-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-sm bg-surface-subtle border border-gold/30 flex items-center justify-center text-gold flex-shrink-0">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl text-champagne font-normal">Track Product URL</h1>
            <p className="text-xs text-champagne-faint font-mono">Supported across Amazon, Flipkart, Meesho, Myntra, Ajio, Westside</p>
          </div>
        </div>

        {user ? (
          <div className="mb-6 p-3 rounded-sm bg-obsidian border border-surface-border flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              {user.isCombined ? (
                <Crown className="w-4 h-4 text-gold flex-shrink-0" />
              ) : (
                <UserIcon className="w-4 h-4 text-champagne-muted flex-shrink-0" />
              )}
              <span className="text-champagne-muted">
                Tracking as <strong className="text-champagne">{user.name}</strong>
                {user.isCombined && (
                  <span className="ml-1.5 text-[9px] bg-gold/15 text-gold px-1.5 py-0.5 rounded-sm uppercase">
                    Joint Space
                  </span>
                )}
              </span>
            </div>
            <span className="text-[10px] text-champagne-faint hidden sm:inline">Auto-synced</span>
          </div>
        ) : (
          <div className="mb-6 p-3 rounded-sm bg-obsidian border border-surface-border flex items-center justify-between text-xs">
            <span className="text-champagne-faint">
              Tracking as guest. Want private or Combined Access?
            </span>
            <Link href="/login" className="text-gold hover:underline font-mono text-xs ml-2">
              Sign In with PIN
            </Link>
          </div>
        )}

        {error && (
          <div className="mb-6 p-3.5 rounded-sm bg-terracotta/10 border border-terracotta/30 flex items-start gap-3 text-terracotta text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">Unable to Track Link</p>
              <p>{error}</p>
              <p className="text-[11px] text-champagne-faint pt-1">
                Tip: If the storefront blocks cloud fetch, use our <Link href="/extension" className="text-gold underline">Browser Extension</Link> for 1-click tracking, or input the current price below.
              </p>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-3.5 rounded-sm bg-sage/10 border border-sage/30 flex items-start gap-3 text-sage text-xs">
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Product Tracked</p>
              <p className="mt-0.5">{success} Redirecting...</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* URL Input */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
              <label htmlFor="url-input" className="text-xs font-mono uppercase tracking-wider text-champagne-muted">
                Product URL <span className="text-terracotta">*</span>
              </label>
              {detectedPlatform && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono text-champagne-faint">Detected:</span>
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
              className="w-full bg-obsidian border border-surface-border rounded-sm px-3.5 py-2.5 text-xs sm:text-sm text-champagne placeholder:text-champagne-faint focus:outline-none focus:border-gold/50 transition-colors"
            />
          </div>

          {/* Manual Current Price */}
          {(showManualPrice || currentPrice) && (
            <div className="p-3.5 rounded-sm bg-surface-subtle border border-gold/30 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="current-price-input" className="block text-xs font-mono uppercase tracking-wider text-gold">
                  Current Store Price in ₹ (Anti-Bot Bypass)
                </label>
                <Link
                  href="/extension"
                  className="text-[10px] font-mono bg-gold/15 text-gold px-2 py-0.5 rounded-sm border border-gold/30 inline-flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>1-Click Extension</span>
                </Link>
              </div>
              {derivedTitle && (
                <div className="text-[11px] text-sage bg-sage/10 border border-sage/20 rounded-sm px-2.5 py-1 flex items-center gap-1.5 font-mono">
                  <CheckCircle className="w-3 h-3 flex-shrink-0" />
                  <span>Identified item: <strong className="text-champagne">{derivedTitle}</strong></span>
                </div>
              )}
              <p className="text-[11px] text-champagne-faint leading-relaxed">
                {detectedPlatform ? detectedPlatform.toUpperCase() : 'This storefront'} protects against cloud scrapers. Enter the current live price on the product page so PriceWatcher can start tracking history immediately.
              </p>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-champagne-faint font-mono text-sm">
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
                  className="w-full bg-obsidian border border-gold/40 rounded-sm pl-8 pr-4 py-2 text-sm text-champagne placeholder:text-champagne-faint focus:outline-none focus:border-gold font-mono"
                />
              </div>
            </div>
          )}

          {!showManualPrice && !currentPrice && (
            <div className="flex justify-end -mt-3">
              <button
                type="button"
                onClick={() => setShowManualPrice(true)}
                className="text-[11px] font-mono text-champagne-faint hover:text-gold transition-colors"
              >
                + Enter current price manually (anti-bot bypass)
              </button>
            </div>
          )}

          {/* Optional Target Price */}
          <div>
            <label htmlFor="target-price-input" className="block text-xs font-mono uppercase tracking-wider text-champagne-muted mb-1">
              Custom Target Price in ₹ (Optional)
            </label>
            <p className="text-[11px] text-champagne-faint mb-2">
              Alerts trigger automatically at all-time lows. If you have a specific target price, set it here.
            </p>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-champagne-faint font-mono text-sm">
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
                className="w-full bg-obsidian border border-surface-border rounded-sm pl-8 pr-4 py-2 text-sm text-champagne placeholder:text-champagne-faint focus:outline-none focus:border-gold/50 font-mono"
              />
            </div>
          </div>

          {/* Optional Variant / Size & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="size-input" className="block text-xs font-mono uppercase tracking-wider text-champagne-muted mb-1">
                Size / Variant (Optional)
              </label>
              <input
                id="size-input"
                type="text"
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
                placeholder="e.g. M, L, UK 9, 256GB"
                disabled={isLoading}
                className="w-full bg-obsidian border border-surface-border rounded-sm px-3.5 py-2 text-xs text-champagne placeholder:text-champagne-faint focus:outline-none focus:border-gold/50 font-mono"
              />
            </div>
            <div>
              <label htmlFor="notes-input" className="block text-xs font-mono uppercase tracking-wider text-champagne-muted mb-1">
                Personal Notes (Optional)
              </label>
              <input
                id="notes-input"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Birthday gift, wait for Diwali"
                disabled={isLoading}
                className="w-full bg-obsidian border border-surface-border rounded-sm px-3.5 py-2 text-xs text-champagne placeholder:text-champagne-faint focus:outline-none focus:border-gold/50 font-mono"
              />
            </div>
          </div>

          {/* Security notice */}
          <div className="bg-obsidian border border-surface-border rounded-sm p-3 text-[11px] text-champagne-faint flex items-start gap-2.5">
            <Info className="w-3.5 h-3.5 text-gold flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              URLs are sanitized to remove affiliate trackers and verified against our SSRF domain allowlist.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="w-full bg-gold hover:bg-gold-hover disabled:bg-surface-subtle disabled:text-champagne-faint text-obsidian font-semibold py-3 px-4 rounded-sm text-xs sm:text-sm transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Extracting live product details...</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                <span>Start Monitoring Product</span>
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
        <div className="py-20 flex flex-col items-center justify-center text-champagne-faint">
          <Loader2 className="w-6 h-6 animate-spin text-gold mb-2" />
          <p className="text-xs font-mono">Loading form...</p>
        </div>
      }
    >
      <AddProductForm />
    </Suspense>
  );
}
