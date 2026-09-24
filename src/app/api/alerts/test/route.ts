import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  sendTelegramAlert,
  sendWhatsAppAlert,
  sendEmailAlert,
  sendDiscordAlert,
  sendNtfyAlert,
} from '@scripts/notify';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = verifySessionToken(token || '');
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Please sign in to send test notifications.' },
        { status: 401 }
      );
    }

    // Rate limit: 5 test alerts per 10 minutes (600s) per user account
    const alertLimit = await checkRateLimit(`alert_test:${session.userId}`, 5, 600);
    if (!alertLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Test notification rate limit reached. Please wait ${alertLimit.retryAfterSeconds}s before sending more test alerts.`,
          retryAfter: alertLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(alertLimit.retryAfterSeconds) },
        }
      );
    }

    const body = await req.json();
    const { channel, value, apikey } = body;

    const testProduct = {
      productTitle: 'Sony WH-1000XM5 Wireless Headphones',
      productUrl: 'https://ecommerce-price-watcher-puce.vercel.app',
      previousPrice: 29990,
      newPrice: 19990,
      lowestPrice: 19990,
      currency: 'INR',
      isAllTimeLow: true,
      isBackInStock: false,
      imageUrl: 'https://ecommerce-price-watcher-puce.vercel.app/icon-192.png',
      platform: 'amazon',
    };

    if (channel === 'telegram') {
      if (!value) return NextResponse.json({ success: false, error: 'Telegram Chat ID is required' }, { status: 400 });
      const ids = value.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean);
      const results = [];
      for (const id of ids) {
        const res = await sendTelegramAlert({ ...testProduct, chatId: id });
        results.push({ id, ...res });
      }
      const hasError = results.find((r) => !r.success);
      if (hasError) return NextResponse.json({ success: false, error: hasError.error, details: results });
      return NextResponse.json({ success: true, message: `Telegram alert sent to ${results.length} chat(s)!` });
    }

    if (channel === 'whatsapp') {
      if (!value || !apikey) {
        return NextResponse.json({ success: false, error: 'WhatsApp Phone and CallMeBot API key are required' }, { status: 400 });
      }
      const phones = value.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean);
      const results = [];
      for (const phone of phones) {
        const res = await sendWhatsAppAlert({ ...testProduct, phone, apiKey: apikey });
        results.push({ phone, ...res });
      }
      const hasError = results.find((r) => !r.success);
      if (hasError) return NextResponse.json({ success: false, error: hasError.error, details: results });
      return NextResponse.json({ success: true, message: `WhatsApp alert sent to ${results.length} number(s)!` });
    }

    if (channel === 'email') {
      if (!value) return NextResponse.json({ success: false, error: 'Email address is required' }, { status: 400 });
      const emails = value.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean);
      const results = [];
      for (const email of emails) {
        const res = await sendEmailAlert({ ...testProduct, to: email });
        results.push({ email, ...res });
      }
      const hasError = results.find((r) => !r.success);
      if (hasError) return NextResponse.json({ success: false, error: hasError.error, details: results });
      return NextResponse.json({ success: true, message: `Email alert sent to ${results.length} address(es)!` });
    }

    if (channel === 'discord') {
      if (!value) return NextResponse.json({ success: false, error: 'Discord Webhook URL is required' }, { status: 400 });
      const urls = value.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean);
      const results = [];
      for (const url of urls) {
        const res = await sendDiscordAlert(url, testProduct);
        results.push({ url, ...res });
      }
      const hasError = results.find((r) => !r.success);
      if (hasError) return NextResponse.json({ success: false, error: hasError.error, details: results });
      return NextResponse.json({ success: true, message: `Discord alert sent to ${results.length} webhook(s)!` });
    }

    if (channel === 'ntfy') {
      if (!value) return NextResponse.json({ success: false, error: 'ntfy.sh topic name is required' }, { status: 400 });
      const topics = value.split(/[\n,]+/).map((s: string) => s.trim()).filter(Boolean);
      const results = [];
      for (const topic of topics) {
        const res = await sendNtfyAlert(topic, testProduct);
        results.push({ topic, ...res });
      }
      const hasError = results.find((r) => !r.success);
      if (hasError) return NextResponse.json({ success: false, error: hasError.error, details: results });
      return NextResponse.json({ success: true, message: `ntfy alert sent to ${results.length} topic(s)!` });
    }

    return NextResponse.json({ success: false, error: 'Unknown alert channel requested' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
