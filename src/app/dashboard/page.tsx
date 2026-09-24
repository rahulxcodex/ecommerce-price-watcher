'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  PlusCircle,
  Search,
  Filter,
  RefreshCw,
  TrendingDown,
  ShoppingBag,
  AlertCircle,
  Flame,
  Download,
  Crown,
  KeyRound,
  Users,
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

  const isCurrentUserFirstPartner = Boolean(user?.name?.toLowerCase().includes('rahul'));

  // Filter & sort logic (memoized to avoid re-computation on unrelated re-renders)
  const filteredProducts = useMemo(() =>
    products.filter((p) => {
      const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase());
      const matchesPlatform = selectedPlatform === 'all' || p.platform === selectedPlatform;
      const matchesLow = onlyAllTimeLow ? p.current_price <= p.lowest_price && p.lowest_price > 0 && p.highest_price > p.current_price : true;
      const isFirstPartner = Boolean(p.created_by_name?.toLowerCase().includes('rahul'));
      const isSecondPartner = Boolean(p.created_by_name?.toLowerCase().includes('nisha'));
      const matchesCreator =
        creatorFilter === 'all'
          ? true
          : creatorFilter === 'mine'
          ? (isCurrentUserFirstPartner ? isFirstPartner : isSecondPartner)
          : (isCurrentUserFirstPartner ? isSecondPartner : isFirstPartner);
      return matchesSearch && matchesPlatform && matchesLow && matchesCreator;
    }),
    [products, search, selectedPlatform, onlyAllTimeLow, creatorFilter, isCurrentUserFirstPartner]
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
    return products.filter((p) => {
      const isFirst = Boolean(p.created_by_name?.toLowerCase().includes('rahul'));
      const isSecond = Boolean(p.created_by_name?.toLowerCase().includes('nisha'));
      return isCurrentUserFirstPartner ? isFirst : isSecond;
    }).length;
  }, [products, isCurrentUserFirstPartner]);

  const partnerCount = useMemo(() => {
    return products.filter((p) => {
      const isFirst = Boolean(p.created_by_name?.toLowerCase().includes('rahul'));
      const isSecond = Boolean(p.created_by_name?.toLowerCase().includes('nisha'));
      return isCurrentUserFirstPartner ? isSecond : isFirst;
    }).length;
  }, [products, isCurrentUserFirstPartner]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            Tracked Products
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Tracking {products.length} items across Amazon, Flipkart, Meesho, Myntra, Ajio, and Westside
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto w-full sm:w-auto">
          <button
            onClick={() => exportData('csv')}
            disabled={products.length === 0}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 sm:py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs transition-colors disabled:opacity-50"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => fetchProducts()}
            disabled={isLoading}
            className="p-2 sm:p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl transition-colors"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/add"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20 whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Product</span>
          </Link>
        </div>
      </div>

      {/* Special Combined Access Banner */}
      {user?.isCombined ? (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-teal-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm sm:text-base text-amber-300">
                  Special Combined Access Active
                </h2>
                <span className="text-[10px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                  Shared Space
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Unified joint watchlist: products and price drops across connected accounts are merged in this shared space.
              </p>
            </div>
          </div>

          {/* Quick Filter between Mine & Partner */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800/80 self-start sm:self-auto text-xs">
            <button
              onClick={() => setCreatorFilter('all')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                creatorFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Items ({products.length})
            </button>
            <button
              onClick={() => setCreatorFilter('mine')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                creatorFilter === 'mine'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mine ({myCount})
            </button>
            <button
              onClick={() => setCreatorFilter('partner')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                creatorFilter === 'partner'
                  ? 'bg-pink-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Partner ({partnerCount})
            </button>
          </div>
        </div>
      ) : !user ? (
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <KeyRound className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              Sign in with your 4-digit PIN for private tracking or Combined Access.
            </span>
          </div>
          <Link
            href="/login"
            className="flex-shrink-0 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg transition-colors text-xs"
          >
            Sign In
          </Link>
        </div>
      ) : null}

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1 w-full md:max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* All-time low filter button */}
            <button
              onClick={() => setOnlyAllTimeLow(!onlyAllTimeLow)}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors flex-1 sm:flex-none ${
                onlyAllTimeLow
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span>All-time Low ({allTimeLowCount})</span>
            </button>

            {/* Sort dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium rounded-xl px-3 py-2 focus:outline-none flex-1 sm:flex-none"
            >
              <option value="recent">Sort: Newest</option>
              <option value="discount">Sort: Highest Discount</option>
              <option value="price_asc">Sort: Lowest Price</option>
            </select>
          </div>
        </div>

        {/* Platform toggle (touch-scrollable horizontal bar on mobile) */}
        <div className="w-full overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1">
          <div className="inline-flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs whitespace-nowrap">
            {(['all', 'amazon', 'flipkart', 'meesho', 'myntra', 'ajio', 'westside'] as const).map((plat) => (
              <button
                key={plat}
                onClick={() => setSelectedPlatform(plat)}
                className={`px-3 py-1.5 rounded-lg font-medium capitalize transition-colors flex-shrink-0 ${
                  selectedPlatform === plat
                    ? 'bg-slate-800 text-emerald-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
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
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid or Empty State */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-64 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse p-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="w-16 h-5 bg-slate-800 rounded-full" />
                <div className="flex gap-3">
                  <div className="w-16 h-16 bg-slate-800 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="w-full h-4 bg-slate-800 rounded" />
                    <div className="w-2/3 h-4 bg-slate-800 rounded" />
                  </div>
                </div>
              </div>
              <div className="w-full h-10 bg-slate-800 rounded-xl" />
            </div>
          ))}
        </div>
      ) : sortedProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
          {sortedProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl sm:rounded-3xl p-6 sm:p-12 text-center max-w-lg mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-200">No products found</h3>
            <p className="text-xs text-slate-400 mt-1">
              {search || selectedPlatform !== 'all' || onlyAllTimeLow
                ? 'Try adjusting your search filters.'
                : 'Start by tracking your first product from Amazon, Flipkart, or Meesho.'}
            </p>
          </div>
          <Link
            href="/add"
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-colors shadow-md shadow-emerald-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Track First Product</span>
          </Link>
        </div>
      )}
    </div>
  );
}
