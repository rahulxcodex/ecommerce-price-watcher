import { validateAndSanitizeUrl, validateScrapedPrice } from '../src/lib/security';
import { calculateDiscount } from '../src/lib/utils';
import { parsePrice } from '../scripts/scrapers/utils';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('🧪 Starting Security & Logic Validation Tests...\n');
  let passed = 0;

  // Test 1: SSRF - Block Localhost and Loopback
  {
    const r1 = validateAndSanitizeUrl('http://localhost:3000/api/secret');
    assert(!r1.valid, 'Localhost should be blocked');

    const r2 = validateAndSanitizeUrl('https://127.0.0.1:8080');
    assert(!r2.valid, '127.0.0.1 should be blocked');

    const r3 = validateAndSanitizeUrl('http://169.254.169.254/latest/meta-data/');
    assert(!r3.valid, 'AWS Cloud metadata IP should be blocked');

    const r4 = validateAndSanitizeUrl('https://192.168.1.1');
    assert(!r4.valid, 'Private IP RFC1918 should be blocked');

    const r5 = validateAndSanitizeUrl('file:///etc/passwd');
    assert(!r5.valid, 'file:// protocol should be blocked');

    console.log('✅ 1. SSRF & Protocol defense verified');
    passed++;
  }

  // Test 2: Domain Whitelist & Parameter Sanitization
  {
    const amazon = validateAndSanitizeUrl(
      'https://www.amazon.in/Apple-iPhone-15-128-GB/dp/B0CHX1W1XY?tag=affiliate-21&ref_=nav_signin'
    );
    assert(amazon.valid === true, 'Valid Amazon URL must pass');
    assert(amazon.platform === 'amazon', 'Platform must be amazon');
    assert(!amazon.cleanUrl?.includes('tag=affiliate-21'), 'Affiliate tracking tag must be stripped');
    assert(!amazon.cleanUrl?.includes('ref_='), 'Tracking ref parameter must be stripped');

    const flipkart = validateAndSanitizeUrl(
      'https://www.flipkart.com/apple-iphone-15-black-128-gb/p/itm6ac6485515ae4?pid=MOBGTAGPTB3VS24W&affid=123'
    );
    assert(flipkart.valid === true, 'Valid Flipkart URL must pass');
    assert(flipkart.platform === 'flipkart', 'Platform must be flipkart');
    assert(!flipkart.cleanUrl?.includes('affid=123'), 'Affiliate tag must be stripped');

    const meesho = validateAndSanitizeUrl(
      'https://www.meesho.com/classic-unique-men-tshirts/p/1abcde?utm_source=fb'
    );
    assert(meesho.valid === true, 'Valid Meesho URL must pass');
    assert(meesho.platform === 'meesho', 'Platform must be meesho');
    assert(!meesho.cleanUrl?.includes('utm_source'), 'UTM params must be stripped');

    const malicious = validateAndSanitizeUrl('https://evil-phishing-site.com/amazon.in');
    assert(!malicious.valid, 'Lookalike phishing domain must be rejected');

    console.log('✅ 2. Domain whitelist & tracking parameter sanitization verified');
    passed++;
  }

  // Test 3: Price Sanity & Anti-Hallucination
  {
    const zero = validateScrapedPrice(0);
    assert(!zero.isValid, 'Zero price must be invalid');

    const negative = validateScrapedPrice(-50);
    assert(!negative.isValid, 'Negative price must be invalid');

    const normal = validateScrapedPrice(1999, 2499);
    assert(normal.isValid, 'Normal price drop must be valid');

    const abnormal = validateScrapedPrice(5, 50000);
    assert(!abnormal.isValid, '99.9% price drop anomaly must be flagged');

    console.log('✅ 3. Scraped price anomaly validation verified');
    passed++;
  }

  // Test 4: Currency Parser
  {
    assert(parsePrice('₹1,499') === 1499, 'Parse ₹1,499');
    assert(parsePrice('₹ 1,29,900.00') === 129900, 'Parse ₹ 1,29,900.00');
    assert(parsePrice(' 499 ') === 499, 'Parse plain 499');
    assert(parsePrice('') === null, 'Parse empty string returns null');

    console.log('✅ 4. Price string normalization verified');
    passed++;
  }

  // Test 5: Discount Calculator
  {
    assert(calculateDiscount(800, 1000) === 20, '20% discount calculation');
    assert(calculateDiscount(1000, 1000) === 0, '0% discount if prices equal');
    assert(calculateDiscount(1200, 1000) === 0, '0% discount if current is higher');

    console.log('✅ 5. Discount calculation verified');
    passed++;
  }

  console.log(`\n🎉 All ${passed} security and logic tests PASSED successfully!`);
}

runTests().catch((e) => {
  console.error('Test suite failed:', e);
  process.exit(1);
});
