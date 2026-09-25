import { getAdminEmail } from '@/lib/constants';

export interface PriceAlertData {
  productTitle: string;
  productUrl: string;
  previousPrice: number;
  newPrice: number;
  lowestPrice: number;
  currency?: string;
  isAllTimeLow: boolean;
  isBackInStock?: boolean;
  imageUrl?: string;
  platform?: string;
}

export interface NotificationProvider {
  name: string;
  isConfigured(settings: Record<string, unknown>): boolean;
  send(settings: Record<string, unknown>, alert: PriceAlertData): Promise<{ success: boolean; error?: string }>;
}

export interface PriceDropNotification {
  chatId: string;
  productTitle: string;
  productUrl: string;
  previousPrice: number;
  newPrice: number;
  lowestPrice: number;
  currency: string;
  isAllTimeLow: boolean;
  isBackInStock?: boolean;
}

/**
 * Sends price drop or back-in-stock alert via Telegram Bot API
 */
export async function sendTelegramAlert(data: PriceDropNotification): Promise<{ success: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return { success: false, error: 'TELEGRAM_BOT_TOKEN is not configured.' };
  }

  const discountPercent =
    data.previousPrice > data.newPrice
      ? Math.round(((data.previousPrice - data.newPrice) / data.previousPrice) * 100)
      : 0;

  const emoji = data.isBackInStock
    ? '🎉 📦 BACK IN STOCK!'
    : data.isAllTimeLow
    ? '🔥 💥 ALL-TIME LOW PRICE!'
    : '📉 Price Drop Alert!';

  // Escape special MarkdownV2 characters
  const escapeMarkdown = (text: string) => {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
  };

  // Escape special characters in inline link URLs
  const escapeUrl = (url: string) => {
    return url.replace(/([)\\])/g, '\\$1');
  };

  const safeTitle = escapeMarkdown(
    data.productTitle.length > 80 ? data.productTitle.slice(0, 77) + '...' : data.productTitle
  );
  const formattedOldPrice = `₹${data.previousPrice.toLocaleString('en-IN')}`;
  const formattedNewPrice = `₹${data.newPrice.toLocaleString('en-IN')}`;

  const message = [
    `*${escapeMarkdown(emoji)}*`,
    '',
    `📦 *${safeTitle}*`,
    '',
    data.isBackInStock
      ? `✅ Product is back in stock at *${escapeMarkdown(formattedNewPrice)}*!`
      : `💰 Price: ~${escapeMarkdown(formattedOldPrice)}~ ➔ *${escapeMarkdown(formattedNewPrice)}*`,
    discountPercent > 0 && !data.isBackInStock ? `🏷️ Save *${discountPercent}% OFF*` : '',
    data.isAllTimeLow && !data.isBackInStock ? `🏆 Lowest price ever recorded\\!` : '',
    '',
    `🔗 [Open Product Page](${escapeUrl(data.productUrl)})`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: data.chatId,
        text: message,
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: false,
      }),
    });

    const result = await res.json();
    if (!result.ok) {
      return { success: false, error: `Telegram API error: ${result.description}` };
    }

    return { success: true };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errMsg };
  }
}

/**
 * Sends price drop alert via CallMeBot WhatsApp Gateway (100% Free)
 */
export async function sendWhatsAppAlert(data: {
  phone: string;
  apiKey: string;
  productTitle: string;
  productUrl: string;
  previousPrice: number;
  newPrice: number;
  currency?: string;
  isAllTimeLow?: boolean;
  isBackInStock?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanPhone = data.phone.replace(/[\s\-\+]/g, '');
    const discountPercent =
      data.previousPrice > data.newPrice
        ? Math.round(((data.previousPrice - data.newPrice) / data.previousPrice) * 100)
        : 0;

    const emoji = data.isBackInStock
      ? '🎉 BACK IN STOCK!'
      : data.isAllTimeLow
      ? '🔥 ALL-TIME LOW PRICE!'
      : '📉 Price Drop Alert!';

    const text = [
      `*${emoji}*`,
      `📦 ${data.productTitle.slice(0, 60)}`,
      data.isBackInStock
        ? `Available again at ₹${data.newPrice.toLocaleString('en-IN')}!`
        : `💰 ₹${data.previousPrice.toLocaleString('en-IN')} ➔ *₹${data.newPrice.toLocaleString('en-IN')}* (${discountPercent}% OFF)`,
      data.isAllTimeLow ? '🏆 Lowest ever recorded!' : '',
      `🔗 ${data.productUrl}`,
    ]
      .filter(Boolean)
      .join('\n');

    const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodeURIComponent(text)}&apikey=${data.apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { success: false, error: `CallMeBot returned status ${res.status}` };
    }
    return { success: true };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errMsg };
  }
}

