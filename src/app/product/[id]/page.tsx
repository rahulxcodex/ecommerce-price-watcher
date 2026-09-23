'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
      const val = targetInput.trim() ? Number(targetInput) : null;
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_price: val }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update target price');

      setProduct(data.product);
      setMessage({ type: 'success', text: 'Target price updated successfully!' });
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
        body: JSON.stringify({ is_active: !product.is_active }),
      });
      const data = await res.json();
      if (res.ok) setProduct(data.product);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to stop tracking this product?')) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) router.push('/dashboard');
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
        <p className="text-xs">Loading product analytics...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-400">Product not found.</p>
        <Link href="/dashboard" className="text-emerald-400 text-xs mt-2 inline-block">
          Return to Dashboard
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
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Dashboard</span>
      </Link>

      {message && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border-red-500/20 text-red-400'
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
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Image */}
          <div className="w-full md:w-48 h-48 rounded-2xl bg-slate-800 flex-shrink-0 flex items-center justify-center p-3 border border-slate-700/50">
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image_url}
                alt={product.title}
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-slate-600 text-xs">No image available</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <PlatformBadge platform={product.platform} />
                {isAllTimeLow && (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold px-2.5 py-0.5 rounded-full">
                    🔥 ALL-TIME LOW
                  </span>
                )}
                {!product.is_active && (
                  <span className="bg-slate-800 text-slate-400 text-xs px-2.5 py-0.5 rounded-full font-medium">
                    Tracking Paused
                  </span>
                )}
              </div>

              <h1 className="text-lg sm:text-xl font-bold text-slate-100 leading-snug">
                {product.title}
              </h1>

              {/* Price Stats */}
              <div className="mt-4 flex flex-wrap items-baseline gap-3">
                <span className="text-3xl font-extrabold text-slate-100">
                  {formatPrice(product.current_price, product.currency)}
                </span>
                {product.highest_price > product.current_price && (
                  <span className="text-sm text-slate-500 line-through">
                    {formatPrice(product.highest_price, product.currency)}
                  </span>
                )}
                {discount > 0 && (
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                    {discount}% OFF Peak
                  </span>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-6 flex flex-wrap items-center gap-2.5 pt-4 border-t border-slate-800">
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition-colors shadow-md shadow-emerald-500/20"
              >
                <span>Buy on {product.platform.toUpperCase()}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={handleToggleActive}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
              >
                {product.is_active ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-amber-400" />
                    <span>Pause Tracking</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Resume Tracking</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Stop Tracking</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3 Metric cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/60">
            <span className="text-slate-500 text-[10px] uppercase font-semibold block">All-time Lowest</span>
            <span className="text-lg font-bold text-emerald-400">
              {formatPrice(product.lowest_price, product.currency)}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/60">
            <span className="text-slate-500 text-[10px] uppercase font-semibold block">Highest Recorded</span>
            <span className="text-lg font-bold text-slate-300">
              {formatPrice(product.highest_price, product.currency)}
            </span>
          </div>

          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/60">
            <span className="text-slate-500 text-[10px] uppercase font-semibold block">Last Checked</span>
            <span className="text-sm font-semibold text-slate-300 flex items-center gap-1 mt-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              {formatRelativeTime(product.last_checked_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Price History Chart */}
      <PriceChart history={history} lowestPrice={product.lowest_price} />

      {/* Target Price Configuration */}
      <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl">
        <div className="flex items-center gap-2 mb-2">
          <BellRing className="w-4 h-4 text-emerald-400" />
          <h2 className="text-base font-bold text-slate-100">Set Custom Price Alert</h2>
        </div>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          In addition to the automatic All-Time Low notification, get an instant Telegram alert if the price dips below your specified target.
        </p>

        <form onSubmit={handleUpdateTarget} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-sm">₹</span>
            <input
              type="number"
              min="1"
              step="1"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              placeholder="Enter target price threshold..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-4 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          <button
            type="submit"
            disabled={isSavingTarget}
            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-colors shadow-md shadow-emerald-500/20"
          >
            {isSavingTarget ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Save Target Alert</span>
          </button>
        </form>
      </div>
    </div>
  );
}
