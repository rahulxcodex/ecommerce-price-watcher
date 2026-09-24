'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ExternalLink, TrendingDown, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Product } from '@/types';
import { PlatformBadge } from './platform-badge';
import { formatPrice, formatRelativeTime, calculateDiscount } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  // Bug 15 fix: Only show all-time low if price has actually dropped from a previous higher price
  const isAllTimeLow =
    product.current_price <= product.lowest_price &&
    product.lowest_price > 0 &&
    product.highest_price > product.current_price;

  const isOutOfStock = product.check_status === 'out_of_stock';
  const discount = calculateDiscount(product.current_price, product.highest_price);

  return (
    <div className="group relative bg-slate-900/60 border border-slate-800 hover:border-slate-700 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-200 rounded-2xl p-4 flex flex-col justify-between">
      <div>
        {/* Header with platform & status badges */}
        <div className="flex items-center justify-between gap-1.5 mb-3 flex-wrap">
          <PlatformBadge platform={product.platform} />

          {isOutOfStock ? (
            <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-400 border border-red-500/20 text-[11px] font-bold px-2 py-0.5 rounded-full">
              Out of Stock
            </span>
          ) : isAllTimeLow ? (
            <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold px-2 py-0.5 rounded-full animate-pulse">
              🔥 ALL-TIME LOW
            </span>
          ) : discount > 0 ? (
            <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold px-2 py-0.5 rounded-full">
              <TrendingDown className="w-3 h-3" />
              {discount}% OFF
            </span>
          ) : null}
        </div>

        {/* Product image & title */}
        <div className="flex gap-3 mb-3">
          <div className="relative w-20 h-20 rounded-xl bg-slate-800 flex-shrink-0 overflow-hidden flex items-center justify-center border border-slate-700/50">
            {product.image_url ? (
              <Image
                src={product.image_url}
                alt={product.title}
                fill
                sizes="80px"
                className="object-contain p-1 group-hover:scale-105 transition-transform"
                loading="lazy"
                unoptimized
              />
            ) : (
              <span className="text-slate-600 text-xs font-medium">No Image</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <Link
              href={`/product/${product.id}`}
              className="font-semibold text-sm text-slate-100 hover:text-emerald-400 line-clamp-2 transition-colors"
              title={product.title}
            >
              {product.title}
            </Link>

            <div className="mt-2 flex items-baseline gap-2 flex-wrap">
              <span className="text-xl font-extrabold text-slate-100 tracking-tight">
                {formatPrice(product.current_price, product.currency)}
              </span>
              {product.highest_price > product.current_price && (
                <span className="text-xs text-slate-500 line-through">
                  {formatPrice(product.highest_price, product.currency)}
                </span>
              )}
              {product.selected_size && (
                <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 font-medium">
                  Size: {product.selected_size}
                </span>
              )}
            </div>

            {product.bank_offers && product.bank_offers.length > 0 && (
              <div className="mt-1 text-[11px] text-amber-400/90 font-medium flex items-center gap-1">
                <span>💳 {product.bank_offers[0].description.slice(0, 45)}...</span>
              </div>
            )}
          </div>
        </div>

        {/* Lowest price stat bar */}
        <div className="bg-slate-950/50 rounded-xl p-2.5 border border-slate-800/80 mb-3 text-xs flex justify-between items-center">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Lowest Recorded</span>
            <span className="text-emerald-400 font-bold">
              {formatPrice(product.lowest_price, product.currency)}
            </span>
          </div>

          {product.target_price && (
            <div className="text-right">
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">Target Alert</span>
              <span className="text-cyan-400 font-bold">
                {formatPrice(product.target_price, product.currency)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer controls & info */}
      <div>
        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-3 pt-2 border-t border-slate-800/60">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>Checked {formatRelativeTime(product.last_checked_at)}</span>
          </div>
          {product.check_status === 'error' && (
            <span className="flex items-center gap-1 text-red-400" title={product.error_message || 'Check failed'}>
              <AlertTriangle className="w-3 h-3" />
              Check Error
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/product/${product.id}`}
            className="flex-1 text-center bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
          >
            History & Alert
          </Link>
          <a
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg transition-colors"
            title="Buy on Store"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
