import { NextRequest, NextResponse } from 'next/server';
import { supabase, getServiceSupabase } from '@/lib/supabase';
import { validatePushEndpoint } from '@/lib/security';

export const dynamic = 'force-dynamic';

function getDb() {
  try {
    return getServiceSupabase();
  } catch {
    return supabase;
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    const body = await req.json();
    const { subscription } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json({ error: 'Valid subscription object is required.' }, { status: 400 });
    }

    const endpointCheck = validatePushEndpoint(subscription.endpoint);
    if (!endpointCheck.valid) {
      return NextResponse.json({ error: endpointCheck.reason || 'Invalid push endpoint.' }, { status: 400 });
    }

    const upsertPayload: Record<string, unknown> = {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    };

    let { data, error } = await db
      .from('push_subscriptions')
      .upsert(upsertPayload, { onConflict: 'endpoint' })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Push subscription save error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, subscription: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
