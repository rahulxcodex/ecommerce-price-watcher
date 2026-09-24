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
 * Dispatches notification to all configured channels (Telegram, WhatsApp, Email)
 */
export async function dispatchAlerts(
  settings: {
    telegram_chat_id?: string | null;
    whatsapp_phone?: string | null;
    whatsapp_apikey?: string | null;
    email?: string | null;
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

  // 1. Telegram Alerts
  if (settings.telegram_chat_id) {
    const res = await sendTelegramAlert({
      chatId: settings.telegram_chat_id,
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
    else if (res.error) errors.push(`Telegram (${settings.telegram_chat_id}): ${res.error}`);
  }

  // 2. WhatsApp Alerts
  if (settings.whatsapp_phone && settings.whatsapp_apikey) {
    const res = await sendWhatsAppAlert({
      phone: settings.whatsapp_phone,
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
    else if (res.error) errors.push(`WhatsApp (${settings.whatsapp_phone}): ${res.error}`);
  }

  // 3. Email Alerts via Apps Script
  if (settings.email) {
    const res = await sendEmailAlert({
      to: settings.email,
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
    else if (res.error) errors.push(`Email (${settings.email}): ${res.error}`);
  }

  return { dispatched, errors };
}
