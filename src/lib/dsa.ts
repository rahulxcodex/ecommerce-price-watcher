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

/**
 * 4. Multi-Objective Optimization: Pareto Frontier Filter
 * Identifies the non-dominated set of products balancing:
 * - Minimizing Price (lower is better)
 * - Maximizing Rating (higher is better)
 * - Maximizing Discount % (higher is better)
 *
 * Product A dominates Product B (A ≻ B) iff:
 * price(A) <= price(B) AND rating(A) >= rating(B) AND discount(A) >= discount(B)
 * with at least one strict inequality.
 */
export interface MultiObjectiveCandidate {
  id: string;
  price: number;
  rating?: number;
  discountPercent?: number;
  [key: string]: any;
}

export function computeParetoFrontier<T extends MultiObjectiveCandidate>(candidates: T[]): {
  frontier: T[];
  dominated: T[];
  paretoIndices: Set<string>;
} {
  if (!candidates || candidates.length === 0) {
    return { frontier: [], dominated: [], paretoIndices: new Set() };
  }

  const n = candidates.length;
  const dominatedIndices = new Set<number>();

  for (let i = 0; i < n; i++) {
    const a = candidates[i];
    const aPrice = a.price;
    const aRating = a.rating ?? 3.5;
    const aDiscount = a.discountPercent ?? 0;

    for (let j = 0; j < n; j++) {
      if (i === j || dominatedIndices.has(j)) continue;
      const b = candidates[j];
      const bPrice = b.price;
      const bRating = b.rating ?? 3.5;
      const bDiscount = b.discountPercent ?? 0;

      // Check if A strictly dominates B
      const noWorse = aPrice <= bPrice && aRating >= bRating && aDiscount >= bDiscount;
      const strictlyBetter = aPrice < bPrice || aRating > bRating || aDiscount > bDiscount;

      if (noWorse && strictlyBetter) {
        dominatedIndices.add(j);
      }
    }
  }

  const frontier: T[] = [];
  const dominated: T[] = [];
  const paretoIndices = new Set<string>();

  for (let i = 0; i < n; i++) {
    if (dominatedIndices.has(i)) {
      dominated.push(candidates[i]);
    } else {
      frontier.push(candidates[i]);
      paretoIndices.add(candidates[i].id);
    }
  }

  return { frontier, dominated, paretoIndices };
}

/**
 * 5. Information Theory: Shannon Entropy for Facet Ranking
 * Computes Shannon entropy H(X) = -Σ (p_i * log2(p_i)) for attribute distributions.
 * Attributes with higher entropy provide balanced partitions and maximize Information Gain
 * for user smart filtering.
 */
export function calculateShannonEntropy(frequencies: Record<string, number>, total: number): number {
  if (total <= 0) return 0;
  let entropy = 0;
  for (const count of Object.values(frequencies)) {
    if (count > 0) {
      const p = count / total;
      entropy -= p * Math.log2(p);
    }
  }
  return Number(entropy.toFixed(3));
}

export interface SmartFacetRanking {
  facetName: string;
  entropy: number;
  distinctValues: number;
  efficiencyScore: number;
}

