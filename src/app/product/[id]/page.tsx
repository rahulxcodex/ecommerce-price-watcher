'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { analyzePriceTrend, computeOptimalStopping } from '@/lib/dsa';
import {
  ArrowLeft,
  ExternalLink,
  Trash2,
  Pause,
  Play,
  TrendingDown,
  BellRing,
  Clock,
  AlertTriangle,
  Save,
  Loader2,
  CheckCircle2,
  Activity,
  Calculator,
} from 'lucide-react';
import { Product, PriceHistoryItem } from '@/types';
import { PlatformBadge } from '@/components/platform-badge';
import { PriceChart } from '@/components/price-chart';
import { formatPrice, formatRelativeTime, calculateDiscount } from '@/lib/utils';

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const id = params.id;

  const [product, setProduct] = useState<Product | null>(null);
  const [history, setHistory] = useState<PriceHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingTarget, setIsSavingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const trendAnalysis = useMemo(
    () =>
      analyzePriceTrend(
        history.map((h) => ({ price: h.price, timestamp: h.recorded_at }))
      ),
    [history]
  );

  const optimalStopping = useMemo(
    () => computeOptimalStopping(history.map((h) => Number(h.price))),
    [history]
  );

  const fetchDetails = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load product');

      setProduct(data.product);
      setHistory(data.history || []);
      setTargetInput(data.product.target_price ? String(data.product.target_price) : '');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage({ type: 'error', text: msg });
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleUpdateTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTarget(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_price: targetInput ? Number(targetInput) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update target price');
      setProduct(data.product);
      setMessage({ type: 'success', text: 'Target price updated successfully.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage({ type: 'error', text: msg });
    } finally {
      setIsSavingTarget(false);
    }
  };

  const handleToggleActive = async () => {
    if (!product) return;
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: !product.is_active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update tracking state');
      setProduct(data.product);
      setMessage({
        type: 'success',
        text: data.product.is_active ? 'Tracking resumed.' : 'Tracking paused.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage({ type: 'error', text: msg });
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to remove this product from your watchlist?')) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete product');
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessage({ type: 'error', text: msg });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-champagne-faint font-mono">
        <Loader2 className="w-6 h-6 animate-spin text-gold" />
        <p className="text-xs">Loading product intelligence...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-20 bg-surface border border-surface-border rounded-sm">
        <p className="text-champagne-faint text-sm">Product not found.</p>
        <Link href="/dashboard" className="text-gold text-xs font-mono mt-2 inline-block hover:underline">
          ← Return to Watchlist
        </Link>
      </div>
    );
  }

  const isAllTimeLow = product.current_price <= product.lowest_price && product.lowest_price > 0;
  const discount = calculateDiscount(product.current_price, product.highest_price);

  return (
    <div className="max-w-4xl mx-auto py-4 space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-mono text-champagne-faint hover:text-champagne transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Watchlist</span>
      </Link>

      {message && (
        <div
          className={`p-3.5 rounded-sm text-xs flex items-center gap-2 border ${
            message.type === 'success'
              ? 'bg-sage/10 border-sage/30 text-sage'
              : 'bg-terracotta/10 border-terracotta/30 text-terracotta'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Product Card Header */}
      <div className="bg-surface border border-surface-border p-4 sm:p-6 rounded-sm">
        <div className="flex flex-col md:flex-row gap-4 sm:gap-6">
          {/* Image */}
          <div className="relative w-full md:w-48 h-48 sm:h-52 rounded-sm bg-obsidian flex-shrink-0 flex items-center justify-center p-3 border border-surface-border overflow-hidden">
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.title}
                fill
                sizes="(max-width: 768px) 100vw, 192px"
                className="object-contain p-2"
                unoptimized
              />
            ) : (
              <span className="text-champagne-faint text-xs font-mono">No image available</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <PlatformBadge platform={product.platform} />
                {product.created_by_name && (
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-sm border bg-surface-subtle text-champagne-muted border-surface-border">
                    {product.created_by_name.toLowerCase().includes('rahul')
                      ? 'Shared Space'
                      : 'Personal'}
                  </span>
                )}
                {isAllTimeLow && (
                  <span className="bg-gold/20 text-gold border border-gold/40 text-[10px] font-mono uppercase px-2 py-0.5 rounded-sm">
                    ★ All-Time Low
                  </span>
                )}
                {!product.is_active && (
                  <span className="bg-surface-subtle text-champagne-faint text-[10px] font-mono uppercase px-2 py-0.5 rounded-sm border border-surface-border">
                    Paused
                  </span>
                )}
              </div>

              <h1 className="font-display text-xl sm:text-2xl font-normal text-champagne leading-snug break-words">
                {product.title}
              </h1>

              {/* Price Stats */}
              <div className="mt-3 flex flex-wrap items-baseline gap-2.5 sm:gap-3">
                <span className="font-display text-2xl sm:text-3xl font-normal text-champagne-light">
                  {formatPrice(product.current_price, product.currency)}
                </span>
                {product.highest_price > product.current_price && (
                  <span className="text-xs sm:text-sm text-champagne-faint line-through font-mono">
                    {formatPrice(product.highest_price, product.currency)}
                  </span>
                )}
                {discount > 0 && (
                  <span className="text-xs font-mono text-sage bg-sage/15 px-2 py-0.5 rounded-sm border border-sage/30">
                    {discount}% Off Peak
                  </span>
                )}
                {product.selected_size && (
                  <span className="text-xs font-mono bg-surface-subtle text-champagne-muted px-2 py-0.5 rounded-sm border border-surface-border">
                    Size: {product.selected_size}
                  </span>
                )}
              </div>

              {/* Data Science Predictive Analytics: Buy vs. Wait Engine */}
              {(() => {
                const isDeceptive = product.highest_price >= product.current_price * 1.5 && history.length >= 2;
                const rec = trendAnalysis.recommendation;

                return (
                  <div className="mt-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-sm bg-obsidian border border-surface-border text-xs font-mono">
                      <span className="text-champagne-faint">OLS Verdict:</span>
                      {rec === 'STRONG_BUY' ? (
                        <span className="text-sage font-medium flex items-center gap-1">
                          ● STRONG BUY (Historical Floor)
                        </span>
                      ) : rec === 'BUY' ? (
                        <span className="text-sage flex items-center gap-1">
                          ● GOOD BUY (Favorable Range)
                        </span>
                      ) : (
                        <span className="text-gold flex items-center gap-1">
                          ● WAIT (Price expected to drop)
                        </span>
                      )}

                      {trendAnalysis.rollingLow7d !== undefined && trendAnalysis.rollingLow7d > 0 && (
                        <span className="text-[10px] text-champagne-faint px-1.5 py-0.5 rounded-sm border border-surface-border">
                          7d Low: {formatPrice(trendAnalysis.rollingLow7d, product.currency)}
                        </span>
                      )}

                      {trendAnalysis.direction && (
                        <span className="text-[10px] text-champagne-faint px-1.5 py-0.5 rounded-sm border border-surface-border">
                          Trend: {trendAnalysis.direction === 'falling' ? '📉 Dropping' : trendAnalysis.direction === 'rising' ? '📈 Rising' : '➡️ Stable'} ({trendAnalysis.confidence}%)
                        </span>
                      )}
                    </div>

                    {/* Optimal Stopping (Secretary Problem / 37% rule) Badge */}
                    <div className="p-2.5 rounded-sm bg-obsidian border border-surface-border text-xs font-mono space-y-1">
                      <div className="flex items-center justify-between text-champagne-muted">
                        <span className="flex items-center gap-1 text-[11px] text-gold uppercase tracking-wider">
                          <Activity className="w-3.5 h-3.5" />
                          <span>Optimal Stopping (37% Secretary Rule)</span>
                        </span>
                        <span className="text-champagne text-[11px]">Score: {optimalStopping.stoppingScore}/100</span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] text-champagne-faint">
                        <span>P(Cheaper Soon): {(optimalStopping.probCheaperSoon * 100).toFixed(0)}%</span>
                        <span>•</span>
                        <span>Log Volatility: σ = {optimalStopping.logVolatility}</span>
                        <span>•</span>
                        <span className={optimalStopping.shouldBuyNow ? 'text-sage font-medium' : 'text-gold'}>
                          {optimalStopping.shouldBuyNow ? '✓ Statistically Optimal to Buy' : '⏳ Post-calibration waiting mode'}
                        </span>
                      </div>
                    </div>

                    {isDeceptive && (
                      <div className="text-[11px] font-mono text-terracotta bg-terracotta/10 border border-terracotta/20 p-2 rounded-sm flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Deceptive MRP detected: Retailer markup of {Math.round((product.highest_price / product.current_price - 1) * 100)}% simulates inflated discount.</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Bank Card Discount Calculator */}
              {product.bank_offers && product.bank_offers.length > 0 && (
                <div className="mt-3 bg-obsidian border border-surface-border p-3 rounded-sm text-xs font-mono">
                  <span className="text-gold font-medium block mb-1">💳 Bank Offers:</span>
                  <div className="space-y-1">
                    {product.bank_offers.map((offer, idx) => {
                      const estimatedDiscount = Math.min(Math.round(product.current_price * 0.1), 1500);
                      const netPrice = product.current_price - estimatedDiscount;
                      return (
                        <div key={idx} className="flex justify-between items-center text-champagne-muted">
                          <span>{offer.bank} Card Discount (10% up to ₹1,500)</span>
                          <span className="text-gold font-medium">Net: {formatPrice(netPrice)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="mt-5 flex flex-wrap items-center gap-2 pt-4 border-t border-surface-border">
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gold hover:bg-gold-hover text-obsidian font-semibold px-4 py-2 rounded-sm text-xs transition-colors whitespace-nowrap"
              >
                <span>Buy on {product.platform.toUpperCase()}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={handleToggleActive}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-surface-subtle hover:bg-surface-hover border border-surface-border text-champagne px-3.5 py-2 rounded-sm text-xs font-medium transition-colors whitespace-nowrap"
              >
                {product.is_active ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-gold" />
                    <span>Pause Tracking</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-sage" />
                    <span>Resume Tracking</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDelete}
                className="w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-1.5 bg-surface hover:bg-surface-subtle text-terracotta border border-surface-border px-3.5 py-2 rounded-sm text-xs font-medium transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3 Metric cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 mt-5 pt-5 border-t border-surface-border">
          <div className="bg-obsidian p-3 rounded-sm border border-surface-border">
            <span className="text-champagne-faint text-[9px] font-mono uppercase tracking-wider block">All-time Lowest</span>
            <span className="text-base sm:text-lg font-mono font-medium text-sage">
              {formatPrice(product.lowest_price, product.currency)}
            </span>
          </div>

          <div className="bg-obsidian p-3 rounded-sm border border-surface-border">
            <span className="text-champagne-faint text-[9px] font-mono uppercase tracking-wider block">Highest Recorded</span>
            <span className="text-base sm:text-lg font-mono font-medium text-champagne">
              {formatPrice(product.highest_price, product.currency)}
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-obsidian p-3 rounded-sm border border-surface-border">
            <span className="text-champagne-faint text-[9px] font-mono uppercase tracking-wider block">Last Checked</span>
            <span className="text-xs sm:text-sm font-mono text-champagne-muted flex items-center gap-1 mt-1">
              <Clock className="w-3.5 h-3.5 text-champagne-faint flex-shrink-0" />
              <span>{formatRelativeTime(product.last_checked_at)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Price History Chart */}
      <PriceChart history={history} lowestPrice={product.lowest_price} />

      {/* Target Price Configuration */}
      <div className="bg-surface border border-surface-border p-4 sm:p-6 rounded-sm">
        <div className="flex items-center gap-2 mb-2">
          <BellRing className="w-4 h-4 text-gold" />
          <h2 className="font-display text-lg text-champagne">Set Custom Price Alert</h2>
        </div>
        <p className="text-xs text-champagne-faint mb-4 leading-relaxed">
          In addition to the automatic All-Time Low notification, get an instant Telegram alert if the price dips below your specified target.
        </p>

        <form onSubmit={handleUpdateTarget} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-champagne-faint font-mono text-sm">₹</span>
            <input
              type="number"
              min="1"
              step="1"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              placeholder="Enter target price threshold..."
              className="w-full bg-obsidian border border-surface-border rounded-sm pl-8 pr-4 py-2 text-xs text-champagne placeholder:text-champagne-faint focus:outline-none focus:border-gold/50 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={isSavingTarget}
            className="flex items-center justify-center gap-2 bg-gold hover:bg-gold-hover text-obsidian font-semibold px-4 py-2 rounded-sm text-xs transition-colors"
          >
            {isSavingTarget ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Save Alert</span>
          </button>
        </form>
      </div>
    </div>
  );
}
