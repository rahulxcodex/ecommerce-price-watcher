import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
} from '@/lib/auth';
import { authenticateByEmailAndPin } from '@/lib/auth-db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, pin } = body;

    // Validate email
    if (
      !email ||
      typeof email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    // Validate PIN (4 to 6 numeric digits)
    if (!pin || typeof pin !== 'string' || !/^\d{4,6}$/.test(pin.trim())) {
      return NextResponse.json(
        { error: 'Please enter your 4-6 digit numeric PIN.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPin = pin.trim();

    // Authenticate by Email and PIN
    const result = await authenticateByEmailAndPin(cleanEmail, cleanPin);
    if (!result.user) {
      return NextResponse.json(
        {
          error:
            result.error ||
            'Invalid credentials. Please verify your email and PIN or create a new account.',
        },
        { status: 401 }
      );
    }

    const user = result.user;
    const token = createSessionToken(user);

    const res = NextResponse.json({
      success: true,
      user,
      message: user.isCombined
        ? `Welcome back ${user.name}! Combined Access space loaded.`
        : `Welcome back ${user.name}!`,
    });

    // Set secure server-side HTTP-only cookie
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
    console.error('Error during signin:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred during signin.' },
      { status: 500 }
    );
  }
}
