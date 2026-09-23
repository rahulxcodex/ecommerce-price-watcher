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

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const id = params.id;

    // Fetch product
    const { data: product, error: prodErr } = await db
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (prodErr || !product) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    // Fetch price history
    const { data: history, error: histErr } = await db
      .from('price_history')
      .select('*')
      .eq('product_id', id)
      .order('recorded_at', { ascending: true });

    if (histErr) {
      return NextResponse.json({ error: histErr.message }, { status: 500 });
    }

    return NextResponse.json({ product, history: history || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const id = params.id;
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, product: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb();
    const id = params.id;

    // Delete product (cascades to price_history)
    const { error } = await db
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Product untracked successfully.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