export function rankFilterFacets(products: Array<{ brand?: string; price: number; rating?: number; discountPercent?: number }>): SmartFacetRanking[] {
  const total = products.length;
  if (total <= 1) return [];

  // 1. Brand distribution
  const brandCounts: Record<string, number> = {};
  // 2. Price tier distribution (quartiles)
  const prices = products.map((p) => p.price).sort((a, b) => a - b);
  const q1 = prices[Math.floor(total * 0.25)] || 0;
  const q2 = prices[Math.floor(total * 0.50)] || 0;
  const q3 = prices[Math.floor(total * 0.75)] || 0;
  const priceTierCounts: Record<string, number> = { budget: 0, mid: 0, high: 0, premium: 0 };
  // 3. Discount bracket distribution
  const discountCounts: Record<string, number> = { '0-10%': 0, '10-30%': 0, '30-50%': 0, '50%+': 0 };

  for (const p of products) {
    if (p.brand) {
      brandCounts[p.brand] = (brandCounts[p.brand] || 0) + 1;
    }
    if (p.price <= q1) priceTierCounts.budget++;
    else if (p.price <= q2) priceTierCounts.mid++;
    else if (p.price <= q3) priceTierCounts.high++;
    else priceTierCounts.premium++;

    const disc = p.discountPercent ?? 0;
    if (disc < 10) discountCounts['0-10%']++;
    else if (disc < 30) discountCounts['10-30%']++;
    else if (disc < 50) discountCounts['30-50%']++;
    else discountCounts['50%+']++;
  }

  const brandEntropy = calculateShannonEntropy(brandCounts, total);
  const priceEntropy = calculateShannonEntropy(priceTierCounts, total);
  const discountEntropy = calculateShannonEntropy(discountCounts, total);

  const rankings: SmartFacetRanking[] = [
    {
      facetName: 'brand',
      entropy: brandEntropy,
      distinctValues: Object.keys(brandCounts).length,
      efficiencyScore: Number((brandEntropy * Math.min(1, Object.keys(brandCounts).length / 2)).toFixed(2)),
    },
    {
      facetName: 'priceRange',
      entropy: priceEntropy,
      distinctValues: 4,
      efficiencyScore: Number((priceEntropy * 1.2).toFixed(2)),
    },
    {
      facetName: 'discount',
      entropy: discountEntropy,
      distinctValues: 4,
      efficiencyScore: Number((discountEntropy * 1.0).toFixed(2)),
    },
  ];

  return rankings.sort((a, b) => b.efficiencyScore - a.efficiencyScore);
}

/**
 * 6. Optimal Stopping Theory & Bayesian Price Scoring (Secretary Problem / 37% Rule)
 * Determines whether current price is statistically optimal to purchase now vs. wait.
 * Based on 1/e stopping threshold and empirical price return volatility.
 */
export interface OptimalStoppingDecision {
  shouldBuyNow: boolean;
  stoppingScore: number; // 0 to 100
  logVolatility: number;
  probCheaperSoon: number; // P(price drops further within next window)
  calibrationWindow: number;
}

export function computeOptimalStopping(prices: number[]): OptimalStoppingDecision {
  if (!prices || prices.length < 3) {
    return {
      shouldBuyNow: true,
      stoppingScore: 70,
      logVolatility: 0,
      probCheaperSoon: 0.35,
      calibrationWindow: 1,
    };
  }

  const n = prices.length;
  // 1/e ≈ 0.368 calibration threshold (classic Secretary Problem)
  const calibrationSize = Math.max(1, Math.floor(n * 0.368));
  const calibrationSample = prices.slice(0, calibrationSize);
  const calibrationMin = Math.min(...calibrationSample);

  const currentPrice = prices[n - 1];
  const postCalibrationPrices = prices.slice(calibrationSize);
  const postMin = Math.min(...postCalibrationPrices);

  // Compute log-return volatility: σ = sqrt( 1/(n-1) * Σ (ln(p_t / p_{t-1}) - μ)^2 )
  const logReturns: number[] = [];
  for (let i = 1; i < n; i++) {
    if (prices[i] > 0 && prices[i - 1] > 0) {
      logReturns.push(Math.log(prices[i] / prices[i - 1]));
    }
  }

  let meanReturn = 0;
  if (logReturns.length > 0) {
    meanReturn = logReturns.reduce((acc, v) => acc + v, 0) / logReturns.length;
  }

  let variance = 0;
  if (logReturns.length > 1) {
    variance = logReturns.reduce((acc, v) => acc + Math.pow(v - meanReturn, 2), 0) / (logReturns.length - 1);
  }
  const logVolatility = Math.sqrt(variance);

  // Stopping rule: If current price beats the best seen in the calibration window
  const beatsCalibration = currentPrice <= calibrationMin;
  const isGlobalMin = currentPrice <= postMin;

  // Probability of lower price soon: higher volatility + positive recent slope = higher probability of drop
  const probCheaper = Math.min(0.85, Math.max(0.10, 0.5 + meanReturn * 2 + logVolatility * 0.5));

  let stoppingScore = 50;
  if (beatsCalibration && isGlobalMin) {
    stoppingScore = 95;
  } else if (beatsCalibration) {
    stoppingScore = 80;
  } else if (currentPrice > calibrationMin * 1.15) {
    stoppingScore = 25;
  }

  return {
    shouldBuyNow: stoppingScore >= 75,
    stoppingScore,
    logVolatility: Number(logVolatility.toFixed(4)),
    probCheaperSoon: Number(probCheaper.toFixed(2)),
    calibrationWindow: calibrationSize,
  };
}
