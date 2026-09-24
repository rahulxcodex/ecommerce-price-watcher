import { NextResponse } from 'next/server';
import { sendWebPushToAll } from '@/lib/web-push';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const res = await sendWebPushToAll({
      title: '🔔 PriceWatcher Push Verified',
      body: 'In-browser instant notifications are working smoothly!',
      url: '/settings',
    });

    if (res.success === 0 && res.failed === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active push subscriptions found. Please enable Web Push on this device first.',
      });
    }

    return NextResponse.json({
      success: true,
      delivered: res.success,
      failed: res.failed,
      message: `Delivered test notification to ${res.success} device(s).`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
