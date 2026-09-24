import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
} from '@/lib/auth';
import { authenticateByPin } from '@/lib/auth-db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pin } = body;

    // Validate 4-digit numeric PIN
    if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin.trim())) {
      return NextResponse.json(
        { error: 'Please enter your 4-digit numeric PIN.' },
        { status: 400 }
      );
    }

    const cleanPin = pin.trim();

    // Authenticate by PIN only
    const user = await authenticateByPin(cleanPin);
    if (!user) {
      return NextResponse.json(
        {
          error:
            'Invalid 4-digit PIN. If you have not created an account yet, please sign up.',
        },
        { status: 401 }
      );
    }

    const token = createSessionToken(user);

    const res = NextResponse.json({
      success: true,
      user,
      message: user.isCombined
        ? `Welcome back ${user.name}! Combined Access space loaded.`
        : `Welcome back ${user.name}!`,
    });

    // Set secure server-side HTTP-only cookie (no local session / localStorage)
    res.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
