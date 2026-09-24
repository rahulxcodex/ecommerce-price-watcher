import { NextRequest, NextResponse } from 'next/server';
import { supabase, getServiceSupabase } from '@/lib/supabase';
import { validateSettingsPayload } from '@/lib/security';
import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { AppSettings } from '@/types';

export const dynamic = 'force-dynamic';

function getDb() {
  try {
    return getServiceSupabase();
  } catch {
    return supabase;
  }
}

const DEFAULT_SETTINGS_PAYLOAD: AppSettings = {
  id: 'default',
  user_id: null,
  telegram_chat_id: '',
  whatsapp_phone: '',
  whatsapp_apikey: '',
  email: '',
  discord_webhook: '',
  ntfy_topic: '',
  notification_preference: 'all_time_low',
  selected_bank_cards: ['HDFC', 'ICICI', 'SBI', 'Axis'],
};

function maskApiKey(key?: string | null): string | null {
  if (!key || key.trim() === '') return null;
  return '••••••••';
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = verifySessionToken(token || '');

    if (!session) {
      return NextResponse.json({ settings: DEFAULT_SETTINGS_PAYLOAD });
    }

    const db = getDb();
    let settings: AppSettings | null = null;

    // 1. Fetch user-scoped settings
    const { data: userSet } = await db
      .from('app_settings')
      .select('*')
      .eq('user_id', session.userId)
      .maybeSingle();

    if (userSet) {
      settings = userSet;
    } else {
      // 2. Fallback to settings row keyed by session.userId as id
      const { data: idSet } = await db
        .from('app_settings')
        .select('*')
        .eq('id', session.userId)
        .maybeSingle();

      if (idSet) {
        settings = idSet;
      } else if (session.isCombined) {
        // 3. Admin / combined access can inspect default settings if no personal row exists
        const { data: defSet } = await db
          .from('app_settings')
          .select('*')
          .eq('id', 'default')
          .maybeSingle();
        settings = defSet;
      }
    }

    const finalSettings = settings || {
      ...DEFAULT_SETTINGS_PAYLOAD,
      user_id: session.userId,
      id: session.userId,
    };

    // Mask sensitive API credentials before returning over the wire
    const safeSettings = {
      ...finalSettings,
      whatsapp_apikey: maskApiKey(finalSettings.whatsapp_apikey),
      discord_webhook: finalSettings.discord_webhook
        ? finalSettings.discord_webhook.replace(/\/[^/]+$/, '/••••••••')
        : null,
    };

    return NextResponse.json({ settings: safeSettings });
  } catch (err: unknown) {
    console.error('[API settings GET] Error fetching settings:', err);
    return NextResponse.json({ error: 'Failed to load settings.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = verifySessionToken(token || '');

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Please sign in to configure notification settings.' },
        { status: 401 }
      );
    }

    const db = getDb();
    const body = await req.json();

    const validation = validateSettingsPayload(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error || 'Invalid settings payload.' }, { status: 400 });
    }

    // Retrieve existing user settings to avoid clobbering unmasked keys when masked bullets are submitted
    const { data: existing } = await db
      .from('app_settings')
      .select('whatsapp_apikey, discord_webhook')
      .or(`user_id.eq.${session.userId},id.eq.${session.userId}`)
      .maybeSingle();

    let resolvedWhatsappApiKey = body.whatsapp_apikey?.trim() || null;
    if (resolvedWhatsappApiKey === '••••••••' && existing?.whatsapp_apikey) {
      resolvedWhatsappApiKey = existing.whatsapp_apikey;
    }

    let resolvedDiscordWebhook = body.discord_webhook?.trim() || null;
    if (resolvedDiscordWebhook && resolvedDiscordWebhook.includes('••••••••') && existing?.discord_webhook) {
      resolvedDiscordWebhook = existing.discord_webhook;
    }

    const rowId = session.userId;
    const userPayload = {
      id: rowId,
      user_id: session.userId,
      telegram_chat_id: body.telegram_chat_id?.trim() || null,
      whatsapp_phone: body.whatsapp_phone?.trim() || null,
      whatsapp_apikey: resolvedWhatsappApiKey,
      email: body.email?.trim() || null,
      discord_webhook: resolvedDiscordWebhook,
      ntfy_topic: body.ntfy_topic?.trim() || null,
      notification_preference: body.notification_preference || 'all_time_low',
      selected_bank_cards: body.selected_bank_cards || ['HDFC', 'ICICI', 'SBI', 'Axis'],
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error } = await db
      .from('app_settings')
      .upsert(userPayload, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (error) {
      console.error('[API settings POST] Save failure:', error);
      return NextResponse.json({ error: 'Failed to save settings.' }, { status: 500 });
    }

    const safeSaved = {
      ...userPayload,
      ...(saved || {}),
      whatsapp_apikey: maskApiKey(resolvedWhatsappApiKey),
      discord_webhook: resolvedDiscordWebhook ? resolvedDiscordWebhook.replace(/\/[^/]+$/, '/••••••••') : null,
    };

    return NextResponse.json({ success: true, settings: safeSaved });
  } catch (err: unknown) {
    console.error('[API settings POST] Unexpected error saving settings:', err);
    return NextResponse.json({ error: 'Failed to update settings.' }, { status: 500 });
  }
}