/**
 * Sends price drop alert via Google Apps Script Email API
 */
export async function sendEmailAlert(data: {
  to: string;
  productTitle: string;
  productUrl: string;
  previousPrice: number;
  newPrice: number;
  lowestPrice?: number;
  currency?: string;
  isAllTimeLow?: boolean;
  isBackInStock?: boolean;
  imageUrl?: string;
  platform?: string;
}): Promise<{ success: boolean; error?: string }> {
  const apiUrl = process.env.APPSCRIPT_EMAIL_URL;
  if (!apiUrl) {
    return { success: false, error: 'APPSCRIPT_EMAIL_URL is not configured.' };
  }

  try {
    const apiKey = process.env.APPSCRIPT_API_KEY;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: data.isBackInStock ? 'back_in_stock' : 'price_drop',
        apiKey,
        ...data,
      }),
      redirect: 'follow',
    });

    const result = await res.json();
    if (!result.success) {
      return { success: false, error: result.error || 'Apps Script dispatch failed' };
    }

    return { success: true };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errMsg };
  }
}

/**
 * Sends scraper failure alert via Email to rahulr24g@gmail.com
 */
export async function sendScraperFailureAlert(data: {
  productTitle: string;
  productUrl: string;
  platform: string;
  error: string;
  retryAttempts?: number;
  to?: string;
}): Promise<{ success: boolean; error?: string }> {
  const apiUrl = process.env.APPSCRIPT_EMAIL_URL;
  const recipient = data.to || process.env.SCRAPER_ALERT_EMAIL || process.env.APPSCRIPT_TO_EMAIL || getAdminEmail();

  if (!apiUrl) {
    console.warn(`[sendScraperFailureAlert] APPSCRIPT_EMAIL_URL not set. Failure alert simulated for ${recipient}: ${data.error}`);
    return { success: false, error: 'APPSCRIPT_EMAIL_URL is not configured.' };
  }

  const subject = `⚠️ [Scraper Failure] ${data.platform.toUpperCase()} - ${data.productTitle.slice(0, 45)}`;
  const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b;">
      <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <h2 style="color: #f87171; margin: 0 0 8px 0; font-size: 18px;">⚠️ Scraper Extraction Failure</h2>
        <p style="margin: 0; color: #cbd5e1; font-size: 14px;">The automated scraper encountered an extraction failure after ${data.retryAttempts || 2} attempt(s).</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px 0; color: #94a3b8; width: 120px;"><strong>Platform:</strong></td>
          <td style="padding: 8px 0; color: #38bdf8; text-transform: uppercase; font-weight: bold;">${data.platform}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #94a3b8;"><strong>Product:</strong></td>
          <td style="padding: 8px 0; color: #f1f5f9; font-weight: 600;">${data.productTitle}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #94a3b8;"><strong>Error:</strong></td>
          <td style="padding: 8px 0; color: #ef4444; font-family: monospace; background: #1e293b; padding: 8px; border-radius: 6px;">${data.error}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #94a3b8;"><strong>Time:</strong></td>
          <td style="padding: 8px 0; color: #94a3b8;">${dateStr}</td>
        </tr>
      </table>
      <div style="text-align: center; margin-top: 24px;">
        <a href="${data.productUrl}" style="background-color: #059669; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">View Store Page</a>
      </div>
    </div>
  `;

  const textBody = `
⚠️ SCRAPER EXTRACTION FAILURE ALERT
----------------------------------
Platform: ${data.platform.toUpperCase()}
Product: ${data.productTitle}
Error: ${data.error}
Attempts: ${data.retryAttempts || 2}
Time: ${dateStr}
URL: ${data.productUrl}
  `.trim();

  try {
    const apiKey = process.env.APPSCRIPT_API_KEY;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'scraper_failure',
        apiKey,
        to: recipient,
        subject,
        htmlBody,
        textBody,
      }),
      redirect: 'follow',
    });

    const result = await res.json();
    return { success: Boolean(result.success), error: result.error };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errMsg };
  }
}

/**
 * Sends a consolidated failure summary email covering all failed items in a single scrape run.
 * Prevents email alert storming when an anti-bot or network block affects dozens of items.
 */
export async function sendScraperBatchFailureSummaryAlert(data: {
  totalFailures: number;
  totalProductsChecked: number;
  byPlatform: Record<string, number>;
  sampleFailures: Array<{ title: string; url: string; platform: string; error: string }>;
  to?: string;
}): Promise<{ success: boolean; error?: string }> {
  const apiUrl = process.env.APPSCRIPT_EMAIL_URL;
  const recipient = data.to || process.env.SCRAPER_ALERT_EMAIL || process.env.APPSCRIPT_TO_EMAIL || getAdminEmail();

  if (!apiUrl) {
    console.warn(`[sendScraperBatchFailureSummaryAlert] APPSCRIPT_EMAIL_URL not set. Summary simulated for ${recipient}: ${data.totalFailures} failures.`);
    return { success: false, error: 'APPSCRIPT_EMAIL_URL is not configured.' };
  }

  const subject = `⚠️ [Scraper Incident] ${data.totalFailures} failures across ${data.totalProductsChecked} active products`;
  const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const platformBreakdownHtml = Object.entries(data.byPlatform)
    .map(([p, count]) => `<li><strong style="text-transform:uppercase;">${p}:</strong> ${count} failure(s)</li>`)
    .join('');

  const samplesHtml = data.sampleFailures
    .slice(0, 5)
    .map(
      (s) => `
      <div style="margin-bottom: 12px; padding: 10px; background: #1e293b; border-radius: 8px;">
        <div style="font-weight: 600; color: #f1f5f9;">${s.title.slice(0, 50)} (${s.platform.toUpperCase()})</div>
        <div style="color: #ef4444; font-family: monospace; font-size: 13px; margin: 4px 0;">${s.error}</div>
        <a href="${s.url}" style="color: #38bdf8; font-size: 12px;">Store Link</a>
      </div>`
    )
    .join('');

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b;">
      <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <h2 style="color: #f87171; margin: 0 0 8px 0; font-size: 18px;">⚠️ Scraper Run Incident Report</h2>
        <p style="margin: 0; color: #cbd5e1; font-size: 14px;">The automated scrape cycle completed with ${data.totalFailures} extraction failure(s) out of ${data.totalProductsChecked} active products checked.</p>
      </div>
      <h3 style="color: #94a3b8; font-size: 15px; margin-bottom: 8px;">Failures by Storefront</h3>
      <ul style="color: #cbd5e1; font-size: 14px; margin-bottom: 20px;">
        ${platformBreakdownHtml}
      </ul>
      <h3 style="color: #94a3b8; font-size: 15px; margin-bottom: 8px;">Sample Failed Items</h3>
      ${samplesHtml}
      <div style="color: #64748b; font-size: 12px; margin-top: 20px;">Generated at: ${dateStr}</div>
    </div>
  `;

  try {
    const apiKey = process.env.APPSCRIPT_API_KEY;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'scraper_failure_summary',
        apiKey,
        to: recipient,
        subject,
        htmlBody,
        textBody: `Scraper Incident: ${data.totalFailures} failures across ${data.totalProductsChecked} products.`,
      }),
    });
    const result = await res.json().catch(() => ({}));
    return { success: res.ok, error: result.error };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Sends watchdog alert when scraping has not run for 3 or more hours
 */
