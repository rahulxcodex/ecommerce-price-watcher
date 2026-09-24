import { Platform, ScrapeResult } from '@/types';
import { scrapeAmazon } from './amazon';
import { scrapeFlipkart } from './flipkart';
import { scrapeMeesho } from './meesho';
import { scrapeMyntra } from './myntra';
import { scrapeAjio } from './ajio';
import { scrapeWestside } from './westside';

export type ScraperFunction = (url: string) => Promise<ScrapeResult>;

/**
 * Authoritative platform scraper registry.
 * Eliminates repetitive if-else platform dispatches and provides a single extension point.
 */
export const PLATFORM_SCRAPERS: Record<Platform, ScraperFunction> = {
  amazon: scrapeAmazon,
  flipkart: scrapeFlipkart,
  meesho: scrapeMeesho,
  myntra: scrapeMyntra,
  ajio: scrapeAjio,
  westside: scrapeWestside,
};

/**
 * Dispatches a URL scrape to the registered storefront handler.
 */
export async function scrapeByPlatform(platform: Platform, url: string): Promise<ScrapeResult> {
  const scraper = PLATFORM_SCRAPERS[platform];
  if (!scraper) {
    return {
      success: false,
      error: `Unsupported platform: "${platform}". Registered platforms: ${Object.keys(PLATFORM_SCRAPERS).join(', ')}`,
      errorCode: 'INVALID_URL',
    };
  }
  return scraper(url);
}
