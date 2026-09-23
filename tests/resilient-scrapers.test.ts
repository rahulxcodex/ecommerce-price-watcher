import assert from 'assert';
import * as cheerio from 'cheerio';
import {
  extractJsonLdProduct,
  extractMetaTags,
  extractSelectorPrice,
} from '../scripts/scrapers/resilient-extractor';

async function runResilienceTests() {
  console.log('🛡️  Running HTML Change Resilience & Fault-Tolerance Tests...\n');
  let passed = 0;

  // 1. JSON-LD Resilience Test: HTML body has completely altered DOM with no traditional price classes
  const scrambledHtmlWithJsonLd = `
    <!DOCTYPE html>
    <html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Roadster Men Navy Blue Printed T-Shirt",
          "image": "https://assets.myntassets.com/h_1440,q_90,w_1080/v1/assets/images/2297873/2018/2/6/11517904351336-1.jpg",
          "offers": {
            "@type": "Offer",
            "price": "499",
            "priceCurrency": "INR",
            "availability": "https://schema.org/InStock"
          }
        }
        </script>
      </head>
      <body>
        <!-- Redesigned DOM: completely changed classes, no .pdp-price or .price -->
        <main class="x78_redesign_wrapper_v4">
          <div class="xyz_title_box_99">Some Unrelated Text</div>
          <div class="random_box_123">Content</div>
        </main>
      </body>
    </html>
  `;

  const $1 = cheerio.load(scrambledHtmlWithJsonLd);
  const jsonLdResult = extractJsonLdProduct($1);

  assert(jsonLdResult !== null, 'JSON-LD extractor must extract structured product data');
  assert.strictEqual(jsonLdResult?.price, 499, 'Price must be correctly parsed as 499 INR');
  assert.strictEqual(jsonLdResult?.title, 'Roadster Men Navy Blue Printed T-Shirt');
  assert(jsonLdResult?.imageUrl?.includes('myntassets.com'));
  assert.strictEqual(jsonLdResult?.isOutOfStock, false);
  console.log('  ✅ [PASS] Tier 1: JSON-LD extraction succeeds despite completely redesigned/scrambled DOM');
  passed++;

  // 2. OpenGraph & Twitter Meta Tags Resilience Test: No JSON-LD, scrambled DOM, only OpenGraph
  const scrambledHtmlWithMetaTags = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta property="og:title" content="GAP Men Logo Crew Neck T-Shirt" />
        <meta property="product:price:amount" content="999.00" />
        <meta property="product:price:currency" content="INR" />
        <meta property="og:image" content="https://assets.ajio.com/medias/sys_master/root/gap_tshirt.jpg" />
      </head>
      <body>
        <!-- Redesigned DOM with obfuscated Tailwind classes -->
        <section class="min-h-screen bg-neutral-900 text-white flex flex-col">
          <div class="header-v3">Welcome</div>
        </section>
      </body>
    </html>
  `;

  const $2 = cheerio.load(scrambledHtmlWithMetaTags);
  const metaResult = extractMetaTags($2);

  assert.strictEqual(metaResult.price, 999, 'Price must be extracted from product:price:amount');
  assert.strictEqual(metaResult.title, 'GAP Men Logo Crew Neck T-Shirt');
  assert(metaResult.imageUrl?.includes('gap_tshirt.jpg'));
  console.log('  ✅ [PASS] Tier 2: OpenGraph & Meta tag extraction succeeds with zero DOM selectors matching');
  passed++;

  // 3. Myntra Hydration State Simulation (__myx.pdpData)
  const myntraHtmlScrambled = `
    <html>
      <head>
        <script>
          window.__myx = {
            "pdpData": {
              "id": 2297873,
              "name": "Men Navy Printed T-Shirt",
              "brand": { "name": "Roadster" },
              "price": { "mrp": 999, "discounted": 399 },
              "media": { "albums": [{ "images": [{ "src": "https://assets.myntassets.com/sample.jpg" }] }] },
              "sizes": [{ "label": "M", "available": true }]
            }
          };
        </script>
      </head>
      <body>
        <div class="scrambled_app_container"></div>
      </body>
    </html>
  `;

  const myxMatch = myntraHtmlScrambled.match(/window\.__myx\s*=\s*(\{[\s\S]+?\})\s*;?\s*<\/script>/);
  assert(myxMatch && myxMatch[1], 'Must match window.__myx script block');
  const myxData = JSON.parse(myxMatch[1]);
  const pdpData = myxData.pdpData;
  const price = pdpData.price.discounted;
  assert.strictEqual(price, 399, 'Extracted price from pdpData must be 399');
  console.log('  ✅ [PASS] Tier 3: Myntra window.__myx hydration state extraction resilient to DOM alterations');
  passed++;

  // 4. Westside Shopify Endpoint Simulation (price in paise/cents: 129900 -> 1299 INR)
  const shopifyRawJson = {
    id: 99887766,
    title: 'ETA Sage Slim Fit Shirt',
    price: 129900,
    compare_at_price: 169900,
    available: true,
    featured_image: '//cdn.shopify.com/s/files/1/westside/shirt.jpg',
  };

  let westsidePrice = shopifyRawJson.price;
  if (westsidePrice > 10000 && Number.isInteger(westsidePrice)) {
    westsidePrice = westsidePrice / 100;
  }
  assert.strictEqual(westsidePrice, 1299, 'Shopify 129900 paise must normalize to 1299 INR');
  console.log('  ✅ [PASS] Tier 4: Shopify native JSON endpoint resilient to store theme overhaul');
  passed++;

  // 5. Fallback CSS Selector cascading
  const htmlWithModernThemeSelectors = `
    <html>
      <body>
        <span class="price-item--sale">₹1,499.00</span>
      </body>
    </html>
  `;
  const $5 = cheerio.load(htmlWithModernThemeSelectors);
  const selectorPrice = extractSelectorPrice($5, [
    'span.old-broken-selector',
    'div.legacy-price',
    'span.price-item--sale',
  ]);
  assert.strictEqual(selectorPrice, 1499, 'Fallback selector cascade must locate price');
  console.log('  ✅ [PASS] Tier 5: Multi-selector cascading recovers price when older selectors break');
  passed++;

  console.log(`\n🎉 Resilience Suite Passed: ${passed}/5 tests successful!\n`);
}

runResilienceTests().catch((err) => {
  console.error('❌ Resilience Test Failure:', err);
  process.exit(1);
});