export async function sendScraperStaleAlert(data: {
  hoursSinceLastScrape: number;
  lastScrapedAt: string | null;
  totalActiveProducts: number;
  to?: string;
}): Promise<{ success: boolean; error?: string }> {
  const apiUrl = process.env.APPSCRIPT_EMAIL_URL;
  const recipient = data.to || process.env.SCRAPER_ALERT_EMAIL || process.env.APPSCRIPT_TO_EMAIL || getAdminEmail();

  if (!apiUrl) {
    console.warn(`[sendScraperStaleAlert] APPSCRIPT_EMAIL_URL not set. Stale alert simulated for ${recipient}: ${data.hoursSinceLastScrape}h stale.`);
    return { success: false, error: 'APPSCRIPT_EMAIL_URL is not configured.' };
  }

  const subject = `🚨 [Watchdog Alert] Price Watcher has not scraped for ${data.hoursSinceLastScrape} hours!`;
  const dateStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const lastDateFormatted = data.lastScrapedAt
    ? new Date(data.lastScrapedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    : 'Unknown (never recorded)';

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b;">
      <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <h2 style="color: #fbbf24; margin: 0 0 8px 0; font-size: 18px;">🚨 Scraper Watchdog Alert: Pipeline Stoppage</h2>
        <p style="margin: 0; color: #cbd5e1; font-size: 14px;">The automated price tracker has not performed a price check in over <strong>${data.hoursSinceLastScrape} hours</strong> (threshold: 3 hours).</p>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
        <tr>
          <td style="padding: 8px 0; color: #94a3b8; width: 160px;"><strong>Last Successful Run:</strong></td>
          <td style="padding: 8px 0; color: #f1f5f9;">${lastDateFormatted}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #94a3b8;"><strong>Elapsed Time:</strong></td>
          <td style="padding: 8px 0; color: #fbbf24; font-weight: bold;">${data.hoursSinceLastScrape} hours ago</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #94a3b8;"><strong>Active Products:</strong></td>
          <td style="padding: 8px 0; color: #38bdf8;">${data.totalActiveProducts} items pending checks</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #94a3b8;"><strong>Alert Generated:</strong></td>
          <td style="padding: 8px 0; color: #94a3b8;">${dateStr}</td>
        </tr>
      </table>
      <div style="text-align: center; margin-top: 24px;">
        <a href="https://ecommerce-price-watcher-puce.vercel.app/dashboard" style="background-color: #059669; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Open Dashboard & Trigger Scrape</a>
      </div>
    </div>
  `;

  const textBody = `
🚨 SCRAPER WATCHDOG ALERT: PIPELINE STOPPAGE
-------------------------------------------
Price Watcher has not scraped for: ${data.hoursSinceLastScrape} hours (Limit: 3h)
Last Successful Run: ${lastDateFormatted}
Active Products in Watchlist: ${data.totalActiveProducts}
Alert Generated: ${dateStr}

Open Dashboard to trigger manual scrape:
https://ecommerce-price-watcher-puce.vercel.app/dashboard
  `.trim();

  try {
    const apiKey = process.env.APPSCRIPT_API_KEY;
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'scraper_stale',
        apiKey,
        to: recipient,
        subject,
        htmlBody,
        textBody,
      }),
      redirect: 'follow',
    });

    const result = await res.json();
    return { success: Boolean(result.success), error: result.error };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errMsg };
  }
}

/**
 * Sends rich embed price drop alert via Discord Webhook (100% Free, Unlimited)
 */
export async function sendDiscordAlert(
  webhookUrl: string,
  data: {
    productTitle: string;
    productUrl: string;
    previousPrice: number;
    newPrice: number;
    lowestPrice?: number;
    currency?: string;
    isAllTimeLow?: boolean;
    isBackInStock?: boolean;
    imageUrl?: string;
    platform?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const discountPercent =
      data.previousPrice > data.newPrice
        ? Math.round(((data.previousPrice - data.newPrice) / data.previousPrice) * 100)
        : 0;

    const embedColor = data.isBackInStock ? 0x10b981 : data.isAllTimeLow ? 0xf59e0b : 0x06b6d4;
    const titleEmoji = data.isBackInStock
      ? '📦 Back in Stock!'
      : data.isAllTimeLow
      ? '🔥 All-Time Low Price!'
      : '📉 Price Drop Alert!';

    const payload = {
      username: 'PriceWatcher',
      avatar_url: 'https://ecommerce-price-watcher-puce.vercel.app/icon-192.png',
      embeds: [
        {
          title: `${titleEmoji} ${data.productTitle.slice(0, 100)}`,
          url: data.productUrl,
          color: embedColor,
          description: data.isBackInStock
            ? `Product is back in stock at **₹${data.newPrice.toLocaleString('en-IN')}**!`
            : `Price reduced by **${discountPercent}% OFF**! Now **₹${data.newPrice.toLocaleString('en-IN')}** (was ~~₹${data.previousPrice.toLocaleString('en-IN')}~~).`,
          fields: [
            {
              name: '💰 Current Price',
              value: `₹${data.newPrice.toLocaleString('en-IN')}`,
              inline: true,
            },
            {
              name: '🏷️ Old Price',
              value: `₹${data.previousPrice.toLocaleString('en-IN')}`,
              inline: true,
            },
            {
              name: '🏆 All-Time Low',
              value: data.lowestPrice ? `₹${data.lowestPrice.toLocaleString('en-IN')}` : 'Yes!',
              inline: true,
            },
          ],
          thumbnail: data.imageUrl ? { url: data.imageUrl } : undefined,
          footer: {
            text: `Store: ${(data.platform || 'Store').toUpperCase()} • PriceWatcher`,
          },
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Discord Webhook returned status ${res.status}: ${errText}` };
    }

    return { success: true };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errMsg };
  }
}

