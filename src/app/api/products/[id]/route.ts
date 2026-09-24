import { NextRequest, NextResponse } from 'next/server';
import { supabase, getServiceSupabase } from '@/lib/supabase';
import { AUTH_COOKIE_NAME, verifySessionToken, SessionPayload } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getDb() {
  try {
    return getServiceSupabase();
  } catch {
    return supabase;
  }
}

/**
 * Authorizes a session against a product entity.
 * Access is granted if:
 * 1. User has special combined access space (isCombined === true)
 * 2. User is the explicit owner by userId
 * 3. User is the creator by matching attribution name
 */
function isAuthorizedForProduct(session: SessionPayload | null, product: { user_id?: string | null; created_by_name?: string | null }): boolean {
  if (!session) return false;
  if (session.isCombined) return true;
  if (product.user_id && session.userId && product.user_id === session.userId) return true;
  if (product.created_by_name && session.name && product.created_by_name.toLowerCase() === session.name.toLowerCase()) return true;
  return false;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = verifySessionToken(token || '');
    if (!session) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const db = getDb();
    const id = params.id;

    // Fetch product
    const { data: product, error: prodErr } = await db
      .from('products')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (prodErr || !product) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    // Verify application-level ownership
    if (!isAuthorizedForProduct(session, product)) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to view this product.' }, { status: 403 });
    }

    // Fetch price history
    const { data: history, error: histErr } = await db
      .from('price_history')
      .select('*')
      .eq('product_id', id)
      .order('recorded_at', { ascending: true });

    if (histErr) {
      console.error('[API products/:id GET] Failed to fetch price history:', histErr);
      return NextResponse.json({ error: 'Failed to retrieve price history.' }, { status: 500 });
    }

    return NextResponse.json({ product, history: history || [] });
  } catch (err: unknown) {
    console.error('[API products/:id GET] Unexpected error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred while retrieving product details.' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = verifySessionToken(token || '');
    if (!session) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const db = getDb();
    const id = params.id;

    // Fetch existing product to verify authorization
    const { data: existing, error: fetchErr } = await db
      .from('products')
      .select('id, user_id, created_by_name')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    if (!isAuthorizedForProduct(session, existing)) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to modify this product.' }, { status: 403 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.is_active === 'boolean') {
      updates.is_active = body.is_active;
    }

    if (body.target_price !== undefined) {
      const target = body.target_price === null ? null : Number(body.target_price);
      if (target !== null && (isNaN(target) || target < 0)) {
        return NextResponse.json({ error: 'Target price must be a positive number.' }, { status: 400 });
      }
      updates.target_price = target;
    }

    updates.updated_at = new Date().toISOString();

    const { data: updated, error } = await db
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[API products/:id PATCH] Update failure:', error);
      return NextResponse.json({ error: 'Failed to update product settings.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, product: updated });
  } catch (err: unknown) {
    console.error('[API products/:id PATCH] Unexpected error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred while updating product.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = verifySessionToken(token || '');
    if (!session) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const db = getDb();
    const id = params.id;

    // Fetch existing product to verify authorization
    const { data: existing, error: fetchErr } = await db
      .from('products')
      .select('id, user_id, created_by_name')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    if (!isAuthorizedForProduct(session, existing)) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to delete this product.' }, { status: 403 });
    }

    // Delete product (cascades to price_history and alert_events)
    const { error } = await db
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[API products/:id DELETE] Deletion failure:', error);
      return NextResponse.json({ error: 'Failed to delete product.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Product untracked successfully.' });
  } catch (err: unknown) {
    console.error('[API products/:id DELETE] Unexpected error:', err);
    return NextResponse.json({ error: 'An unexpected error occurred while deleting product.' }, { status: 500 });
  }
}
