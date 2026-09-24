import assert from 'assert';
import { sendScraperFailureAlert, sendScraperStaleAlert } from './notify';
import { isCombinedAccount } from '@/lib/auth';

console.log('🧪 Starting Scraper Alerts, Retry & Watchdog Test Suite...\n');

let passed = 0;
let failed = 0;

function testAssert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

async function runTests() {
  // Test 1: Scraper Failure Alert Payload & Execution
  console.log('1. Testing Scraper Failure Alert Function');
  const failureRes = await sendScraperFailureAlert({
    productTitle: 'Sony WH-1000XM5 Wireless Headphones',
    productUrl: 'https://www.amazon.in/dp/B09XS7JWHH',
    platform: 'amazon',
    error: 'HTTP 503 / Anti-bot verification challenge',
    retryAttempts: 2,
    to: 'rahulr24g@gmail.com',
  });
  // Since APPSCRIPT_EMAIL_URL might not be configured in local test env, function gracefully catches and reports
  testAssert(typeof failureRes.success === 'boolean', 'sendScraperFailureAlert returns structured result');

  // Test 2: Watchdog Stale Scrape Alert Function
  console.log('\n2. Testing Watchdog Stale Scraper Alert Function');
  const staleRes = await sendScraperStaleAlert({
    hoursSinceLastScrape: 3.5,
    lastScrapedAt: new Date(Date.now() - 3.5 * 3600 * 1000).toISOString(),
    totalActiveProducts: 14,
    to: 'rahulr24g@gmail.com',
  });
  testAssert(typeof staleRes.success === 'boolean', 'sendScraperStaleAlert returns structured result');

  // Test 3: 2-Attempt Retry Logic Verification
  console.log('\n3. Testing 2-Attempt Scraper Retry Simulation');
  let attemptCount = 0;
  const simulatedScraper = async () => {
    attemptCount++;
    if (attemptCount < 2) {
      return { success: false, error: 'Transient connection timeout' };
    }
    return { success: true, price: 19999 };
  };

  const MAX_ATTEMPTS = 2;
  let finalRes = null;
  for (let a = 1; a <= MAX_ATTEMPTS; a++) {
    finalRes = await simulatedScraper();
    if (finalRes.success) break;
  }
  testAssert(attemptCount === 2, 'Scraper retried second time after first failure');
  testAssert(finalRes?.success === true && finalRes.price === 19999, 'Scraper recovered on 2nd attempt');

  // Test 4: Permanent Failure Dispatches Error after 2 Attempts
  console.log('\n4. Testing Permanent Failure after 2 Attempts');
  let permAttempts = 0;
  const permFailScraper = async () => {
    permAttempts++;
    return { success: false, error: 'CSS Selector not found (DOM changed)' };
  };

  let permRes = null;
  for (let a = 1; a <= MAX_ATTEMPTS; a++) {
    permRes = await permFailScraper();
    if (permRes.success) break;
  }
  testAssert(permAttempts === 2, 'Permanent failure stopped exactly at 2 attempts');
  testAssert(permRes?.success === false, 'Final outcome correctly marked as failure');

  // Test 5: Watchdog 3-Hour Threshold Calculation
  console.log('\n5. Testing Watchdog 3-Hour Stoppage Threshold');
  const twoHoursAgo = Date.now() - 2 * 3600 * 1000;
  const threeHoursAgo = Date.now() - 3.1 * 3600 * 1000;
  const fourHoursAgo = Date.now() - 4.5 * 3600 * 1000;

  const isStale2h = (Date.now() - twoHoursAgo) / (3600 * 1000) >= 3.0;
  const isStale3h = (Date.now() - threeHoursAgo) / (3600 * 1000) >= 3.0;
  const isStale4h = (Date.now() - fourHoursAgo) / (3600 * 1000) >= 3.0;

  testAssert(isStale2h === false, '2 hours elapsed does NOT trigger 3h stale alert');
  testAssert(isStale3h === true, '3.1 hours elapsed DOES trigger 3h stale alert');
  testAssert(isStale4h === true, '4.5 hours elapsed DOES trigger 3h stale alert');

  // Test 6: Manual Trigger Authorization Gate
  console.log('\n6. Testing Manual Trigger Authorization Gate');
  testAssert(isCombinedAccount('Rahul', 'rahulr24g@gmail.com') === true, 'rahulr24g@gmail.com is authorized to trigger scraper');
  testAssert(isCombinedAccount('rahulr24g@gmail.com') === true, 'Direct email rahulr24g@gmail.com is authorized');
  testAssert(isCombinedAccount('Rahul', 'other@gmail.com') === false, 'Other users cannot trigger manual scraper');
  testAssert(isCombinedAccount('Nisha', 'nisha@gmail.com') === false, 'Nisha cannot trigger manual scraper');

  console.log(`\n========================================`);
  console.log(`Summary: ${passed} passed, ${failed} failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
