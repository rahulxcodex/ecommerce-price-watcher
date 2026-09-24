import { sanitizeSearchQuery } from '../scripts/scrapers/search/search-utils';
import { checkSearchRateLimit } from '../src/lib/security';
import {
  computeParetoFrontier,
  calculateShannonEntropy,
  rankFilterFacets,
  computeOptimalStopping,
} from '../src/lib/dsa';

function runDiscoveryAndFilterTests() {
  console.log('🧪 Testing Discovery, Smart Filtering & Mathematical Models...\n');

  // Test 1: Query sanitization
  const dirtyQuery = '<script>alert("hack")</script> Wireless [Earbuds] {Pro} \\/ ';
  const cleaned = sanitizeSearchQuery(dirtyQuery);
  if (cleaned.includes('<') || cleaned.includes('>') || cleaned.includes('[') || cleaned.includes('{')) {
    throw new Error(`Sanitization failed to strip dangerous characters: ${cleaned}`);
  }
  if (!cleaned.includes('Wireless Earbuds Pro')) {
    throw new Error(`Sanitization did not preserve clean search terms: ${cleaned}`);
  }
  console.log('  ✅ [PASS] Search query sanitization verified');

  // Test 2: Rate limiting (5 req/min)
  const testUser = 'test_rate_limit_user_' + Date.now();
  for (let i = 0; i < 5; i++) {
    const res = checkSearchRateLimit(testUser, 5, 60_000);
    if (!res.allowed) {
      throw new Error(`Request ${i + 1} was prematurely blocked by rate limiter`);
    }
  }
  const blockedRes = checkSearchRateLimit(testUser, 5, 60_000);
  if (blockedRes.allowed) {
    throw new Error('6th request in window was not blocked by rate limiter');
  }
  if (blockedRes.retryAfterSeconds <= 0) {
    throw new Error('Rate limiter did not return valid retryAfterSeconds');
  }
  console.log('  ✅ [PASS] Sliding window rate limiter (5 req/min) verified');

  // Test 3: Pareto Frontier optimization (Multi-objective)
  const products = [
    { id: '1', price: 1000, rating: 4.5, discountPercent: 30 }, // Non-dominated (Great rating)
    { id: '2', price: 800, rating: 4.0, discountPercent: 20 },  // Non-dominated (Lower price)
    { id: '3', price: 1200, rating: 3.5, discountPercent: 10 }, // Strictly dominated by both 1 & 2
    { id: '4', price: 700, rating: 4.8, discountPercent: 50 },  // Strictly dominates all
  ];

  const pareto = computeParetoFrontier(products);
  if (!pareto.paretoIndices.has('4')) {
    throw new Error('Pareto optimal product was excluded from frontier');
  }
  if (pareto.paretoIndices.has('3')) {
    throw new Error('Dominated product 3 was falsely included in Pareto frontier');
  }
  console.log('  ✅ [PASS] Pareto Frontier multi-objective filter verified');

  // Test 4: Shannon Entropy and Facet Ranking
  const entropyUniform = calculateShannonEntropy({ a: 10, b: 10, c: 10, d: 10 }, 40);
  const entropySkewed = calculateShannonEntropy({ a: 37, b: 1, c: 1, d: 1 }, 40);
  if (entropyUniform <= entropySkewed) {
    throw new Error('Uniform distribution should have higher Shannon entropy than skewed distribution');
  }

  const sampleProducts = [
    { brand: 'Sony', price: 2000, rating: 4.5, discountPercent: 20 },
    { brand: 'Bose', price: 5000, rating: 4.8, discountPercent: 10 },
    { brand: 'JBL', price: 1500, rating: 4.1, discountPercent: 40 },
    { brand: 'Boat', price: 800, rating: 3.9, discountPercent: 60 },
  ];
  const rankings = rankFilterFacets(sampleProducts);
  if (!Array.isArray(rankings) || rankings.length === 0) {
    throw new Error('Facet rankings array is empty');
  }
  console.log('  ✅ [PASS] Information theory: Shannon entropy facet ranking verified');

  // Test 5: Optimal Stopping (Secretary Problem / 37% rule)
  // Simulate price history: high initial calibration, then significant drop
  const pricesHistory = [1500, 1450, 1480, 1520, 1400, 1380, 1100]; // 1100 is below calibration min
  const stopping = computeOptimalStopping(pricesHistory);
  if (stopping.stoppingScore < 70) {
    throw new Error(`Stopping score too low for price breakthrough: ${stopping.stoppingScore}`);
  }
  if (stopping.calibrationWindow <= 0) {
    throw new Error('Invalid calibration window size');
  }
  if (typeof stopping.logVolatility !== 'number' || isNaN(stopping.logVolatility)) {
    throw new Error('Invalid log-normal volatility output');
  }
  console.log('  ✅ [PASS] Optimal stopping & log-volatility price scoring verified');

  console.log('\n🎉 All Discovery, Smart Filtering & Math tests PASSED successfully!\n');
}

runDiscoveryAndFilterTests();
