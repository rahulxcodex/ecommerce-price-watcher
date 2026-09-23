interface PriceDropNotification {
  chatId: string;
  productTitle: string;
  productUrl: string;
  previousPrice: number;
  newPrice: number;
  lowestPrice: number;
  currency: string;
  isAllTimeLow: boolean;
}

/**
 * Sends price drop alert via Telegram Bot API
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

  const emoji = data.isAllTimeLow ? '🔥 💥 ALL-TIME LOW PRICE!' : '📉 Price Drop Alert!';

  // Escape special MarkdownV2 characters
  const escapeMarkdown = (text: string) => {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
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
    `💰 Price: ~${escapeMarkdown(formattedOldPrice)}~ ➔ *${escapeMarkdown(formattedNewPrice)}*`,
    discountPercent > 0 ? `🏷️ Save *${discountPercent}% OFF*` : '',
    data.isAllTimeLow ? `🏆 Lowest price ever recorded\\!` : '',
    '',
    `🔗 [Open Product Page](${data.productUrl})`,
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
