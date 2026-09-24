/**
 * Data Structures & Decision Science Algorithms (DSA)
 * Provides optimal O(N) streaming algorithms and predictive models for price tracking.
 */

export interface PricePoint {
  price: number;
  timestamp: string | number | Date;
}

export interface TrendAnalysis {
  slope: number;
  direction: 'falling' | 'rising' | 'stable';
  recommendation: 'STRONG_BUY' | 'BUY' | 'WAIT' | 'FAIR';
  confidence: number;
  percentChange: number;
  rollingLow7d?: number;
  rollingLow30d?: number;
  allTimeLow: number;
  allTimeHigh: number;
}

/**
 * 1. Monotonic Deque Sliding Window Minimum
 * Computes sliding window minimums in optimal O(N) time and O(K) space.
 * 
 * @param prices Array of price numbers
 * @param windowSize Size of sliding window K
 * @returns Array of minimum price for each window
 */
export function slidingWindowMinimum(prices: number[], windowSize: number): number[] {
  if (prices.length === 0 || windowSize <= 0) return [];
  const k = Math.min(windowSize, prices.length);
  const result: number[] = [];
  const deque: number[] = []; // Stores indices, strictly monotonic ascending values

  for (let i = 0; i < prices.length; i++) {
    // Evict indices that have fallen out of the current sliding window
    if (deque.length > 0 && deque[0] <= i - k) {
      deque.shift();
    }

    // Maintain monotonicity: remove elements larger than or equal to current price
    while (deque.length > 0 && prices[deque[deque.length - 1]] >= prices[i]) {
      deque.pop();
    }

    deque.push(i);

    // Record window minimum once window is populated
    if (i >= k - 1) {
      result.push(prices[deque[0]]);
    }
  }

  return result;
}

/**
 * 2. Decision Science: Ordinary Least Squares (OLS) Linear Regression
 * Calculates price slope and directional trend from price history.
 *
 * Formula:
 * slope = (N * Σ(x*y) - Σx * Σy) / (N * Σ(x^2) - (Σx)^2)
 */
export function analyzePriceTrend(history: PricePoint[]): TrendAnalysis {
  if (!history || history.length === 0) {
    return {
      slope: 0,
      direction: 'stable',
      recommendation: 'FAIR',
      confidence: 0,
      percentChange: 0,
      allTimeLow: 0,
      allTimeHigh: 0,
    };
  }

  const prices = history.map((h) => Number(h.price)).filter((p) => !isNaN(p) && p > 0);
  if (prices.length === 0) {
    return {
      slope: 0,
      direction: 'stable',
      recommendation: 'FAIR',
      confidence: 0,
      percentChange: 0,
      allTimeLow: 0,
      allTimeHigh: 0,
    };
  }

  const allTimeLow = Math.min(...prices);
  const allTimeHigh = Math.max(...prices);
  const currentPrice = prices[prices.length - 1];

  if (prices.length === 1) {
    return {
      slope: 0,
      direction: 'stable',
      recommendation: 'FAIR',
      confidence: 50,
      percentChange: 0,
      allTimeLow,
      allTimeHigh,
    };
  }

  // Linear Regression over indexed data points
  const n = prices.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = prices[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;

  const firstPrice = prices[0];
  const percentChange = firstPrice > 0 ? ((currentPrice - firstPrice) / firstPrice) * 100 : 0;

  // Normalized slope relative to current price level
  const normalizedSlope = currentPrice > 0 ? (slope / currentPrice) * 100 : 0;

  let direction: 'falling' | 'rising' | 'stable' = 'stable';
  if (normalizedSlope < -0.5) {
    direction = 'falling';
  } else if (normalizedSlope > 0.5) {
    direction = 'rising';
  }

  // Decision recommendation based on current price position vs all-time low & trend
  let recommendation: 'STRONG_BUY' | 'BUY' | 'WAIT' | 'FAIR' = 'FAIR';
  const nearLowThreshold = allTimeLow * 1.03; // Within 3% of all-time low

  if (currentPrice <= nearLowThreshold) {
    recommendation = 'STRONG_BUY';
  } else if (direction === 'falling') {
    recommendation = 'WAIT'; // Price is dropping, might drop further
  } else if (currentPrice < (allTimeLow + allTimeHigh) / 2) {
    recommendation = 'BUY'; // In the lower half of historical distribution
  } else {
    recommendation = 'WAIT';
  }

  // Rolling window stats via sliding window minimum
  const window7 = Math.min(7, prices.length);
  const lows7 = slidingWindowMinimum(prices, window7);
  const rollingLow7d = lows7.length > 0 ? lows7[lows7.length - 1] : allTimeLow;

  const window30 = Math.min(30, prices.length);
  const lows30 = slidingWindowMinimum(prices, window30);
  const rollingLow30d = lows30.length > 0 ? lows30[lows30.length - 1] : allTimeLow;

  // Confidence score based on sample size
  const confidence = Math.min(95, Math.max(30, Math.round(Math.log2(n + 1) * 20)));

  return {
    slope: Number(slope.toFixed(2)),
    direction,
    recommendation,
    confidence,
    percentChange: Number(percentChange.toFixed(1)),
    rollingLow7d,
    rollingLow30d,
    allTimeLow,
    allTimeHigh,
  };
}

/**
 * 3. Truncated Exponential Backoff with Decorrelated Jitter
 * Standard AWS Full Jitter algorithm:
 * sleep = rand(0, min(maxDelay, baseDelay * 2^attempt))
 */
export async function sleepWithJitter(
  attempt: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 15000
): Promise<number> {
  const exponential = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
  const jittered = Math.floor(Math.random() * exponential);
  await new Promise((resolve) => setTimeout(resolve, jittered));
  return jittered;
}
