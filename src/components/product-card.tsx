'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ExternalLink, TrendingDown, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { Product } from '@/types';
import { PlatformBadge } from './platform-badge';
import { formatPrice, formatRelativeTime, calculateDiscount } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  onProductUpdated?: (updatedProduct: Product) => void;
}

export function ProductCard({ product, onProductUpdated }: ProductCardProps) {
  const [currentProduct, setCurrentProduct] = useState(product);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  useEffect(() => {
    setCurrentProduct(product);
  }, [product]);

  const isAllTimeLow =
    currentProduct.current_price <= currentProduct.lowest_price &&
    currentProduct.lowest_price > 0 &&
    currentProduct.highest_price > currentProduct.current_price;

  const isOutOfStock = currentProduct.check_status === 'out_of_stock';
  const discount = calculateDiscount(currentProduct.current_price, currentProduct.highest_price);

  const handleProductRefresh = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isRefreshing) return;

    setIsRefreshing(true);
    setRefreshMessage(null);

    try {
      const res = await fetch('/api/scraper/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: currentProduct.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to refresh price');
      }

      // Fetch latest product details from DB
      const prodRes = await fetch(`/api/products/${currentProduct.id}`);
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        if (prodData.product) {
          setCurrentProduct(prodData.product);
          onProductUpdated?.(prodData.product);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setRefreshMessage(msg);
      setTimeout(() => setRefreshMessage(null), 5000);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="group relative bg-surface border border-surface-border hover:border-gold/40 transition-colors rounded-sm p-4 flex flex-col justify-between">
      <div>
        {/* Header with platform & status badges */}
        <div className="flex items-center justify-between gap-1.5 mb-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <PlatformBadge platform={currentProduct.platform} />
            {currentProduct.created_by_name && (
              <span className="text-[9px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded-sm border bg-surface-subtle text-champagne-muted border-surface-border">
                {currentProduct.created_by_name.toLowerCase().includes('rahul')
                  ? 'Shared Space'
                  : 'Personal'}
              </span>
            )}
          </div>

          {isOutOfStock ? (
            <span className="inline-flex items-center gap-1 bg-terracotta/15 text-terracotta border border-terracotta/30 text-[10px] font-mono uppercase px-2 py-0.5 rounded-sm">
              Out of Stock
            </span>
          ) : isAllTimeLow ? (
            <span className="inline-flex items-center gap-1 bg-gold/20 text-gold border border-gold/40 text-[10px] font-mono font-medium tracking-wide uppercase px-2 py-0.5 rounded-sm">
              ★ All-Time Low
            </span>
          ) : discount > 0 ? (
            <span className="inline-flex items-center gap-1 bg-sage/15 text-sage border border-sage/30 text-[10px] font-mono uppercase px-2 py-0.5 rounded-sm">
              <TrendingDown className="w-3 h-3" />
              {discount}% Off
            </span>
          ) : null}
        </div>

        {/* Product image & title */}
        <div className="flex gap-3 mb-3">
          <div className="relative w-20 h-20 rounded-sm bg-obsidian flex-shrink-0 overflow-hidden flex items-center justify-center border border-surface-border">
            {currentProduct.image_url ? (
              <Image
                src={currentProduct.image_url}
                alt={currentProduct.title}
                fill
                sizes="80px"
                className="object-contain p-1 group-hover:scale-105 transition-transform"
                loading="lazy"
                unoptimized
              />
            ) : (
              <span className="text-champagne-faint text-[10px] font-mono">No Image</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <Link
              href={`/product/${currentProduct.id}`}
              className="font-medium text-xs sm:text-sm text-champagne hover:text-gold line-clamp-2 break-words transition-colors"
              title={currentProduct.title}
            >
              {currentProduct.title}
            </Link>

            <div className="mt-2 flex items-baseline gap-2 flex-wrap">
              <span className="font-display text-xl sm:text-2xl text-champagne-light tracking-tight font-normal">
                {formatPrice(currentProduct.current_price, currentProduct.currency)}
              </span>
              {currentProduct.highest_price > currentProduct.current_price && (
                <span className="text-xs text-champagne-faint line-through font-mono">
                  {formatPrice(currentProduct.highest_price, currentProduct.currency)}
                </span>
              )}
              {currentProduct.selected_size && (
                <span className="text-[10px] font-mono bg-surface-subtle text-champagne-muted px-1.5 py-0.2 rounded-sm border border-surface-border">
                  Size: {currentProduct.selected_size}
                </span>
              )}
            </div>

            {currentProduct.bank_offers && currentProduct.bank_offers.length > 0 && (
              <div className="mt-1 text-[11px] text-gold/90 font-mono flex items-center gap-1 line-clamp-1">
                <span>💳 {currentProduct.bank_offers[0].description.slice(0, 45)}...</span>
              </div>
            )}
          </div>
        </div>

        {/* Lowest price stat bar */}
        <div className="bg-obsidian/80 rounded-sm p-2.5 border border-surface-border mb-3 text-xs flex justify-between items-center">
          <div>
            <span className="text-champagne-faint block text-[9px] uppercase font-mono tracking-wider">Lowest Recorded</span>
            <span className="text-sage font-mono font-medium">
              {formatPrice(currentProduct.lowest_price, currentProduct.currency)}
            </span>
          </div>

          {currentProduct.target_price && (
            <div className="text-right">
              <span className="text-champagne-faint block text-[9px] uppercase font-mono tracking-wider">Target Alert</span>
              <span className="text-gold font-mono font-medium">
                {formatPrice(currentProduct.target_price, currentProduct.currency)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer controls & info */}
      <div>
        <div className="flex items-center justify-between text-[11px] text-champagne-faint mb-3 pt-2 border-t border-surface-border font-mono">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-champagne-faint" />
            <span>Checked {formatRelativeTime(currentProduct.last_checked_at)}</span>
          </div>
          {currentProduct.check_status === 'error' && (
            <button
              onClick={handleProductRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1 text-terracotta hover:text-gold transition-colors text-[11px] font-mono cursor-pointer disabled:opacity-50"
              title={currentProduct.error_message ? `${currentProduct.error_message} (Click to retry)` : 'Check failed (Click to retry)'}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>{isRefreshing ? 'Retrying...' : 'Retry Check'}</span>
              <RefreshCw className={`w-2.5 h-2.5 ml-0.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {refreshMessage && (
          <div className="text-[10px] text-terracotta mb-2 font-mono truncate" title={refreshMessage}>
            ⚠️ {refreshMessage}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Link
            href={`/product/${currentProduct.id}`}
            className="flex-1 text-center bg-surface-subtle hover:bg-surface-hover border border-surface-border text-champagne text-xs font-medium py-2 px-3 rounded-sm transition-colors"
          >
            History &amp; Predictor
          </Link>
          <button
            onClick={handleProductRefresh}
            disabled={isRefreshing}
            className="p-2 bg-surface hover:bg-surface-subtle border border-surface-border text-champagne hover:text-gold rounded-sm transition-colors cursor-pointer disabled:opacity-50"
            title="Check current price from store"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-gold' : ''}`} />
          </button>
          <a
            href={currentProduct.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 rounded-sm transition-colors"
            title="Open in Store"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
