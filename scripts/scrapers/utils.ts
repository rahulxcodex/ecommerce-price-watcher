export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
];

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export function getDefaultHeaders(): Record<string, string> {
  return {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
  };
}

export function parsePrice(raw: string): number | null {
  if (!raw || typeof raw !== 'string') return null;

  // 1. Look for currency symbol followed by price: ₹1,499 or Rs. 1499.00
  const currencyMatch = raw.match(/(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (currencyMatch && currencyMatch[1]) {
    const val = parseFloat(currencyMatch[1].replace(/,/g, ''));
    if (!isNaN(val) && val > 0) return val;
  }

  // 2. Fallback: Clean commas and currency signs, match valid decimal
  const cleaned = raw.replace(/[₹$,\s]/g, '').trim();
  const matches = Array.from(cleaned.matchAll(/(\d+(?:\.\d{1,2})?)/g));
  if (matches.length === 0) return null;

  // If multiple numbers exist (e.g. "Pack of 2 - 1499"), pick the most plausible price (> 20)
  for (const m of matches) {
    const candidate = parseFloat(m[1]);
    if (!isNaN(candidate) && candidate >= 10) {
      return candidate;
    }
  }

  const fallback = parseFloat(matches[0][1]);
  return isNaN(fallback) ? null : fallback;
}

export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
