'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity,
  ShieldCheck,
  AlertTriangle,
  Clock,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Zap,
  Server,
  Layers,
} from 'lucide-react';
import { PlatformBadge } from '@/components/platform-badge';
import { Platform } from '@/types';

interface HealthData {
  metrics: {
    totalRuns: number;
    activeProductCount: number;
    globalSuccessRate: number;
    avgDurationSeconds: number;
    lastRun: {
      started_at: string;
      finished_at: string | null;
      status: string;
      trigger: string;
      total_products: number;
      success_count: number;
      error_count: number;
      duration_ms: number;
    } | null;
  };
  platformStats: Record<
    string,
    { total: number; success: number; errors: number; errorRate: number }
  >;
  recentErrors: Array<{ platform: string; error: string; created_at: string }>;
  recentRuns: Array<{
    id: string;
    started_at: string;
    status: string;
    trigger: string;
    total_products: number;
    success_count: number;
    error_count: number;
    duration_ms: number;
  }>;
}

export default function ScraperHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/scraper/health');
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Authentication required to view system health.');
        }
        throw new Error('Failed to load health telemetry.');
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Failed to fetch telemetry');
      setData(json);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchHealth();
  };

  return (
    <div className="max-w-6xl mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-xs font-mono text-champagne-faint hover:text-champagne transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Watchlist</span>
            </Link>
            <span className="text-champagne-faint text-xs">•</span>
            <span className="text-gold text-xs font-mono">System Observability</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl text-champagne flex items-center gap-2">
            <Activity className="w-6 h-6 text-gold" />
            <span>Scraper Health & Telemetry</span>
          </h1>
          <p className="text-xs text-champagne-faint mt-1">
            Real-time pipeline metrics, storefront circuit status, and execution analytics.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-surface hover:bg-surface-hover border border-surface-border text-xs font-mono text-champagne transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-gold ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-sm bg-terracotta/10 border border-terracotta/30 text-terracotta text-xs font-mono flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-champagne-faint font-mono">
          <RefreshCw className="w-6 h-6 animate-spin text-gold" />
          <p className="text-xs">Aggregating telemetry logs...</p>
        </div>
      ) : data ? (
        <>
          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-4 rounded-sm bg-surface border border-surface-border space-y-1">
              <div className="flex items-center justify-between text-champagne-faint text-xs font-mono">
                <span>Success Rate</span>
                <ShieldCheck className="w-4 h-4 text-sage" />
              </div>
              <p
                className={`text-2xl font-display ${
                  data.metrics.globalSuccessRate >= 90
                    ? 'text-sage'
                    : data.metrics.globalSuccessRate >= 75
                    ? 'text-gold'
                    : 'text-terracotta'
                }`}
              >
                {data.metrics.globalSuccessRate}%
              </p>
              <p className="text-[10px] text-champagne-faint font-mono">Across recorded scrape cycles</p>
            </div>

            <div className="p-4 rounded-sm bg-surface border border-surface-border space-y-1">
              <div className="flex items-center justify-between text-champagne-faint text-xs font-mono">
                <span>Avg Scrape Time</span>
                <Clock className="w-4 h-4 text-gold" />
              </div>
              <p className="text-2xl font-display text-champagne">
                {data.metrics.avgDurationSeconds > 0 ? `${data.metrics.avgDurationSeconds}s` : 'N/A'}
              </p>
              <p className="text-[10px] text-champagne-faint font-mono">Per scheduled batch cycle</p>
            </div>

            <div className="p-4 rounded-sm bg-surface border border-surface-border space-y-1">
              <div className="flex items-center justify-between text-champagne-faint text-xs font-mono">
                <span>Active Tracked</span>
                <Server className="w-4 h-4 text-champagne" />
              </div>
              <p className="text-2xl font-display text-gold">{data.metrics.activeProductCount}</p>
              <p className="text-[10px] text-champagne-faint font-mono">Products in active rotation</p>
            </div>

            <div className="p-4 rounded-sm bg-surface border border-surface-border space-y-1">
              <div className="flex items-center justify-between text-champagne-faint text-xs font-mono">
                <span>Total Cycles</span>
                <Layers className="w-4 h-4 text-gold" />
              </div>
              <p className="text-2xl font-display text-champagne">{data.metrics.totalRuns}</p>
              <p className="text-[10px] text-champagne-faint font-mono">Telemetry runs on record</p>
            </div>
          </div>

          {/* Storefront Platform Breakdown */}
          <div className="p-4 sm:p-5 rounded-sm bg-surface border border-surface-border space-y-3">
            <h2 className="font-display text-base text-champagne flex items-center gap-2">
              <Server className="w-4 h-4 text-gold" />
              <span>Storefront Error Rates & Platform Breakdown</span>
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {(
                ['amazon', 'flipkart', 'meesho', 'myntra', 'ajio', 'westside'] as Platform[]
              ).map((plat) => {
                const stats = data.platformStats[plat] || {
                  total: 0,
                  success: 0,
                  errors: 0,
                  errorRate: 0,
                };
                const isHealthy = stats.errorRate < 15;
                const isWarning = stats.errorRate >= 15 && stats.errorRate < 40;

                return (
                  <div
                    key={plat}
                    className="p-3 rounded-sm bg-obsidian border border-surface-border space-y-1.5 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <PlatformBadge platform={plat} />
                      <span
                        className={`w-2 h-2 rounded-full ${
                          stats.total === 0
                            ? 'bg-champagne-faint'
                            : isHealthy
                            ? 'bg-sage'
                            : isWarning
                            ? 'bg-gold'
                            : 'bg-terracotta'
                        }`}
                      />
                    </div>

                    <div className="pt-1">
                      <div className="flex items-baseline justify-between text-xs font-mono">
                        <span className="text-champagne-faint">Errors:</span>
                        <span className={stats.errors > 0 ? 'text-terracotta font-bold' : 'text-sage'}>
                          {stats.errors}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between text-xs font-mono">
                        <span className="text-champagne-faint">Checks:</span>
                        <span className="text-champagne">{stats.total}</span>
                      </div>
                      <div className="flex items-baseline justify-between text-xs font-mono border-t border-surface-border mt-1 pt-1">
                        <span className="text-champagne-faint">Error %:</span>
                        <span
                          className={
                            isHealthy
                              ? 'text-sage'
                              : isWarning
                              ? 'text-gold'
                              : 'text-terracotta font-bold'
                          }
                        >
                          {stats.errorRate}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Scrape Execution Cycles */}
          <div className="p-4 sm:p-5 rounded-sm bg-surface border border-surface-border space-y-3">
            <h2 className="font-display text-base text-champagne flex items-center gap-2">
              <Zap className="w-4 h-4 text-gold" />
              <span>Recent Scraper Runs</span>
            </h2>

            {data.recentRuns.length === 0 ? (
              <p className="text-xs font-mono text-champagne-faint py-4 text-center">
                No scrape runs recorded yet. Telemetry populates automatically on scheduled cycles.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-surface-border text-champagne-faint">
                      <th className="pb-2 font-medium">Started At</th>
                      <th className="pb-2 font-medium">Trigger</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium text-right">Items Checked</th>
                      <th className="pb-2 font-medium text-right">Success</th>
                      <th className="pb-2 font-medium text-right">Errors</th>
                      <th className="pb-2 font-medium text-right">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {data.recentRuns.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-subtle transition-colors">
                        <td className="py-2.5 text-champagne">
                          {new Date(r.started_at).toLocaleString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5">
                          <span className="px-1.5 py-0.5 rounded-sm bg-surface-subtle border border-surface-border text-[10px] uppercase text-gold">
                            {r.trigger || 'cron'}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] ${
                              r.status === 'completed'
                                ? 'text-sage'
                                : r.status === 'running'
                                ? 'text-gold'
                                : 'text-terracotta'
                            }`}
                          >
                            {r.status === 'completed' ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                            <span className="capitalize">{r.status}</span>
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-champagne">{r.total_products}</td>
                        <td className="py-2.5 text-right text-sage">{r.success_count}</td>
                        <td className="py-2.5 text-right text-terracotta">
                          {r.error_count > 0 ? r.error_count : 0}
                        </td>
                        <td className="py-2.5 text-right text-champagne-faint">
                          {r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Incident Log */}
          {data.recentErrors.length > 0 && (
            <div className="p-4 sm:p-5 rounded-sm bg-surface border border-surface-border space-y-3">
              <h2 className="font-display text-base text-champagne flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-terracotta" />
                <span>Recent Error Telemetry</span>
              </h2>

              <div className="space-y-1.5 font-mono text-xs">
                {data.recentErrors.map((err, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-sm bg-obsidian border border-surface-border flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-2">
                      <PlatformBadge platform={err.platform as Platform} />
                      <span className="text-terracotta text-[11px] break-all">{err.error}</span>
                    </div>
                    <span className="text-[10px] text-champagne-faint flex-shrink-0">
                      {new Date(err.created_at).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
