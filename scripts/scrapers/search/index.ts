import { DiscoveryResult, Platform } from '@/types';
import { searchAmazon } from './amazon-search';
import { searchFlipkart } from './flipkart-search';
import { searchMeesho } from './meesho-search';
import { searchMyntra } from './myntra-search';
import { searchAjio } from './ajio-search';
import { searchWestside } from './westside-search';
import { sanitizeSearchQuery } from './search-utils';
import { computeParetoFrontier } from '@/lib/dsa';

export async function searchPlatform(platform: Platform, query: string, limit: number = 15): Promise<DiscoveryResult[]> {
  const sanitized = sanitizeSearchQuery(query);
  if (!sanitized) return [];

  let results: DiscoveryResult[] = [];

  switch (platform) {
    case 'amazon':
      results = await searchAmazon(sanitized, limit);
      break;
    case 'flipkart':
      results = await searchFlipkart(sanitized, limit);
      break;
    case 'meesho':
      results = await searchMeesho(sanitized, limit);
      break;
    case 'myntra':
      results = await searchMyntra(sanitized, limit);
      break;
    case 'ajio':
      results = await searchAjio(sanitized, limit);
      break;
    case 'westside':
      results = await searchWestside(sanitized, limit);
      break;
    default:
      results = [];
  }

  // Decorate results with Pareto Frontier flag
  if (results.length > 0) {
    const { paretoIndices } = computeParetoFrontier(results);
    results = results.map((r) => ({
      ...r,
      isParetoOptimal: paretoIndices.has(r.id),
    }));
  }

  return results;
}

export { sanitizeSearchQuery } from './search-utils';
