import { validateAndSanitizeUrl } from '../src/lib/security';
import { scrapeMyntra } from '../scripts/scrapers/myntra';
import { scrapeAjio } from '../scripts/scrapers/ajio';
import { scrapeWestside } from '../scripts/scrapers/westside';
import { scrapeAmazon } from '../scripts/scrapers/amazon';
import { scrapeFlipkart } from '../scripts/scrapers/flipkart';
import { scrapeMeesho } from '../scripts/scrapers/meesho';

interface TargetItem {
  platform: string;
  url: string;
  scraper: (url: string) => Promise<any>;
}

const targets: TargetItem[] = [
  {
    platform: 'Myntra',
    url: 'https://www.myntra.com/tshirts/roadster/roadster-men-navy-printed-round-neck-t-shirt/2297873/buy',
    scraper: scrapeMyntra,
  },
  {
    platform: 'Ajio',
    url: 'https://www.ajio.com/gap-men-logo-crew-neck-t-shirt/p/441123456_blue',
    scraper: scrapeAjio,
  },
  {
    platform: 'Westside',
    url: 'https://www.westside.com/products/eta-sage-slim-fit-shirt-300958742',
    scraper: scrapeWestside,
  },
];

async function runLiveLinkTests() {
  console.log('🚀 Testing Live Links from Supported Platforms...\n');

  for (const item of targets) {
    console.log(`--- [Testing ${item.platform}] ---`);
    console.log(`URL: ${item.url}`);

    // Step 1: Security & SSRF Validation
    const val = validateAndSanitizeUrl(item.url);
    console.log(`Security Validation: ${val.valid ? '✅ VALID' : '❌ INVALID'}`);
    console.log(`Detected Platform: ${val.platform}`);
    console.log(`Sanitized Clean URL: ${val.cleanUrl}`);

    if (!val.valid) {
      console.error(`Error: ${val.error}`);
      continue;
    }

    // Step 2: Scraper Execution
    console.log(`Executing ${item.platform} Scraper...`);
    try {
      const res = await item.scraper(val.cleanUrl!);
      console.log('Scraper Result:', {
        success: res.success,
        title: res.title,
        price: res.price,
        currency: res.currency,
        imageUrl: res.imageUrl ? `${res.imageUrl.slice(0, 60)}...` : undefined,
        isOutOfStock: res.isOutOfStock,
        error: res.error,
      });
    } catch (err: unknown) {
      console.error(`Scraper Exception: ${err instanceof Error ? err.message : String(err)}`);
    }
    console.log('\n');
  }
}

runLiveLinkTests();
