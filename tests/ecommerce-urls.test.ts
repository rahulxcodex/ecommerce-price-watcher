import { validateAndSanitizeUrl, validateScrapedPrice } from '../src/lib/security';
import { parsePrice } from '../scripts/scrapers/utils';

interface TestCase {
  name: string;
  url: string;
  expectedValid: boolean;
  expectedPlatform?: string;
  expectedCleanSubstring?: string;
  forbiddenInClean?: string[];
}

const testCases: TestCase[] = [
  // Amazon India
  {
    name: 'Amazon India Standard Product URL',
    url: 'https://www.amazon.in/Apple-iPhone-15-128-GB/dp/B0CHX1W1XY',
    expectedValid: true,
    expectedPlatform: 'amazon',
    expectedCleanSubstring: 'amazon.in/Apple-iPhone-15-128-GB/dp/B0CHX1W1XY',
  },
  {
    name: 'Amazon India with Tracking, Affiliate and Session Params',
    url: 'https://www.amazon.in/dp/B0CHX1W1XY?tag=rahulaffiliate-21&ref_=as_li_ss_tl&pf_rd_r=XYZ123&utm_source=google',
    expectedValid: true,
    expectedPlatform: 'amazon',
    forbiddenInClean: ['tag=', 'ref_=', 'pf_rd_r=', 'utm_source='],
  },
  {
    name: 'Amazon India Shortlink amzn.to',
    url: 'https://amzn.to/3XyZabc',
    expectedValid: true,
    expectedPlatform: 'amazon',
  },
  {
    name: 'Amazon India Shortlink amzn.in',
    url: 'https://amzn.in/d/89abcdef',
    expectedValid: true,
    expectedPlatform: 'amazon',
  },
  {
    name: 'Amazon US Global URL (amazon.com)',
    url: 'https://www.amazon.com/Sony-WH-1000XM5-Canceling-Headphones/dp/B09XS7JWHH',
    expectedValid: true,
    expectedPlatform: 'amazon',
  },

  // Flipkart
  {
    name: 'Flipkart Standard Product URL',
    url: 'https://www.flipkart.com/apple-iphone-15-black-128-gb/p/itm6ac6485515ae4?pid=MOBGTAGPTB3VS24W',
    expectedValid: true,
    expectedPlatform: 'flipkart',
    expectedCleanSubstring: 'flipkart.com/apple-iphone-15-black-128-gb/p/itm6ac6485515ae4',
  },
  {
    name: 'Flipkart with Affiliate and Campaign Params',
    url: 'https://www.flipkart.com/item/p/itm12345?affid=earnkaroblog&affExtParam1=subid&utm_medium=affiliate&gclid=test123',
    expectedValid: true,
    expectedPlatform: 'flipkart',
    forbiddenInClean: ['affid=', 'affExtParam1=', 'utm_medium=', 'gclid='],
  },
  {
    name: 'Flipkart Deep Link dl.flipkart.com',
    url: 'https://dl.flipkart.com/s/testDeepLink',
    expectedValid: true,
    expectedPlatform: 'flipkart',
  },
  {
    name: 'Flipkart Short URL fkrt.it',
    url: 'https://fkrt.it/xyz789',
    expectedValid: true,
    expectedPlatform: 'flipkart',
  },

  // Meesho
  {
    name: 'Meesho Standard Product URL',
    url: 'https://www.meesho.com/s/p/1abcde',
    expectedValid: true,
    expectedPlatform: 'meesho',
    expectedCleanSubstring: 'meesho.com/s/p/1abcde',
  },
  {
    name: 'Meesho with UTM and Social Referrals',
    url: 'https://www.meesho.com/classic-tshirt/p/2xyz99?utm_source=instagram&utm_campaign=summer_sale&fbclid=IwAR098',
    expectedValid: true,
    expectedPlatform: 'meesho',
    forbiddenInClean: ['utm_source=', 'utm_campaign=', 'fbclid='],
  },

  // Unsupported E-Commerce Platforms (must be rejected gracefully)
  {
    name: 'Unsupported: Myntra URL',
    url: 'https://www.myntra.com/tshirts/roadster/roadster-men-navy-printed-round-neck-t-shirt/2297873/buy',
    expectedValid: false,
  },
  {
    name: 'Unsupported: Ajio URL',
    url: 'https://www.ajio.com/gap-men-logo-crew-neck-t-shirt/p/441123456_blue',
    expectedValid: false,
  },
  {
    name: 'Unsupported: Tata CLiQ URL',
    url: 'https://www.tatacliq.com/apple-iphone-15-128gb-blue/p-mp000000018899834',
    expectedValid: false,
  },
  {
    name: 'Unsupported: Walmart US URL',
    url: 'https://www.walmart.com/ip/Apple-iPhone-15-128GB/123456789',
    expectedValid: false,
  },
  {
    name: 'Unsupported: eBay Global URL',
    url: 'https://www.ebay.com/itm/123456789012',
    expectedValid: false,
  },
  {
    name: 'Unsupported: AliExpress URL',
    url: 'https://www.aliexpress.com/item/100500123456789.html',
    expectedValid: false,
  },
];

async function runEcommerceUrlTests() {
  console.log('🌐 Running Multi-Ecommerce URL Matrix Testing...\n');
  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const result = validateAndSanitizeUrl(tc.url);

    try {
      if (result.valid !== tc.expectedValid) {
        throw new Error(`Expected valid=${tc.expectedValid}, got ${result.valid}. Error: ${result.error}`);
      }

      if (tc.expectedValid) {
        if (result.platform !== tc.expectedPlatform) {
          throw new Error(`Expected platform=${tc.expectedPlatform}, got ${result.platform}`);
        }

        if (tc.expectedCleanSubstring && !result.cleanUrl?.includes(tc.expectedCleanSubstring)) {
          throw new Error(`Expected cleanUrl to include "${tc.expectedCleanSubstring}", got "${result.cleanUrl}"`);
        }

        if (tc.forbiddenInClean) {
          for (const param of tc.forbiddenInClean) {
            if (result.cleanUrl?.includes(param)) {
              throw new Error(`Clean URL must not contain "${param}". Got: "${result.cleanUrl}"`);
            }
          }
        }
      }

      console.log(`  ✅ [PASS] ${tc.name}`);
      passed++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ [FAIL] ${tc.name}: ${msg}`);
      failed++;
    }
  }

  console.log(`\n📊 Ecommerce URL Results: ${passed} Passed, ${failed} Failed out of ${testCases.length} tests.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runEcommerceUrlTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
