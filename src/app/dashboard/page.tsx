'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  PlusCircle,
  Search,
  RefreshCw,
  Download,
  Crown,
  KeyRound,
  Zap,
  Clock,
  AlertTriangle,
  Flame,
  ShoppingBag,
  AlertCircle,
  Compass,
} from 'lucide-react';
import { Product, Platform } from '@/types';
import { ProductCard } from '@/components/product-card';
import { useAuth } from '@/contexts/auth-context';

export default function DashboardPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & search
  const [search, setSearch] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'all'>('all');
  const [onlyAllTimeLow, setOnlyAllTimeLow] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'discount' | 'price_asc'>('recent');
  const [creatorFilter, setCreatorFilter] = useState<'all' | 'mine' | 'partner'>('all');

  // Manual scraper trigger & liveness watchdog states
  const [isTriggeringScraper, setIsTriggeringScraper] = useState(false);
  const [triggerStatus, setTriggerStatus] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchProducts = async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/products', { signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load products');
      setProducts(data.products || []);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchProducts(controller.signal);
    return () => {
      controller.abort();
    };
  }, []);

  const isMineProduct = (p: Product) => {
    if (user?.name && p.created_by_name) {
      if (p.created_by_name.toLowerCase().trim() === user.name.toLowerCase().trim()) return true;
    }
    return Boolean(p.created_by_name?.toLowerCase().includes('rahul'));
  };

  const filteredProducts = useMemo(() =>
    products.filter((p) => {
      const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase());
      const matchesPlatform = selectedPlatform === 'all' || p.platform === selectedPlatform;
      const matchesLow = onlyAllTimeLow ? p.current_price <= p.lowest_price && p.lowest_price > 0 && p.highest_price > p.current_price : true;
      const isMine = isMineProduct(p);
      const matchesCreator =
        creatorFilter === 'all'
          ? true
          : creatorFilter === 'mine'
          ? isMine
          : !isMine;
      return matchesSearch && matchesPlatform && matchesLow && matchesCreator;
    }),
    [products, search, selectedPlatform, onlyAllTimeLow, creatorFilter, user]
  );

  const sortedProducts = useMemo(() =>
    [...filteredProducts].sort((a, b) => {
      if (sortBy === 'price_asc') return a.current_price - b.current_price;
      if (sortBy === 'discount') {
        const discA = a.highest_price > 0 ? (a.highest_price - a.current_price) / a.highest_price : 0;
        const discB = b.highest_price > 0 ? (b.highest_price - b.current_price) / b.highest_price : 0;
        return discB - discA;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }),
    [filteredProducts, sortBy]
  );

  const allTimeLowCount = useMemo(() =>
    products.filter(
      (p) => p.current_price <= p.lowest_price && p.lowest_price > 0 && p.highest_price > p.current_price
    ).length,
    [products]
  );

  const myCount = useMemo(() => {
    return products.filter((p) => isMineProduct(p)).length;
  }, [products, user]);

  const otherCount = useMemo(() => {
    return products.filter((p) => !isMineProduct(p)).length;
  }, [products, user]);

  // Watchdog metric: updated to 5.0h threshold for 4-hour cron schedule
  const latestScrapeTime = useMemo(() => {
    const timestamps = products
      .map((p) => (p.last_checked_at ? new Date(p.last_checked_at).getTime() : 0))
      .filter((t) => t > 0);
    return timestamps.length > 0 ? Math.max(...timestamps) : null;
  }, [products]);

  const elapsedHours = useMemo(() => {
    if (!latestScrapeTime) return null;
    return (Date.now() - latestScrapeTime) / (1000 * 60 * 60);
  }, [latestScrapeTime]);

  const isScraperStale = Boolean(elapsedHours !== null && elapsedHours >= 5.0);

  const handleManualScrapeTrigger = async () => {
    if (isTriggeringScraper) return;
    setIsTriggeringScraper(true);
    setTriggerStatus(null);
    try {
      const res = await fetch('/api/scraper/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setTriggerStatus({
          message: data.message || `Scrape completed! ${data.checkedCount || 0} products verified.`,
          type: 'success',
        });
        await fetchProducts();
      } else {
        setTriggerStatus({
          message: data.error || 'Failed to trigger scraper.',
          type: 'error',
        });
      }
    } catch {
      setTriggerStatus({ message: 'Network error triggering scraper.', type: 'error' });
    } finally {
      setIsTriggeringScraper(false);
    }
  };

  const exportData = (format: 'csv' | 'json') => {
    if (products.length === 0) return;
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(products, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `price-watcher-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['Platform', 'Title', 'Current Price', 'Lowest Price', 'Highest Price', 'Target Price', 'Status', 'URL', 'Created At'];
      const rows = products.map((p) => [
        p.platform,
        `"${(p.title || '').replace(/"/g, '""')}"`,
        p.current_price,
        p.lowest_price,
        p.highest_price,
        p.target_price || '',
        p.check_status,
        `"${p.url}"`,
        p.created_at,
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `price-watcher-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-surface-border">
        <div>
          <h1 className="font-display text-2xl sm:text-4xl text-champagne font-normal tracking-tight">
            Active Watchlist
          </h1>
          <p className="text-xs text-champagne-faint mt-1 font-mono">
            {products.length} monitored items across 6 storefronts • 4-hour cycle
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto w-full sm:w-auto flex-wrap">
          <Link
            href="/discover"
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gold/15 hover:bg-gold/25 text-gold border border-gold/30 rounded-sm text-xs font-medium transition-colors"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Discover Products</span>
          </Link>

          <button
            onClick={() => exportData('csv')}
            disabled={products.length === 0}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-surface hover:bg-surface-subtle text-champagne-muted border border-surface-border rounded-sm text-xs transition-colors disabled:opacity-50"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5 text-champagne-faint" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => fetchProducts()}
            disabled={isLoading}
            className="p-2 bg-surface hover:bg-surface-subtle text-champagne-muted border border-surface-border rounded-sm transition-colors"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/add"
            className="flex items-center justify-center gap-1.5 bg-surface-subtle hover:bg-surface-hover border border-surface-border text-champagne px-3 py-2 rounded-sm text-xs transition-colors whitespace-nowrap"
          >
            <PlusCircle className="w-3.5 h-3.5 text-gold" />
            <span>Track URL</span>
          </Link>
        </div>
      </div>

      {/* Special Combined Access Banner */}
      {user?.isCombined ? (
        <div className="p-4 sm:p-5 rounded-sm bg-surface border border-gold/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-surface-subtle border border-gold/30 flex items-center justify-center text-gold flex-shrink-0">
              <Crown className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-display text-base sm:text-lg text-champagne">
                  Special Combined Watchlist
                </h2>
                <span className="text-[9px] font-mono uppercase bg-gold/15 text-gold px-1.5 py-0.5 rounded-sm">
                  Joint Space
                </span>
                {latestScrapeTime && (
                  <span
                    className={`text-[9px] font-mono px-2 py-0.5 rounded-sm inline-flex items-center gap-1 ${
                      isScraperStale
                        ? 'bg-terracotta/20 text-terracotta border border-terracotta/40'
                        : 'bg-sage/15 text-sage border border-sage/30'
                    }`}
                  >
                    {isScraperStale ? (
                      <>
                        <AlertTriangle className="w-3 h-3 text-terracotta" />
                        Idle ({elapsedHours?.toFixed(1)}h ago)
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 text-sage" />
                        Checked {elapsedHours !== null ? (elapsedHours < 1 ? `${Math.round(elapsedHours * 60)}m ago` : `${elapsedHours.toFixed(1)}h ago`) : 'recently'}
                      </>
                    )}
                  </span>
                )}
              </div>
              <p className="text-xs text-champagne-faint mt-0.5">
                Unified joint watchlist: products and price drops across connected accounts are merged in this shared space.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleManualScrapeTrigger}
              disabled={isTriggeringScraper}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-gold hover:bg-gold-hover text-obsidian font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer"
              title="Manually trigger immediate price scrape across active products"
            >
              <Zap className={`w-3.5 h-3.5 ${isTriggeringScraper ? 'animate-spin' : ''}`} />
              <span>{isTriggeringScraper ? 'Checking...' : 'Run Scraper Now'}</span>
            </button>

            {/* Filter between Mine & Others */}
            <div className="flex items-center gap-1 p-0.5 bg-obsidian rounded-sm border border-surface-border text-xs">
              <button
                onClick={() => setCreatorFilter('all')}
                className={`px-2.5 py-1 rounded-sm text-xs font-medium transition-colors ${
                  creatorFilter === 'all'
                    ? 'bg-surface text-champagne border border-surface-border'
                    : 'text-champagne-faint hover:text-champagne'
                }`}
              >
                All ({products.length})
              </button>
              <button
                onClick={() => setCreatorFilter('mine')}
                className={`px-2.5 py-1 rounded-sm text-xs font-medium transition-colors ${
                  creatorFilter === 'mine'
                    ? 'bg-surface text-gold border border-gold/30'
                    : 'text-champagne-faint hover:text-champagne'
                }`}
              >
                Mine ({myCount})
              </button>
              <button
                onClick={() => setCreatorFilter('partner')}
                className={`px-2.5 py-1 rounded-sm text-xs font-medium transition-colors ${
                  creatorFilter === 'partner'
                    ? 'bg-surface text-champagne border border-surface-border'
                    : 'text-champagne-faint hover:text-champagne'
                }`}
              >
                Others ({otherCount})
              </button>
            </div>
          </div>
        </div>
      ) : !user ? (
        <div className="p-3.5 rounded-sm bg-surface border border-surface-border flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-champagne-muted">
            <KeyRound className="w-4 h-4 text-gold flex-shrink-0" />
            <span>
              Sign in with your 4-digit PIN for private tracking or Combined Access.
            </span>
          </div>
          <Link
            href="/login"
            className="flex-shrink-0 px-3 py-1 bg-surface-subtle hover:bg-surface-hover text-champagne border border-surface-border rounded-sm transition-colors text-xs"
          >
            Sign In
          </Link>
        </div>
      ) : null}

      {/* Trigger feedback banner */}
      {triggerStatus && (
        <div
          className={`p-3 rounded-sm border text-xs flex items-center justify-between gap-3 ${
            triggerStatus.type === 'success'
              ? 'bg-sage/10 border-sage/30 text-sage'
              : 'bg-terracotta/10 border-terracotta/30 text-terracotta'
          }`}
        >
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{triggerStatus.message}</span>
          </div>
          <button
            onClick={() => setTriggerStatus(null)}
            className="text-champagne-faint hover:text-champagne text-xs px-2 py-0.5 rounded-sm bg-surface"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Watchdog Stale Warning if scraping has not occurred for > 5.0 hours */}
      {isScraperStale && (
        <div className="p-3 rounded-sm border border-terracotta/40 bg-terracotta/10 text-terracotta text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-terracotta flex-shrink-0" />
            <span>
              <strong>Scraper Notice:</strong> Last scheduled cycle occurred{' '}
              <strong>{elapsedHours?.toFixed(1)} hours ago</strong> (Cycle: 4 hours).
            </span>
          </div>
          <button
            onClick={handleManualScrapeTrigger}
            disabled={isTriggeringScraper}
            className="px-3 py-1 rounded-sm bg-terracotta hover:bg-terracotta/80 text-obsidian font-bold text-xs whitespace-nowrap transition-colors"
          >
            {isTriggeringScraper ? 'Running...' : 'Run Scraper Now'}
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="w-3.5 h-3.5 text-champagne-faint absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search watchlist by product title..."
              className="w-full bg-surface border border-surface-border rounded-sm pl-9 pr-4 py-2 text-xs text-champagne placeholder:text-champagne-faint focus:outline-none focus:border-gold/50 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setOnlyAllTimeLow(!onlyAllTimeLow)}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-mono uppercase border transition-colors flex-1 sm:flex-none ${
                onlyAllTimeLow
                  ? 'bg-gold/20 text-gold border-gold/40'
                  : 'bg-surface text-champagne-muted border-surface-border hover:text-champagne'
              }`}
            >
              <Flame className="w-3 h-3 text-gold flex-shrink-0" />
              <span>All-Time Low ({allTimeLowCount})</span>
            </button>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-surface border border-surface-border text-champagne text-xs rounded-sm px-3 py-1.5 focus:outline-none flex-1 sm:flex-none"
            >
              <option value="recent">Sort: Newest First</option>
              <option value="discount">Sort: Highest Discount</option>
              <option value="price_asc">Sort: Lowest Price</option>
            </select>
          </div>
        </div>

        {/* Platform toggle */}
        <div className="w-full overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
          <div className="inline-flex bg-surface p-1 rounded-sm border border-surface-border text-xs whitespace-nowrap gap-1">
            {(['all', 'amazon', 'flipkart', 'meesho', 'myntra', 'ajio', 'westside'] as const).map((plat) => (
              <button
                key={plat}
                onClick={() => setSelectedPlatform(plat)}
                className={`px-3 py-1 rounded-sm text-xs font-mono uppercase tracking-wider transition-colors flex-shrink-0 ${
                  selectedPlatform === plat
                    ? 'bg-surface-subtle text-gold border border-gold/30'
                    : 'text-champagne-muted hover:text-champagne border border-transparent'
                }`}
              >
                {plat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error notification */}
      {error && (
        <div className="p-3.5 rounded-sm bg-terracotta/10 border border-terracotta/30 text-terracotta text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid or Empty State */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-64 rounded-sm bg-surface border border-surface-border animate-pulse p-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-16 h-4 bg-surface-subtle rounded-sm" />
                <div className="flex gap-3">
                  <div className="w-16 h-16 bg-surface-subtle rounded-sm" />
                  <div className="flex-1 space-y-2">
                    <div className="w-full h-4 bg-surface-subtle rounded-sm" />
                    <div className="w-2/3 h-4 bg-surface-subtle rounded-sm" />
                  </div>
                </div>
              </div>
              <div className="w-full h-8 bg-surface-subtle rounded-sm" />
            </div>
          ))}
        </div>
      ) : sortedProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onProductUpdated={(updated) => {
                setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
              }}
            />
          ))}
        </div>
      ) : (
        <div className="bg-surface border border-surface-border rounded-sm p-8 sm:p-12 text-center max-w-lg mx-auto space-y-4">
          <div className="w-14 h-14 rounded-sm bg-surface-subtle border border-surface-border flex items-center justify-center text-champagne-faint mx-auto">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-display text-xl text-champagne">No items tracked</h3>
            <p className="text-xs text-champagne-faint mt-1">
              {search || selectedPlatform !== 'all' || onlyAllTimeLow
                ? 'Try adjusting your search filters.'
                : 'Explore products across 6 storefronts or paste a direct product link.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Link
              href="/discover"
              className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-hover text-obsidian font-semibold px-4 py-2 rounded-sm text-xs transition-colors"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Discover Products</span>
            </Link>
            <Link
              href="/add"
              className="inline-flex items-center gap-1.5 bg-surface-subtle hover:bg-surface-hover text-champagne border border-surface-border px-4 py-2 rounded-sm text-xs transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5 text-gold" />
              <span>Paste URL</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
