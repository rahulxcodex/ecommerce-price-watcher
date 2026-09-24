import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { sendTelegramAlert } from '@scripts/notify';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = verifySessionToken(token || '');
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Please sign in to send test notifications.' },
        { status: 401 }
      );
    }

    const { chatId } = await req.json();

    if (!chatId || typeof chatId !== 'string') {
      return NextResponse.json({ error: 'Valid Telegram Chat ID is required.' }, { status: 400 });
    }

    const testRes = await sendTelegramAlert({
      chatId: chatId.trim(),
      productTitle: '🎉 PriceWatcher Test Product (Sony WH-1000XM5)',
      productUrl: 'https://www.amazon.in',
      previousPrice: 29990,
      newPrice: 24990,
      lowestPrice: 24990,
      currency: 'INR',
      isAllTimeLow: true,
    });

    if (!testRes.success) {
      return NextResponse.json({ error: testRes.error || 'Failed to dispatch test notification' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Test alert delivered successfully!' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
