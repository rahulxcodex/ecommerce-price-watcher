import { NextRequest, NextResponse } from 'next/server';
import { supabase, getServiceSupabase } from '@/lib/supabase';

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

    const payload = {
      id: 'default',
      telegram_chat_id: body.telegram_chat_id?.trim() || null,
      whatsapp_phone: body.whatsapp_phone?.trim() || null,
      whatsapp_apikey: body.whatsapp_apikey?.trim() || null,
      email: body.email?.trim() || null,
      notification_preference: body.notification_preference || 'all_time_low',
      selected_bank_cards: body.selected_bank_cards || ['HDFC', 'ICICI', 'SBI', 'Axis'],
      updated_at: new Date().toISOString(),
    };

    // Try saving to app_settings
    let res = await db.from('app_settings').upsert(payload).select().maybeSingle();
    if (res.error) {
      // Fall back to household_settings table
      res = await db.from('household_settings').upsert(payload).select().maybeSingle();
    }

    if (res.error) {
      return NextResponse.json({ error: res.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, settings: res.data || payload });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
