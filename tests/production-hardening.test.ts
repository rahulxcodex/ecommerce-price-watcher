import assert from 'assert';
import { parsePrice } from '../scripts/scrapers/utils';
import { selectBestOffer } from '../scripts/scrapers/resilient-extractor';
import { getAdminEmail, SCRAPER_STALE_THRESHOLD_HOURS } from '../src/lib/constants';
import { getClientIp } from '../src/lib/security';
import { PLATFORM_SCRAPERS, scrapeByPlatform } from '../scripts/scrapers/registry';

console.log('🛡️ Starting Production Hardening & Correctness Test Suite...\n');

// 1. Context-Aware Price Parsing
console.log('1. Testing Context-Aware Price Parsing');

const p1 = parsePrice('₹1,299 Save 83% EMI ₹432/month');
assert.strictEqual(p1, 1299, 'Must extract authoritative price ₹1,299 instead of 83 or 432');

const p2 = parsePrice('Pack of 2 - ₹1,499.00 (Save 20%)');
assert.strictEqual(p2, 1499, 'Must ignore pack number 2 and discount 20% to return 1499');

const p3 = parsePrice('Special Deal: Rs. 24,999 (Flat 50% OFF)');
assert.strictEqual(p3, 24999, 'Must extract Rs. 24,999 and ignore 50%');

const p4 = parsePrice('EMI starts at ₹2,150 / month. Total ₹49,999');
assert.strictEqual(p4, 49999, 'Must prioritize full price over monthly EMI');

const p5 = parsePrice('Save up to 40% on select items');
assert.strictEqual(p5, null, 'Must return null when only discount percentage is present');

console.log('  ✅ [PASS] Context-aware price parsing successfully ignores discount %, pack counts, and EMIs.');

// 2. JSON-LD Best Offer Selection
console.log('\n2. Testing JSON-LD Best Offer Selection');

const multiOffers = [
  { price: 19999, priceCurrency: 'INR', availability: 'https://schema.org/InStock' },
  { price: 17999, priceCurrency: 'INR', availability: 'https://schema.org/InStock' },
  { price: 15999, priceCurrency: 'INR', availability: 'https://schema.org/OutOfStock' }, // Out of stock should be skipped
  { price: 21999, priceCurrency: 'INR', availability: 'https://schema.org/InStock' },
];

const bestOffer = selectBestOffer(multiOffers);
assert.strictEqual(bestOffer.price, 17999, 'Must select lowest in-stock INR offer (17999)');
assert.strictEqual(bestOffer.isOutOfStock, false, 'Selected offer must be marked in stock');

const allOutOfStockOffers = [
  { price: 12000, priceCurrency: 'INR', availability: 'https://schema.org/OutOfStock' },
  { price: 14000, priceCurrency: 'INR', availability: 'https://schema.org/OutOfStock' },
];
const outOffer = selectBestOffer(allOutOfStockOffers);
assert.strictEqual(outOffer.isOutOfStock, true, 'When all offers are out of stock, result must indicate out of stock');

console.log('  ✅ [PASS] JSON-LD selectBestOffer correctly selects lowest in-stock seller offer.');

// 3. Centralized Constants & Admin Email Decoupling
console.log('\n3. Testing Centralized Constants & Admin Email Decoupling');

assert.strictEqual(SCRAPER_STALE_THRESHOLD_HOURS, 5, 'Watchdog threshold must be 5 hours');
const resolvedAdmin = getAdminEmail();
assert.ok(typeof resolvedAdmin === 'string' && resolvedAdmin.includes('@'), 'Admin email must be a valid email string');
console.log(`  ℹ️ Resolved Admin Email: ${resolvedAdmin}`);
console.log('  ✅ [PASS] Centralized constants and dynamic admin resolution verified.');

// 4. IP Normalization & Security
console.log('\n4. Testing Client IP Normalization');

const mockReq1 = { headers: new Headers({ 'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178' }) };
assert.strictEqual(getClientIp(mockReq1), '203.0.113.195', 'Must extract first forwarded IP');

const mockReq2 = { headers: new Headers({ 'x-real-ip': '198.51.100.24' }) };
assert.strictEqual(getClientIp(mockReq2), '198.51.100.24', 'Must fallback to x-real-ip');

const mockReq3 = { headers: new Headers() };
assert.strictEqual(getClientIp(mockReq3), '127.0.0.1', 'Must fallback to localhost default when headers empty');

console.log('  ✅ [PASS] Client IP extraction safely normalizes forwarded and proxy headers.');

// 5. Platform Scraper Registry
console.log('\n5. Testing Platform Scraper Registry');

const platforms = ['amazon', 'flipkart', 'meesho', 'myntra', 'ajio', 'westside'] as const;
for (const p of platforms) {
  assert.ok(typeof PLATFORM_SCRAPERS[p] === 'function', `Registry must have handler for ${p}`);
}

scrapeByPlatform('invalid' as any, 'https://example.com').then((res) => {
  assert.strictEqual(res.success, false, 'Invalid platform must return error');
  assert.strictEqual(res.errorCode, 'INVALID_URL', 'Invalid platform must have errorCode INVALID_URL');
});

console.log('  ✅ [PASS] Platform scraper registry exports all 6 storefront handlers.');

console.log('\n======================================================');
console.log('🎉 Production Hardening Test Suite: ALL ASSERTIONS PASSED!');
console.log('======================================================\n');