/**
 * Sends instant push notification via ntfy.sh (100% Free, Zero Signup)
 */
export async function sendNtfyAlert(
  topic: string,
  data: {
    productTitle: string;
    productUrl: string;
    previousPrice: number;
    newPrice: number;
    lowestPrice?: number;
    isAllTimeLow?: boolean;
    isBackInStock?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const cleanTopic = topic.trim().replace(/^https?:\/\/ntfy\.sh\//, '');
    const discountPercent =
      data.previousPrice > data.newPrice
        ? Math.round(((data.previousPrice - data.newPrice) / data.previousPrice) * 100)
        : 0;

    const title = data.isBackInStock
      ? `📦 Back in Stock: ${data.productTitle.slice(0, 40)}`
      : data.isAllTimeLow
      ? `🔥 All-Time Low: ${data.productTitle.slice(0, 40)}`
      : `📉 Price Drop (${discountPercent}% OFF): ${data.productTitle.slice(0, 40)}`;

    const message = `Now ₹${data.newPrice.toLocaleString('en-IN')} (was ₹${data.previousPrice.toLocaleString('en-IN')}). Tap to view product.`;

    const res = await fetch(`https://ntfy.sh/${cleanTopic}`, {
      method: 'POST',
      headers: {
        Title: title,
        Priority: 'high',
        Tags: data.isAllTimeLow ? 'fire,tada,moneybag' : 'chart_with_downwards_trend,moneybag',
        Click: data.productUrl,
      },
      body: message,
    });

    if (!res.ok) {
      return { success: false, error: `ntfy.sh returned status ${res.status}` };
    }

    return { success: true };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errMsg };
  }
}

