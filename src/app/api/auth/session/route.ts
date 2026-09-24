import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/auth';
import { getUserById } from '@/lib/auth-db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ user: null });
    }

    const payload = verifySessionToken(token);
    if (!payload) {
      return NextResponse.json({ user: null });
    }

    // Refresh from db if needed, or fallback to signed payload
    const user = await getUserById(payload.userId);

    return NextResponse.json({
      user: user || {
        id: payload.userId,
        name: payload.name,
        isCombined: payload.isCombined,
        role: payload.role,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg, user: null }, { status: 500 });
  }
}
