import { NextRequest, NextResponse } from 'next/server';
import { supabase, getServiceSupabase } from '@/lib/supabase';
import { validatePushEndpoint } from '@/lib/security';
import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

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
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = verifySessionToken(token || '');
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required to register web push subscriptions.' },
        { status: 401 }
      );
    }

    const rateCheck = await checkRateLimit(`rate:push:sub:${session.userId}`, 8, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Too many subscription attempts. Please wait ${rateCheck.retryAfterSeconds} seconds.` },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfterSeconds) } }
      );
    }

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
      user_id: session.userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    };

    const { data, error } = await db
      .from('push_subscriptions')
      .upsert(upsertPayload, { onConflict: 'endpoint' })
      .select()
      .maybeSingle();

    if (error) {
      console.error('[API push/subscribe] Save error:', error);
      return NextResponse.json(
        { error: 'Failed to register push subscription.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, subscription: data });
  } catch (err: unknown) {
    console.error('[API push/subscribe] Unexpected error:', err);
    return NextResponse.json(
      { error: 'An unexpected internal error occurred while saving push subscription.' },
      { status: 500 }
    );
  }
}
