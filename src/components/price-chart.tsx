'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { PriceHistoryItem } from '@/types';
import { formatPrice } from '@/lib/utils';

interface PriceChartProps {
  history: PriceHistoryItem[];
  lowestPrice: number;
}

export function PriceChart({ history, lowestPrice }: PriceChartProps) {
  if (!history || history.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
        <p className="text-sm">No price history available yet.</p>
        <p className="text-xs text-slate-600 mt-1">Price changes will be logged here every 6 hours.</p>
      </div>
    );
  }

  // Memoize chart data transformation to avoid re-computation on unrelated re-renders
  const { data, minPrice, maxPrice, padding } = useMemo(() => {
    const chartData = history.map((item) => {
      const d = new Date(item.recorded_at);
      return {
        date: `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`,
        price: Number(item.price),
        rawDate: item.recorded_at,
      };
    });

    const min = Math.min(...chartData.map((d) => d.price));
    const max = Math.max(...chartData.map((d) => d.price));
    const pad = (max - min) * 0.15 || 50;

    return { data: chartData, minPrice: min, maxPrice: max, padding: pad };
  }, [history]);

  return (
    <div className="w-full bg-slate-900/40 p-4 rounded-xl border border-slate-800">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Price Trend</h3>
          <p className="text-xs text-slate-400">Tracked over time</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-0.5 bg-emerald-400" />
            <span className="text-slate-400">Price</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-0.5 bg-amber-400 border-dashed" />
            <span className="text-slate-400">All-time Low</span>
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              domain={[Math.max(0, Math.floor(minPrice - padding)), Math.ceil(maxPrice + padding)]}
              tickFormatter={(v) => `₹${v}`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const val = payload[0].value as number;
                  return (
                    <div className="bg-slate-900 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs">
                      <p className="text-slate-400 mb-1">{payload[0].payload.rawDate ? new Date(payload[0].payload.rawDate).toLocaleString('en-IN') : payload[0].payload.date}</p>
                      <p className="font-bold text-emerald-400 text-sm">
                        {formatPrice(val)}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            {lowestPrice > 0 && (
              <ReferenceLine
                y={lowestPrice}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{
                  value: `Lowest: ₹${lowestPrice}`,
                  fill: '#f59e0b',
                  fontSize: 10,
                  position: 'insideBottomRight',
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="price"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#10b981', stroke: '#064e3b', strokeWidth: 1 }}
              activeDot={{ r: 6, fill: '#34d399' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
