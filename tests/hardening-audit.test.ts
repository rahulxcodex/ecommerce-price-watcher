import { deriveTitleFromUrl } from '../src/lib/security';
import { resolveUserRole, isCombinedAccount } from '../src/lib/auth';
import { checkSigninRateLimit, resetSigninRateLimit, checkMemoryRateLimit } from '../src/lib/rate-limit';
import { isServerlessProduction } from '../src/lib/auth-db';
import { parsePrice } from '../scripts/scrapers/utils';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runHardeningTests() {
  console.log('🛡️ Starting Comprehensive Hardening & Security Audit Test Suite...\n');
  let passed = 0;

  // Test 1: deriveTitleFromUrl Resilience Across All 6 Supported Platforms
  console.log('1. Testing deriveTitleFromUrl Resilience Across Storefronts');
  {
    // Amazon with query params
    const tAmazon = deriveTitleFromUrl(
      'https://www.amazon.in/Apple-iPhone-15-128-GB/dp/B0CHX1W1XY?tag=affiliate-21&ref_=nav_signin',
      'amazon'
    );
    assert(tAmazon.toLowerCase().includes('apple iphone 15'), `Amazon title derived: "${tAmazon}"`);

    // Amazon gp/product format
    const tAmazonGp = deriveTitleFromUrl(
      'https://www.amazon.in/Sony-WH-1000XM5-Wireless-Noise-Cancelling/gp/product/B09XS7JWHH/',
      'amazon'
    );
    assert(tAmazonGp.toLowerCase().includes('sony wh 1000xm5'), `Amazon GP title derived: "${tAmazonGp}"`);

    // Flipkart with complex path
    const tFlipkart = deriveTitleFromUrl(
      'https://www.flipkart.com/apple-iphone-15-black-128-gb/p/itm6ac6485515ae4?pid=MOBGTAGPTB3VS24W',
      'flipkart'
    );
    assert(tFlipkart.toLowerCase().includes('apple iphone 15'), `Flipkart title derived: "${tFlipkart}"`);

    // Meesho with product slug
    const tMeesho = deriveTitleFromUrl(
      'https://www.meesho.com/classic-unique-men-tshirts/p/1abcde?utm_source=share',
      'meesho'
    );
    assert(tMeesho.toLowerCase().includes('classic unique men tshirts'), `Meesho title derived: "${tMeesho}"`);

    // Myntra with /buy suffix
    const tMyntra = deriveTitleFromUrl(
      'https://www.myntra.com/tshirts/roadster/roadster-men-black-pure-cotton-tshirt/1234567/buy',
      'myntra'
    );
    assert(tMyntra.toLowerCase().includes('roadster men black'), `Myntra title derived: "${tMyntra}"`);

    // Ajio with /p/ slug
    const tAjio = deriveTitleFromUrl(
      'https://www.ajio.com/nike-men-revolution-running-shoes/p/4612345_blue',
      'ajio'
    );
    assert(tAjio.toLowerCase().includes('nike men revolution'), `Ajio title derived: "${tAjio}"`);

    // Westside with /products/ slug
    const tWestside = deriveTitleFromUrl(
      'https://www.westside.com/products/eta-teal-resort-fit-shirt-300965000',
      'westside'
    );
    assert(tWestside.toLowerCase().includes('eta teal resort'), `Westside title derived: "${tWestside}"`);

    console.log('  ✅ PASS: All 6 storefront title extractions verified.');
    passed++;
  }

  // Test 2: Rate Limiting on Signin
  console.log('\n2. Testing Signin Rate Limiting and Lockout');
  {
    const testEmail = 'brute-force-test@example.com';
    await resetSigninRateLimit(`email:${testEmail}`);

    // Exhaust 5 allowed attempts
    for (let i = 1; i <= 5; i++) {
      const res = await checkSigninRateLimit(`email:${testEmail}`, 5, 900);
      assert(res.allowed === true, `Attempt ${i} should be allowed`);
    }

    // 6th attempt must be blocked
    const blockedRes = await checkSigninRateLimit(`email:${testEmail}`, 5, 900);
    assert(blockedRes.allowed === false, '6th attempt must be blocked by rate limiter');
    assert(blockedRes.retryAfterSeconds > 0, 'Retry-After seconds must be > 0');

    // Resetting unlocks account
    await resetSigninRateLimit(`email:${testEmail}`);
    const unblockedRes = await checkSigninRateLimit(`email:${testEmail}`, 5, 900);
    assert(unblockedRes.allowed === true, 'Resetting rate limit must restore access');

    console.log('  ✅ PASS: Signin rate limiter throttles and resets cleanly.');
    passed++;
  }

  // Test 3: Centralized User Role and Combined Access Resolution
  console.log('\n3. Testing resolveUserRole & isCombinedAccount Authority');
  {
    const r1 = resolveUserRole('rahulr24g@gmail.com');
    assert(r1.isCombined === true && r1.role === 'combined', 'Strict email gives combined role');

    const r2 = resolveUserRole('Nisha', 'nisha@gmail.com');
    assert(r2.isCombined === false && r2.role === 'user', 'Other users receive standard role');

    const r3 = resolveUserRole('Rahul');
    assert(r3.isCombined === false && r3.role === 'user', 'Name alone cannot grant combined access');

    console.log('  ✅ PASS: Centralized role resolver enforces strict access.');
    passed++;
  }

  // Test 4: Serverless Environment Detection
  console.log('\n4. Testing Serverless Production Safeguard');
  {
    const isServerless = isServerlessProduction();
    console.log(`  ℹ️ isServerlessProduction() returned: ${isServerless}`);
    assert(typeof isServerless === 'boolean', 'isServerlessProduction returns boolean');
    console.log('  ✅ PASS: Serverless environment safeguard callable without error.');
    passed++;
  }

  // Test 5: In-Memory Sliding Window Fallback Rate Limiter
  console.log('\n5. Testing Sliding Window Rate Limiter Logic');
  {
    const key = `test-key-${Date.now()}`;
    const r1 = checkMemoryRateLimit(key, 2, 5000);
    assert(r1.allowed === true && r1.remaining === 1, 'First hit allowed with 1 remaining');

    const r2 = checkMemoryRateLimit(key, 2, 5000);
    assert(r2.allowed === true && r2.remaining === 0, 'Second hit allowed with 0 remaining');

    const r3 = checkMemoryRateLimit(key, 2, 5000);
    assert(r3.allowed === false && r3.retryAfterSeconds > 0, 'Third hit blocked within window');

    console.log('  ✅ PASS: In-memory sliding window rate limiter logic verified.');
    passed++;
  }

  console.log('\n======================================================');
  console.log(`🛡️ Hardening & Security Audit Complete: ${passed} PASSED!`);
  console.log('======================================================\n');
}

runHardeningTests().catch((err) => {
  console.error('Fatal hardening test error:', err);
  process.exit(1);
});
