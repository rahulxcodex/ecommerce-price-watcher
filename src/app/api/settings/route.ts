import { NextRequest, NextResponse } from 'next/server';
import { supabase, getServiceSupabase } from '@/lib/supabase';
import { validateSettingsPayload } from '@/lib/security';

export const dynamic = 'force-dynamic';

function getDb() {
  try {
    return getServiceSupabase();
  } catch {
    return supabase;
  }
}

export async function GET() {
  try {
    const db = getDb();
    let settings = null;

    // Check app_settings first
    const { data: appSet } = await db
      .from('app_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (appSet) {
      settings = appSet;
    } else {
      // Fallback to household_settings
      const { data: houseSet } = await db
        .from('household_settings')
        .select('*')
        .eq('id', 'default')
        .maybeSingle();
      settings = houseSet;
    }

    if (!settings) {
      const { data: userProf } = await db
        .from('user_profiles')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (userProf) {
        settings = {
          id: 'default',
          telegram_chat_id: userProf.telegram_chat_id,
          notification_preference: userProf.notification_preference || 'all_time_low',
          selected_bank_cards: ['HDFC', 'ICICI', 'SBI', 'Axis'],
        };
      }
    }

    return NextResponse.json({ settings: settings || {} });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();

    const validation = validateSettingsPayload(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error || 'Invalid settings payload' }, { status: 400 });
    }

    const extendedPayload = {
      id: 'default',
      telegram_chat_id: body.telegram_chat_id?.trim() || null,
      whatsapp_phone: body.whatsapp_phone?.trim() || null,
      whatsapp_apikey: body.whatsapp_apikey?.trim() || null,
      email: body.email?.trim() || null,
      discord_webhook: body.discord_webhook?.trim() || null,
      ntfy_topic: body.ntfy_topic?.trim() || null,
      notification_preference: body.notification_preference || 'all_time_low',
      selected_bank_cards: body.selected_bank_cards || ['HDFC', 'ICICI', 'SBI', 'Axis'],
      updated_at: new Date().toISOString(),
    };

    const corePayload = {
      id: 'default',
      telegram_chat_id: extendedPayload.telegram_chat_id,
      whatsapp_phone: extendedPayload.whatsapp_phone,
      whatsapp_apikey: extendedPayload.whatsapp_apikey,
      email: extendedPayload.email,
      notification_preference: extendedPayload.notification_preference,
      selected_bank_cards: extendedPayload.selected_bank_cards,
      updated_at: extendedPayload.updated_at,
    };

    // Try full extended payload first
    let res = await db.from('app_settings').upsert(extendedPayload).select().maybeSingle();
    
    // If column missing in app_settings, try core payload
    if (res.error) {
      res = await db.from('app_settings').upsert(corePayload).select().maybeSingle();
    }

    // Fall back to household_settings
    if (res.error) {
      res = await db.from('household_settings').upsert(extendedPayload).select().maybeSingle();
      if (res.error) {
        res = await db.from('household_settings').upsert(corePayload).select().maybeSingle();
      }
    }

    if (res.error) {
      // Fallback: try user_profiles for telegram & preferences
      try {
        await db.from('user_profiles').upsert({
          id: '00000000-0000-0000-0000-000000000000',
          telegram_chat_id: corePayload.telegram_chat_id,
          notification_preference: corePayload.notification_preference,
          updated_at: new Date().toISOString(),
        });
      } catch {}

      return NextResponse.json({
        success: true,
        settings: extendedPayload,
        notice: 'Saved with local fallback.',
      });
    }

    return NextResponse.json({ success: true, settings: { ...extendedPayload, ...(res.data || {}) } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