function parseRecipients(val?: string | null): string[] {
  if (!val) return [];
  return val
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Dispatches notification to all configured channels & multiple accounts
 * (Telegram, WhatsApp, Email, Discord Webhooks, ntfy.sh)
 */
export async function dispatchAlerts(
  settings: {
    telegram_chat_id?: string | null;
    whatsapp_phone?: string | null;
    whatsapp_apikey?: string | null;
    email?: string | null;
    discord_webhook?: string | null;
    ntfy_topic?: string | null;
  },
  alertData: {
    productTitle: string;
    productUrl: string;
    previousPrice: number;
    newPrice: number;
    lowestPrice: number;
    currency?: string;
    isAllTimeLow: boolean;
    isBackInStock?: boolean;
    imageUrl?: string;
    platform?: string;
  }
): Promise<{ dispatched: number; errors: string[] }> {
  let dispatched = 0;
  const errors: string[] = [];

  // 1. Telegram Alerts (supports multiple comma/newline separated chat IDs)
  const telegramIds = parseRecipients(settings.telegram_chat_id);
  for (const chatId of telegramIds) {
    const res = await sendTelegramAlert({
      chatId,
      productTitle: alertData.productTitle,
      productUrl: alertData.productUrl,
      previousPrice: alertData.previousPrice,
      newPrice: alertData.newPrice,
      lowestPrice: alertData.lowestPrice,
      currency: alertData.currency || 'INR',
      isAllTimeLow: alertData.isAllTimeLow,
      isBackInStock: alertData.isBackInStock,
    });
    if (res.success) dispatched++;
    else if (res.error) errors.push(`Telegram (${chatId}): ${res.error}`);
  }

  // 2. WhatsApp Alerts (CallMeBot - supports multiple comma-separated phone numbers)
  if (settings.whatsapp_apikey) {
    const phones = parseRecipients(settings.whatsapp_phone);
    for (const phone of phones) {
      const res = await sendWhatsAppAlert({
        phone,
        apiKey: settings.whatsapp_apikey,
        productTitle: alertData.productTitle,
        productUrl: alertData.productUrl,
        previousPrice: alertData.previousPrice,
        newPrice: alertData.newPrice,
        currency: alertData.currency || 'INR',
        isAllTimeLow: alertData.isAllTimeLow,
        isBackInStock: alertData.isBackInStock,
      });
      if (res.success) dispatched++;
      else if (res.error) errors.push(`WhatsApp (${phone}): ${res.error}`);
    }
  }

  // 3. Email Alerts via Apps Script (supports multiple emails)
  const emails = parseRecipients(settings.email);
  for (const email of emails) {
    const res = await sendEmailAlert({
      to: email,
      productTitle: alertData.productTitle,
      productUrl: alertData.productUrl,
      previousPrice: alertData.previousPrice,
      newPrice: alertData.newPrice,
      lowestPrice: alertData.lowestPrice,
      currency: alertData.currency || 'INR',
      isAllTimeLow: alertData.isAllTimeLow,
      isBackInStock: alertData.isBackInStock,
      imageUrl: alertData.imageUrl,
      platform: alertData.platform,
    });
    if (res.success) dispatched++;
    else if (res.error) errors.push(`Email (${email}): ${res.error}`);
  }

  // 4. Discord Webhook Alerts (supports multiple webhooks)
  const webhooks = parseRecipients(settings.discord_webhook);
  for (const webhookUrl of webhooks) {
    const res = await sendDiscordAlert(webhookUrl, {
      productTitle: alertData.productTitle,
      productUrl: alertData.productUrl,
      previousPrice: alertData.previousPrice,
      newPrice: alertData.newPrice,
      lowestPrice: alertData.lowestPrice,
      currency: alertData.currency || 'INR',
      isAllTimeLow: alertData.isAllTimeLow,
      isBackInStock: alertData.isBackInStock,
      imageUrl: alertData.imageUrl,
      platform: alertData.platform,
    });
    if (res.success) dispatched++;
    else if (res.error) errors.push(`Discord: ${res.error}`);
  }

  // 5. ntfy.sh Push Alerts (supports multiple topics)
  const ntfyTopics = parseRecipients(settings.ntfy_topic);
  for (const topic of ntfyTopics) {
    const res = await sendNtfyAlert(topic, {
      productTitle: alertData.productTitle,
      productUrl: alertData.productUrl,
      previousPrice: alertData.previousPrice,
      newPrice: alertData.newPrice,
      lowestPrice: alertData.lowestPrice,
      isAllTimeLow: alertData.isAllTimeLow,
      isBackInStock: alertData.isBackInStock,
    });
    if (res.success) dispatched++;
    else if (res.error) errors.push(`ntfy (${topic}): ${res.error}`);
  }

  return { dispatched, errors };
}

/**
 * Queues a failed or pending notification delivery into notification_outbox for guaranteed retry
 */
export async function queueNotificationOutbox(
  supabaseClient: any,
  params: {
    alertEventId?: string | null;
    channel: 'telegram' | 'whatsapp' | 'email' | 'discord' | 'ntfy' | 'web_push';
    recipient: string;
    payload: Record<string, unknown>;
    error?: string;
  }
) {
  if (!supabaseClient) return;
  try {
    await supabaseClient.from('notification_outbox').insert({
      alert_event_id: params.alertEventId || null,
      channel: params.channel,
      recipient: params.recipient,
      payload: params.payload,
      status: 'pending',
      attempts: 1,
      last_error: params.error || null,
      last_attempt_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[notification_outbox] Queue insertion notice:', e);
  }
}

/**
 * Retries all pending and failed notifications from notification_outbox with exponential backoff
 */
export async function processNotificationOutbox(
  supabaseClient: any
): Promise<{ retried: number; recovered: number; abandoned: number }> {
  if (!supabaseClient) return { retried: 0, recovered: 0, abandoned: 0 };
  let retried = 0;
  let recovered = 0;
  let abandoned = 0;

  try {
    const { data: pendingItems, error } = await supabaseClient
      .from('notification_outbox')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lt('attempts', 3)
      .order('created_at', { ascending: true })
      .limit(20);

    if (error || !pendingItems || pendingItems.length === 0) {
      return { retried, recovered, abandoned };
    }

    for (const item of pendingItems) {
      retried++;
      const payload = item.payload;
      let res: { success: boolean; error?: string } = { success: false, error: 'Unknown channel' };

      if (item.channel === 'telegram') {
        res = await sendTelegramAlert({
          chatId: item.recipient,
          productTitle: payload.productTitle,
          productUrl: payload.productUrl,
          previousPrice: payload.previousPrice,
          newPrice: payload.newPrice,
          lowestPrice: payload.lowestPrice,
          currency: payload.currency,
          isAllTimeLow: payload.isAllTimeLow,
          isBackInStock: payload.isBackInStock,
        });
      } else if (item.channel === 'whatsapp' && payload.apiKey) {
        res = await sendWhatsAppAlert({
          phone: item.recipient,
          apiKey: payload.apiKey,
          productTitle: payload.productTitle,
          productUrl: payload.productUrl,
          previousPrice: payload.previousPrice,
          newPrice: payload.newPrice,
          currency: payload.currency,
          isAllTimeLow: payload.isAllTimeLow,
          isBackInStock: payload.isBackInStock,
        });
      } else if (item.channel === 'email') {
        res = await sendEmailAlert({
          to: item.recipient,
          productTitle: payload.productTitle,
          productUrl: payload.productUrl,
          previousPrice: payload.previousPrice,
          newPrice: payload.newPrice,
          lowestPrice: payload.lowestPrice,
          currency: payload.currency,
          isAllTimeLow: payload.isAllTimeLow,
          isBackInStock: payload.isBackInStock,
          imageUrl: payload.imageUrl,
          platform: payload.platform,
        });
      } else if (item.channel === 'discord') {
        res = await sendDiscordAlert(item.recipient, payload as any);
      } else if (item.channel === 'ntfy') {
        res = await sendNtfyAlert(item.recipient, payload as any);
      }

      const nextAttempts = (item.attempts || 0) + 1;
      const nowIso = new Date().toISOString();

      if (res.success) {
        recovered++;
        await supabaseClient
          .from('notification_outbox')
          .update({
            status: 'sent',
            sent_at: nowIso,
            last_attempt_at: nowIso,
            attempts: nextAttempts,
            last_error: null,
          })
          .eq('id', item.id);
      } else {
        const isMaxed = nextAttempts >= (item.max_attempts || 3);
        if (isMaxed) abandoned++;
        await supabaseClient
          .from('notification_outbox')
          .update({
            status: isMaxed ? 'abandoned' : 'failed',
            last_attempt_at: nowIso,
            attempts: nextAttempts,
            last_error: res.error || 'Retry attempt failed',
          })
          .eq('id', item.id);
      }
    }
  } catch (err) {
    console.warn('[notification_outbox] Process outbox notice:', err);
  }

  return { retried, recovered, abandoned };
}
