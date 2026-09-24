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
