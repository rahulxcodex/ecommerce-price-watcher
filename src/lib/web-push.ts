import webpush from 'web-push';
import { supabase, getServiceSupabase } from './supabase';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:alerts@pricewatcher.local';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  } catch (e) {
    console.warn('VAPID setup warning:', e);
  }
} else {
  console.warn(
    'VAPID keys not configured (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY). Web push notifications are disabled.'
  );
}

export interface WebPushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

export async function sendWebPushToAll(payload: WebPushPayload): Promise<{ success: number; failed: number }> {
  let db;
  try {
    db = getServiceSupabase();
  } catch {
    db = supabase;
  }

  const { data: subs, error } = await db.from('push_subscriptions').select('*');
  if (error || !subs || subs.length === 0) {
    return { success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: sub.keys,
      };

      await webpush.sendNotification(
        pushSubscription,
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: payload.url || '/',
          icon: payload.icon || '/icon-192.png',
        })
      );
      success++;
    } catch (err: unknown) {
      failed++;
      // If subscription has expired or unsubscribed (HTTP 410 / 404), clean it up
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await db.from('push_subscriptions').delete().eq('id', sub.id);
      }
    }
  }

  return { success, failed };
}
