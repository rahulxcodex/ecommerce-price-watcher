import { NextRequest, NextResponse } from 'next/server';
import { safeCompare } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const incomingHeader = req.headers.get('x-telegram-bot-api-secret-token');

    // Security: Verify secret token to prevent spoofed webhook calls
    if (secret && (!incomingHeader || !safeCompare(secret, incomingHeader))) {
      return NextResponse.json({ error: 'Unauthorized webhook request.' }, { status: 401 });
    }

    const body = await req.json();
    const message = body.message;

    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();
    const token = process.env.TELEGRAM_BOT_TOKEN;

    if (!token) {
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith('/start') || text.startsWith('/help')) {
      const reply = [
        '👋 *Welcome to PriceWatcher Bot!*',
        '',
        `Your Telegram Chat ID is: \`${chatId}\``,
        '',
        '📌 *How to connect:*',
        '1. Copy the Chat ID above',
        '2. Open your PriceWatcher website -> Go to *Alert Settings*',
        '3. Paste this Chat ID and click *Save*',
        '',
        '🚀 You will now receive instant alerts whenever your tracked Amazon, Flipkart, or Meesho products hit their all-time lowest price!',
      ].join('\n');

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: reply,
          parse_mode: 'Markdown',
        }),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('Telegram webhook error:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
