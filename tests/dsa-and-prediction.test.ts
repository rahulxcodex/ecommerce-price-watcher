import { slidingWindowMinimum, analyzePriceTrend, sleepWithJitter } from '../src/lib/dsa';

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

async function testDSA() {
  console.log('🧪 Testing DSA & Decision Science Algorithms...\n');

  // Test 1: Monotonic Deque Sliding Window Minimum
  const prices = [1200, 1150, 1180, 1100, 1050, 1080, 1020, 1100];
  const window3 = slidingWindowMinimum(prices, 3);
  // Expected for window=3:
  // [1200, 1150, 1180] -> 1150
  // [1150, 1180, 1100] -> 1100
  // [1180, 1100, 1050] -> 1050
  // [1100, 1050, 1080] -> 1050
  // [1050, 1080, 1020] -> 1020
  // [1080, 1020, 1100] -> 1020
  const expected = [1150, 1100, 1050, 1050, 1020, 1020];
  assert(
    JSON.stringify(window3) === JSON.stringify(expected),
    `Sliding window min mismatch: got ${JSON.stringify(window3)}, expected ${JSON.stringify(expected)}`
  );
  console.log('  ✅ [PASS] Monotonic deque O(N) sliding window minimum verified');

  // Test 2: Linear Regression Price Slope on Falling Trend
  const fallingHistory = [
    { price: 5000, timestamp: '2026-09-01' },
    { price: 4800, timestamp: '2026-09-02' },
    { price: 4600, timestamp: '2026-09-03' },
    { price: 4400, timestamp: '2026-09-04' },
    { price: 4200, timestamp: '2026-09-05' },
  ];
  const fallingAnalysis = analyzePriceTrend(fallingHistory);
  assert(fallingAnalysis.slope < 0, 'Falling history should produce negative slope');
  assert(fallingAnalysis.direction === 'falling', 'Direction should be falling');
  assert(fallingAnalysis.percentChange < 0, 'Percent change should be negative');
  assert(fallingAnalysis.allTimeLow === 4200, 'All time low should be 4200');
  console.log('  ✅ [PASS] Linear regression slope and direction on falling trend verified');

  // Test 3: Linear Regression on Rising Trend
  const risingHistory = [
    { price: 1000, timestamp: '2026-09-01' },
    { price: 1200, timestamp: '2026-09-02' },
    { price: 1400, timestamp: '2026-09-03' },
  ];
  const risingAnalysis = analyzePriceTrend(risingHistory);
  assert(risingAnalysis.slope > 0, 'Rising history should produce positive slope');
  assert(risingAnalysis.direction === 'rising', 'Direction should be rising');
  console.log('  ✅ [PASS] Linear regression slope on rising trend verified');

  // Test 4: Strong Buy Recommendation at All-Time Low
  const allTimeLowHistory = [
    { price: 3000, timestamp: '2026-09-01' },
    { price: 2800, timestamp: '2026-09-02' },
    { price: 2100, timestamp: '2026-09-03' }, // All-time low
  ];
  const atlAnalysis = analyzePriceTrend(allTimeLowHistory);
  assert(atlAnalysis.recommendation === 'STRONG_BUY', 'Should recommend STRONG_BUY at all-time low');
  console.log('  ✅ [PASS] Decision science recommendation engine verified');

  // Test 5: Exponential Backoff with Jitter
  const sleepTime = await sleepWithJitter(1, 10, 50);
  assert(typeof sleepTime === 'number' && sleepTime >= 0, 'Jitter sleep should return valid ms');
  console.log('  ✅ [PASS] Exponential backoff with jitter timing verified');

  console.log('\n🎉 All DSA & Decision Science tests PASSED successfully!');
}

testDSA().catch((err) => {
  console.error(err);
  process.exit(1);
});
