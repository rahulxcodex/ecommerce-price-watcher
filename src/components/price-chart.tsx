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
  const { data, minPrice, maxPrice, padding } = useMemo(() => {
    if (!history || history.length === 0) {
      return { data: [], minPrice: 0, maxPrice: 0, padding: 50 };
    }
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

  if (!history || history.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-champagne-faint bg-surface border border-surface-border rounded-sm">
        <p className="text-sm font-medium">No price history recorded yet.</p>
        <p className="text-xs text-champagne-faint mt-1 font-mono">Price checks occur automatically every 4 hours.</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-surface p-4 rounded-sm border border-surface-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="font-display text-lg text-champagne">Price Trajectory</h3>
          <p className="text-[11px] text-champagne-faint font-mono">Historical observations</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-0.5 bg-gold" />
            <span className="text-champagne-muted">Recorded Price</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-0.5 bg-sage border-dashed" />
            <span className="text-champagne-muted">All-Time Low</span>
          </div>
        </div>
      </div>

      <div className="h-60 sm:h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 2" stroke="rgba(255, 255, 255, 0.04)" />
            <XAxis
              dataKey="date"
              stroke="#5C564D"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.08)' }}
            />
            <YAxis
              stroke="#5C564D"
              fontSize={10}
              width={50}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.08)' }}
              domain={[Math.max(0, Math.floor(minPrice - padding)), Math.ceil(maxPrice + padding)]}
              tickFormatter={(v) => `₹${v}`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const val = payload[0].value as number;
                  return (
                    <div className="bg-obsidian border border-surface-border p-2.5 rounded-sm shadow-2xl text-xs">
                      <p className="text-champagne-faint mb-1 font-mono text-[10px]">
                        {payload[0].payload.rawDate ? new Date(payload[0].payload.rawDate).toLocaleString('en-IN') : payload[0].payload.date}
                      </p>
                      <p className="font-display text-lg text-gold font-normal">
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
                stroke="#6B8F71"
                strokeDasharray="3 3"
                label={{
                  value: `Low: ₹${lowestPrice}`,
                  fill: '#6B8F71',
                  fontSize: 10,
                  position: 'insideBottomRight',
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="price"
              stroke="#C4A265"
              strokeWidth={2}
              dot={{ r: 2.5, fill: '#C4A265', stroke: '#141516', strokeWidth: 1 }}
              activeDot={{ r: 5, fill: '#E6D5B8' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
