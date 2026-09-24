import { NextRequest, NextResponse } from 'next/server';
import { supabase, getServiceSupabase } from '@/lib/supabase';
import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getDb() {
  try {
    return getServiceSupabase();
  } catch {
    return supabase;
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = verifySessionToken(token || '');

    const db = getDb();
    let query = db
      .from('search_history')
      .select('id, platform, query, result_count, created_at')
      .order('created_at', { ascending: false })
      .limit(15);

    if (session && !session.isCombined && session.userId) {
      query = query.eq('user_id', session.userId);
    }

    const { data, error } = await query;

    if (error) {
      // Table might not exist yet if migration hasn't been executed
      return NextResponse.json({ success: true, history: [] });
    }

    // Deduplicate by query + platform
    const seen = new Set<string>();
    const uniqueHistory = (data || []).filter((item) => {
      const key = `${item.platform}:${item.query.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({ success: true, history: uniqueHistory });
  } catch (err: unknown) {
    return NextResponse.json({ success: true, history: [] });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = verifySessionToken(token || '');

    const body = await req.json().catch(() => ({}));
    const { id, query: searchQuery } = body;

    const db = getDb();
    let deleteOp = db.from('search_history').delete();

    if (id) {
      deleteOp = deleteOp.eq('id', id);
    } else if (searchQuery) {
      deleteOp = deleteOp.ilike('query', searchQuery);
    } else {
      return NextResponse.json({ success: false, error: 'Target ID or query required' }, { status: 400 });
    }

    if (session && !session.isCombined && session.userId) {
      deleteOp = deleteOp.eq('user_id', session.userId);
    }

    const { error } = await deleteOp;
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 500 }
    );
  }
}
