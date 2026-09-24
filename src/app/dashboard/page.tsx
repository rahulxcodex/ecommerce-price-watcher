'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Product, Platform } from '@/types';
import { ProductCard } from '@/components/product-card';

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & search
  const [search, setSearch] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'all'>('all');
  const [onlyAllTimeLow, setOnlyAllTimeLow] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'discount' | 'price_asc'>('recent');

  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load products');
      setProducts(data.products || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Filter & sort logic
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase());
    const matchesPlatform = selectedPlatform === 'all' || p.platform === selectedPlatform;
    const matchesLow = onlyAllTimeLow ? p.current_price <= p.lowest_price && p.lowest_price > 0 && p.highest_price > p.current_price : true;
    return matchesSearch && matchesPlatform && matchesLow;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'price_asc') return a.current_price - b.current_price;
    if (sortBy === 'discount') {
      const discA = a.highest_price > 0 ? (a.highest_price - a.current_price) / a.highest_price : 0;
      const discB = b.highest_price > 0 ? (b.highest_price - b.current_price) / b.highest_price : 0;
      return discB - discA;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const allTimeLowCount = products.filter(
    (p) => p.current_price <= p.lowest_price && p.lowest_price > 0 && p.highest_price > p.current_price
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            Tracked Products
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Tracking {products.length} items across Amazon, Flipkart, Meesho, Myntra, Ajio, and Westside
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchProducts}
            disabled={isLoading}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl transition-colors"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/add"
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-emerald-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Product</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
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
          {/* Platform toggle */}
          <div className="inline-flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            {(['all', 'amazon', 'flipkart', 'meesho', 'myntra', 'ajio', 'westside'] as const).map((plat) => (
              <button
                key={plat}
                onClick={() => setSelectedPlatform(plat)}
                className={`px-3 py-1.5 rounded-lg font-medium capitalize transition-colors ${
                  selectedPlatform === plat
                    ? 'bg-slate-800 text-emerald-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {plat}
              </button>
            ))}
          </div>

          {/* All-time low filter button */}
          <button
            onClick={() => setOnlyAllTimeLow(!onlyAllTimeLow)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              onlyAllTimeLow
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>All-time Low ({allTimeLowCount})</span>
          </button>

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium rounded-xl px-3 py-2 focus:outline-none"
          >
            <option value="recent">Sort: Newest</option>
            <option value="discount">Sort: Highest Discount</option>
            <option value="price_asc">Sort: Lowest Price</option>
          </select>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-12 text-center max-w-lg mx-auto space-y-4">
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
