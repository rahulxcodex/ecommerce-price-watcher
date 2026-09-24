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

/**
 * Executes a network fetch with request timeout, exponential backoff, and randomized jitter on 429/503 rate limits.
 * Protects serverless functions and CI runners from hung TCP sockets with an AbortController timeout.
 */
export async function fetchWithBackoff(
  url: string,
  options?: RequestInit,
  maxRetries: number = 3,
  timeoutMs: number = 15000
): Promise<Response> {
  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort(new Error(`Request timed out after ${timeoutMs}ms for URL: ${url}`));
    }, timeoutMs);

    const callerSignal = options?.signal;
    const onCallerAbort = () => controller.abort(callerSignal?.reason);
    if (callerSignal) {
      if (callerSignal.aborted) {
        clearTimeout(timeoutId);
        throw callerSignal.reason;
      }
      callerSignal.addEventListener('abort', onCallerAbort, { once: true });
    }

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (res.status === 429 || res.status === 503) {
        if (attempt < maxRetries) {
          attempt++;
          let waitMs = 1000 * Math.pow(2, attempt);
          const retryAfter = res.headers.get('retry-after');
          if (retryAfter) {
            const parsedSeconds = parseInt(retryAfter, 10);
            if (!isNaN(parsedSeconds)) {
              waitMs = Math.max(waitMs, parsedSeconds * 1000);
            } else {
              const parsedDate = Date.parse(retryAfter);
              if (!isNaN(parsedDate)) {
                waitMs = Math.max(waitMs, parsedDate - Date.now());
              }
            }
          }
          // Full jitter: uniformly distributed between 500ms and min(15000ms, waitMs)
          const delayMs = Math.max(500, Math.floor(Math.random() * Math.min(15000, waitMs)));
          await delay(delayMs);
          continue;
        }
      }
      return res;
    } catch (err: unknown) {
      if (attempt < maxRetries) {
        attempt++;
        const delayMs = Math.max(500, Math.floor(Math.random() * Math.min(10000, 1000 * Math.pow(2, attempt))));
        await delay(delayMs);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      if (callerSignal) {
        callerSignal.removeEventListener('abort', onCallerAbort);
      }
    }
  }
}

export function isPlaywrightAvailable(): boolean {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NOW_REGION) {
    return false;
  }
  try {
    const { chromium } = require('playwright');
    const execPath = chromium.executablePath();
    const fs = require('fs');
    return Boolean(execPath && fs.existsSync(execPath));
  } catch {
    return false;
  }
}

// ============================================================================
// Shared Playwright Browser Lifecycle Manager
// Avoids launching a separate Chromium process per product to preserve runner memory & CPU
// ============================================================================

let sharedBrowserPromise: Promise<any> | null = null;

export async function getSharedBrowser(): Promise<any> {
  if (!isPlaywrightAvailable()) {
    return null;
  }
  if (!sharedBrowserPromise) {
    sharedBrowserPromise = (async () => {
      try {
        const { chromium } = await import('playwright');
        const browser = await chromium.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-gpu',
          ],
        });
        return browser;
      } catch (err) {
        console.warn('[Playwright] Failed to launch shared Chromium browser:', err);
        sharedBrowserPromise = null;
        return null;
      }
    })();
  }
  return sharedBrowserPromise;
}

export async function closeSharedBrowser(): Promise<void> {
  if (sharedBrowserPromise) {
    try {
      const browser = await sharedBrowserPromise;
      if (browser) {
        await browser.close();
      }
    } catch (err) {
      console.warn('[Playwright] Error closing shared Chromium browser:', err);
    } finally {
      sharedBrowserPromise = null;
    }
  }
}

export async function withSharedBrowserPage<T>(
  action: (page: any) => Promise<T>,
  options?: {
    userAgent?: string;
    viewport?: { width: number; height: number };
    locale?: string;
    timezoneId?: string;
  }
): Promise<T> {
  const browser = await getSharedBrowser();
  if (!browser) {
    throw new Error('Playwright browser is unavailable in this environment.');
  }

  const context = await browser.newContext({
    userAgent: options?.userAgent || getRandomUserAgent(),
    viewport: options?.viewport || { width: 1280, height: 800 },
    locale: options?.locale || 'en-IN',
    timezoneId: options?.timezoneId || 'Asia/Kolkata',
  });

  const page = await context.newPage();
  try {
    return await action(page);
  } finally {
    try {
      await page.close();
    } catch {}
    try {
      await context.close();
    } catch {}
  }
}

export function getMobileHeaders(): Record<string, string> {
  return {
    'User-Agent':
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-IN,en;q=0.9',
    'Sec-CH-UA-Mobile': '?1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
  };
}
