import webpush from 'web-push';
import { supabase, getServiceSupabase } from './supabase';

// Generate default fallback VAPID keys if not present in env
const DEFAULT_VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BDz0PzY-a24hFj4x96U_4gB0rR_R6jK6tFmX_aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV1wX2yZ3aB4cD5eF6g==';
const DEFAULT_VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || 'XyZ1_234567890abcdef1234567890abcdef1234567=';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:alerts@pricewatcher.local';

try {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    DEFAULT_VAPID_PUBLIC,
    DEFAULT_VAPID_PRIVATE
  );
} catch (e) {
  console.warn('VAPID setup warning:', e);
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
