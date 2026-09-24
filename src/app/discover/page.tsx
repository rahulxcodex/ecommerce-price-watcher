'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Compass,
  Search,
  Filter,
  CheckSquare,
  Square,
  PlusCircle,
  ExternalLink,
  Flame,
  Star,
  Tag,
  AlertCircle,
  History,
  Trash2,
  CheckCircle2,
  SlidersHorizontal,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Platform, DiscoveryResult, SmartFilterFacets, SearchHistoryItem } from '@/types';
import { PlatformBadge } from '@/components/platform-badge';
import { formatPrice } from '@/lib/utils';
import { SmartFacetRanking } from '@/lib/dsa';

const PLATFORMS: Array<{ id: Platform; label: string }> = [
  { id: 'amazon', label: 'Amazon' },
  { id: 'flipkart', label: 'Flipkart' },
  { id: 'meesho', label: 'Meesho' },
  { id: 'myntra', label: 'Myntra' },
  { id: 'ajio', label: 'Ajio' },
  { id: 'westside', label: 'Westside' },
];

export default function DiscoverPage() {
  const [platform, setPlatform] = useState<Platform>('amazon');
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<DiscoveryResult[]>([]);
  const [facets, setFacets] = useState<SmartFilterFacets | null>(null);
  const [facetRankings, setFacetRankings] = useState<SmartFacetRanking[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Smart filter states
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [selectedDiscount, setSelectedDiscount] = useState<number | null>(null);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [onlyPareto, setOnlyPareto] = useState(false);

  // Product selection for bulk monitoring
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isAddingBulk, setIsAddingBulk] = useState(false);
  const [bulkAddResult, setBulkAddResult] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Search history state
  const [historyItems, setHistoryItems] = useState<SearchHistoryItem[]>([]);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());

  // Load search history on mount
  const loadHistory = async () => {
    try {
      const res = await fetch('/api/discover/history');
      const data = await res.json();
      if (data.success && Array.isArray(data.history)) {
        setHistoryItems(data.history);
      }
    } catch {
      // Ignore background history failure
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string, overridePlatform?: Platform) => {
    if (e) e.preventDefault();
    const q = (overrideQuery ?? query).trim();
    const plat = overridePlatform ?? platform;
    if (!q) return;

    setIsSearching(true);
    setError(null);
    setBulkAddResult(null);
    setSelectedProductIds(new Set());
    // Reset filters for new search
    setSelectedBrands(new Set());
    setMinPrice(null);
    setMaxPrice(null);
    setSelectedDiscount(null);
    setSelectedRating(null);
    setOnlyPareto(false);

    try {
      const res = await fetch('/api/discover/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: plat, query: q, limit: 15 }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to search products.');
      }

      setSearchResults(data.results || []);
      setFacets(data.facets || null);
      setFacetRankings(data.facetRanking || []);
      // Pre-select all valid, not-already-tracked products for easy 1-click monitoring
      const preselected = new Set<string>();
      (data.results || []).forEach((r: DiscoveryResult) => {
        if (!r.isAlreadyTracked) {
          preselected.add(r.id);
        }
      });
      setSelectedProductIds(preselected);

      // Refresh search history list
      loadHistory();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  // Discard selected search history items
  const handleDiscardHistory = async (id?: string) => {
    const idsToDelete = id ? [id] : Array.from(selectedHistoryIds);
    if (idsToDelete.length === 0) return;

    for (const deleteId of idsToDelete) {
      try {
        await fetch('/api/discover/history', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: deleteId }),
        });
      } catch {}
    }

    setHistoryItems((prev) => prev.filter((h) => !idsToDelete.includes(h.id)));
    setSelectedHistoryIds(new Set());
  };

  // Client-side filtering over discovered products
  const filteredResults = useMemo(() => {
    return searchResults.filter((p) => {
      // Brand filter
      if (selectedBrands.size > 0) {
        if (!p.brand || !selectedBrands.has(p.brand)) return false;
      }
      // Price range filter
      if (minPrice !== null && p.price < minPrice) return false;
      if (maxPrice !== null && p.price > maxPrice) return false;
      // Discount filter
      if (selectedDiscount !== null) {
        const disc = p.discountPercent ?? 0;
        if (disc < selectedDiscount) return false;
      }
      // Rating filter
      if (selectedRating !== null) {
        const rat = p.rating ?? 0;
        if (rat < selectedRating) return false;
      }
      // Pareto filter
      if (onlyPareto && !p.isParetoOptimal) return false;

      return true;
    });
  }, [searchResults, selectedBrands, minPrice, maxPrice, selectedDiscount, selectedRating, onlyPareto]);

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    const untrackedFiltered = filteredResults.filter((p) => !p.isAlreadyTracked);
    const allSelected = untrackedFiltered.every((p) => selectedProductIds.has(p.id));

    if (allSelected) {
      setSelectedProductIds((prev) => {
        const next = new Set(prev);
        untrackedFiltered.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedProductIds((prev) => {
        const next = new Set(prev);
        untrackedFiltered.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  const handleBulkAddToWatchlist = async () => {
    const toAdd = searchResults.filter((p) => selectedProductIds.has(p.id) && !p.isAlreadyTracked);
    if (toAdd.length === 0) return;

    // Enforce 15-product bulk-add cap per request
    const cappedToAdd = toAdd.slice(0, 15);

    setIsAddingBulk(true);
    setBulkAddResult(null);

    try {
      const payload = cappedToAdd.map((p) => ({
        url: p.productUrl,
        platform: p.platform,
        title: p.title,
        price: p.price,
        imageUrl: p.imageUrl,
        originalPrice: p.originalPrice,
      }));

      const res = await fetch('/api/discover/add-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: payload }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add products to watchlist.');
      }

      setBulkAddResult({
        message: `Successfully added ${data.addedCount} product(s) to your active watchlist! Monitoring every 4 hours.`,
        type: 'success',
      });

      // Update already-tracked state locally
      const addedUrls = new Set(cappedToAdd.map((p) => p.productUrl));
      setSearchResults((prev) =>
        prev.map((r) => (addedUrls.has(r.productUrl) ? { ...r, isAlreadyTracked: true } : r))
      );
      setSelectedProductIds((prev) => {
        const next = new Set(prev);
        cappedToAdd.forEach((p) => next.delete(p.id));
        return next;
      });
    } catch (err: unknown) {
      setBulkAddResult({
        message: err instanceof Error ? err.message : 'Bulk add failed',
        type: 'error',
      });
    } finally {
      setIsAddingBulk(false);
    }
  };

  const clearAllFilters = () => {
    setSelectedBrands(new Set());
    setMinPrice(null);
    setMaxPrice(null);
    setSelectedDiscount(null);
    setSelectedRating(null);
    setOnlyPareto(false);
  };

  const activeFilterCount =
    (selectedBrands.size > 0 ? 1 : 0) +
    (minPrice !== null || maxPrice !== null ? 1 : 0) +
    (selectedDiscount !== null ? 1 : 0) +
    (selectedRating !== null ? 1 : 0) +
    (onlyPareto ? 1 : 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-surface-border">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-gold mb-1">
            <Compass className="w-3.5 h-3.5" />
            <span>Product Discovery Engine</span>
          </div>
          <h1 className="font-display text-2xl sm:text-4xl text-champagne font-normal tracking-tight">
            Discover &amp; Smart Monitor
          </h1>
          <p className="text-xs text-champagne-faint mt-1 font-mono">
            Search 10–15 candidate products across India&apos;s leading storefronts and bulk-track them.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-1.5 bg-surface hover:bg-surface-subtle border border-surface-border text-champagne px-3 py-2 rounded-sm text-xs transition-colors"
          >
            <span>View Watchlist</span>
            <ArrowRight className="w-3.5 h-3.5 text-champagne-faint" />
          </Link>
        </div>
      </div>

      {/* Search Console */}
      <div className="bg-surface border border-surface-border p-4 sm:p-6 rounded-sm space-y-4">
        {/* Platform Selector */}
        <div>
          <label className="block text-[11px] font-mono uppercase tracking-wider text-champagne-faint mb-2">
            1. Select Storefront
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {PLATFORMS.map((p) => {
              const isSelected = platform === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatform(p.id)}
                  className={`p-2.5 rounded-sm border text-xs font-mono uppercase tracking-wider transition-colors text-center ${
                    isSelected
                      ? 'bg-surface-subtle border-gold text-gold font-medium'
                      : 'bg-obsidian border-surface-border text-champagne-muted hover:text-champagne hover:border-surface-border/80'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Input Bar */}
        <div>
          <label className="block text-[11px] font-mono uppercase tracking-wider text-champagne-faint mb-2">
            2. Search Keywords
          </label>
          <form onSubmit={(e) => handleSearch(e)} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-champagne-faint absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. noise cancelling headphones, running shoes, linen shirt..."
                className="w-full bg-obsidian border border-surface-border rounded-sm pl-9 pr-4 py-2.5 text-xs sm:text-sm text-champagne placeholder:text-champagne-faint focus:outline-none focus:border-gold/50 transition-colors"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !query.trim()}
              className="flex items-center justify-center gap-2 bg-gold hover:bg-gold-hover text-obsidian font-semibold px-6 py-2.5 rounded-sm text-xs sm:text-sm transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              <Search className={`w-4 h-4 ${isSearching ? 'animate-spin' : ''}`} />
              <span>{isSearching ? 'Extracting Products...' : 'Discover 10–15 Items'}</span>
            </button>
          </form>
        </div>

        {/* Recent Search Suggestions with Keep/Discard Checkboxes */}
        {historyItems.length > 0 && (
          <div className="pt-2 border-t border-surface-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-champagne-faint flex items-center gap-1.5">
                <History className="w-3 h-3 text-gold" />
                <span>Recent Searches &amp; Suggestions</span>
              </span>
              {selectedHistoryIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => handleDiscardHistory()}
                  className="text-[10px] font-mono text-terracotta hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Discard Selected ({selectedHistoryIds.size})</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {historyItems.map((h) => {
                const isSelected = selectedHistoryIds.has(h.id);
                return (
                  <div
                    key={h.id}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm bg-obsidian border border-surface-border text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {
                        setSelectedHistoryIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(h.id)) next.delete(h.id);
                          else next.add(h.id);
                          return next;
                        });
                      }}
                      className="accent-[#C4A265] rounded-sm w-3 h-3 cursor-pointer"
                      title="Select to discard"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPlatform(h.platform);
                        setQuery(h.query);
                        handleSearch(undefined, h.query, h.platform);
                      }}
                      className="text-champagne-muted hover:text-gold transition-colors text-[11px]"
                    >
                      <span className="text-gold font-mono uppercase text-[9px] mr-1">[{h.platform}]</span>
                      <span>{h.query}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Feedback & Error states */}
      {error && (
        <div className="p-3.5 rounded-sm bg-terracotta/10 border border-terracotta/30 text-terracotta text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {bulkAddResult && (
        <div
          className={`p-3.5 rounded-sm border text-xs flex items-center gap-2 ${
            bulkAddResult.type === 'success'
              ? 'bg-sage/10 border-sage/30 text-sage'
              : 'bg-terracotta/10 border-terracotta/30 text-terracotta'
          }`}
        >
          {bulkAddResult.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{bulkAddResult.message}</span>
        </div>
      )}

      {/* Results View with Smart Filter Sidebar */}
      {searchResults.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Smart Filter Sidebar */}
          <div className="lg:col-span-1 bg-surface border border-surface-border p-4 rounded-sm space-y-5 sticky top-20">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-gold" />
                <h3 className="font-display text-base text-champagne">Smart Filters</h3>
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-[10px] font-mono text-gold hover:underline"
                >
                  Reset ({activeFilterCount})
                </button>
              )}
            </div>

            {/* Information Gain Ranking Insight */}
            {facetRankings.length > 0 && (
              <div className="p-2.5 rounded-sm bg-obsidian border border-surface-border">
                <span className="text-[9px] font-mono uppercase text-champagne-faint block mb-1">
                  DSA Entropy Ranking
                </span>
                <p className="text-[10px] text-champagne-muted leading-tight">
                  High Information Gain: filter by{' '}
                  <strong className="text-gold">{facetRankings[0]?.facetName}</strong> for balanced partition.
                </p>
              </div>
            )}

            {/* Pareto Frontier Filter Toggle */}
            <div className="p-2.5 rounded-sm bg-obsidian border border-surface-border">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyPareto}
                  onChange={(e) => setOnlyPareto(e.target.checked)}
                  className="mt-0.5 accent-[#C4A265] rounded-sm w-3.5 h-3.5 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-medium text-champagne flex items-center gap-1">
                    <span>Pareto Frontier</span>
                    <span className="text-[9px] font-mono text-gold bg-gold/15 px-1 rounded-sm uppercase">Optimal</span>
                  </span>
                  <p className="text-[10px] text-champagne-faint mt-0.5 leading-tight">
                    Show non-dominated deals balancing low price, high rating, and max discount.
                  </p>
                </div>
              </label>
            </div>

            {/* Brand Facet */}
            {facets?.brands && facets.brands.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-champagne-faint block">
                  Brands ({facets.brands.length})
                </span>
                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                  {facets.brands.map((b) => {
                    const isChecked = selectedBrands.has(b.name);
                    return (
                      <label key={b.name} className="flex items-center justify-between text-xs text-champagne-muted hover:text-champagne cursor-pointer">
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedBrands((prev) => {
                                const next = new Set(prev);
                                if (next.has(b.name)) next.delete(b.name);
                                else next.add(b.name);
                                return next;
                              });
                            }}
                            className="accent-[#C4A265] rounded-sm w-3 h-3 cursor-pointer"
                          />
                          <span className="truncate">{b.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-champagne-faint ml-2">({b.count})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Price Range Facet */}
            {facets?.priceRange && (
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-champagne-faint block">
                  Price Filter (INR)
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="number"
                    placeholder={`Min: ₹${facets.priceRange.min}`}
                    value={minPrice ?? ''}
                    onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : null)}
                    className="w-1/2 bg-obsidian border border-surface-border rounded-sm p-1.5 text-xs text-champagne placeholder:text-champagne-faint font-mono"
                  />
                  <span className="text-champagne-faint">-</span>
                  <input
                    type="number"
                    placeholder={`Max: ₹${facets.priceRange.max}`}
                    value={maxPrice ?? ''}
                    onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : null)}
                    className="w-1/2 bg-obsidian border border-surface-border rounded-sm p-1.5 text-xs text-champagne placeholder:text-champagne-faint font-mono"
                  />
                </div>
              </div>
            )}

            {/* Discount Bracket Facet */}
            {facets?.discountRanges && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-champagne-faint block">
                  Minimum Discount
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {facets.discountRanges.map((d) => {
                    const isSelected = selectedDiscount === d.min;
                    return (
                      <button
                        key={d.min}
                        type="button"
                        onClick={() => setSelectedDiscount(isSelected ? null : d.min)}
                        className={`px-2 py-1 text-xs font-mono rounded-sm border transition-colors ${
                          isSelected
                            ? 'bg-surface-subtle border-sage text-sage font-medium'
                            : 'bg-obsidian border-surface-border text-champagne-muted hover:text-champagne'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Rating Facet */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-champagne-faint block">
                Rating Threshold
              </span>
              <div className="flex gap-1.5">
                {[4.0, 4.5].map((r) => {
                  const isSelected = selectedRating === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSelectedRating(isSelected ? null : r)}
                      className={`flex-1 py-1 text-xs font-mono rounded-sm border transition-colors flex items-center justify-center gap-1 ${
                        isSelected
                          ? 'bg-surface-subtle border-gold text-gold font-medium'
                          : 'bg-obsidian border-surface-border text-champagne-muted hover:text-champagne'
                      }`}
                    >
                      <Star className="w-3 h-3 fill-current" />
                      <span>{r}★+</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Results Grid & Bulk Action */}
          <div className="lg:col-span-3 space-y-4">
            {/* Header controls above grid */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-surface border border-surface-border rounded-sm">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAllFiltered}
                  className="flex items-center gap-1.5 text-xs font-mono uppercase text-champagne hover:text-gold transition-colors"
                >
                  {filteredResults.filter((p) => !p.isAlreadyTracked).every((p) => selectedProductIds.has(p.id)) && filteredResults.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-gold" />
                  ) : (
                    <Square className="w-4 h-4 text-champagne-faint" />
                  )}
                  <span>Select All ({selectedProductIds.size} selected)</span>
                </button>
                <span className="text-champagne-faint text-xs">•</span>
                <span className="text-xs text-champagne-faint font-mono">
                  Showing {filteredResults.length} of {searchResults.length}
                </span>
              </div>

              {selectedProductIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleBulkAddToWatchlist}
                  disabled={isAddingBulk}
                  className="flex items-center justify-center gap-1.5 bg-gold hover:bg-gold-hover text-obsidian font-semibold px-4 py-1.5 rounded-sm text-xs transition-colors shadow-none whitespace-nowrap disabled:opacity-50"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>
                    {isAddingBulk
                      ? 'Adding Products...'
                      : `Monitor Selected (${Math.min(15, selectedProductIds.size)})`}
                  </span>
                </button>
              )}
            </div>

            {/* Product Card Grid */}
            {filteredResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredResults.map((product) => {
                  const isSelected = selectedProductIds.has(product.id);
                  return (
                    <div
                      key={product.id}
                      onClick={() => !product.isAlreadyTracked && toggleSelectProduct(product.id)}
                      className={`group relative bg-surface border rounded-sm p-3.5 flex flex-col justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-gold bg-surface-subtle/80'
                          : product.isAlreadyTracked
                          ? 'border-surface-border opacity-65 cursor-default'
                          : 'border-surface-border hover:border-gold/40'
                      }`}
                    >
                      <div>
                        {/* Top bar with checkbox and platform badge */}
                        <div className="flex items-center justify-between gap-1.5 mb-2.5">
                          <div className="flex items-center gap-2">
                            {product.isAlreadyTracked ? (
                              <span className="text-[9px] font-mono uppercase bg-surface-subtle text-champagne-faint px-1.5 py-0.5 rounded-sm border border-surface-border">
                                Monitored
                              </span>
                            ) : (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectProduct(product.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="accent-[#C4A265] rounded-sm w-4 h-4 cursor-pointer"
                              />
                            )}
                            <PlatformBadge platform={product.platform} />
                          </div>

                          {product.isParetoOptimal && (
                            <span className="text-[9px] font-mono text-gold bg-gold/15 border border-gold/30 px-1.5 py-0.5 rounded-sm uppercase">
                              Pareto Optimal
                            </span>
                          )}
                        </div>

                        {/* Image and details */}
                        <div className="flex gap-3 mb-2">
                          <div className="relative w-16 h-16 rounded-sm bg-obsidian border border-surface-border flex-shrink-0 overflow-hidden flex items-center justify-center">
                            {product.imageUrl ? (
                              <Image
                                src={product.imageUrl}
                                alt={product.title}
                                fill
                                sizes="64px"
                                className="object-contain p-1"
                                loading="lazy"
                                unoptimized
                              />
                            ) : (
                              <span className="text-champagne-faint text-[9px] font-mono">No Image</span>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            {product.brand && (
                              <span className="text-[10px] font-mono text-gold uppercase tracking-wider block truncate">
                                {product.brand}
                              </span>
                            )}
                            <h4 className="text-xs font-medium text-champagne line-clamp-2 leading-snug">
                              {product.title}
                            </h4>
                          </div>
                        </div>

                        {/* Price & Discount Bar */}
                        <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                          <span className="font-display text-xl text-champagne-light tracking-tight font-normal">
                            {formatPrice(product.price, 'INR')}
                          </span>
                          {product.originalPrice && product.originalPrice > product.price && (
                            <span className="text-xs text-champagne-faint line-through font-mono">
                              {formatPrice(product.originalPrice, 'INR')}
                            </span>
                          )}
                          {product.discountPercent && product.discountPercent > 0 && (
                            <span className="text-[10px] font-mono text-sage bg-sage/15 border border-sage/30 px-1 rounded-sm">
                              {product.discountPercent}% Off
                            </span>
                          )}
                        </div>

                        {/* Rating snippet */}
                        {product.rating && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] font-mono text-champagne-muted">
                            <Star className="w-3 h-3 text-gold fill-current" />
                            <span>{product.rating}</span>
                            {product.reviewCount && (
                              <span className="text-champagne-faint">({product.reviewCount})</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Store Link */}
                      <div className="mt-3 pt-2 border-t border-surface-border flex items-center justify-between">
                        <span className="text-[10px] font-mono text-champagne-faint">
                          {product.isAlreadyTracked ? 'In Watchlist' : isSelected ? 'Selected to Monitor' : 'Click card to select'}
                        </span>
                        <a
                          href={product.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 text-champagne-faint hover:text-gold transition-colors"
                          title="Open on Storefront"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-surface border border-surface-border p-8 text-center rounded-sm space-y-2">
                <p className="text-sm font-medium text-champagne">No products match your current filters.</p>
                <p className="text-xs text-champagne-faint font-mono">Try clearing one or more smart filter facets.</p>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="mt-2 text-xs font-mono text-gold hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
