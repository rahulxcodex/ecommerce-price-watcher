import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
} from '@/lib/auth';
import { createUser, isEmailTaken } from '@/lib/auth-db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, pin } = body;

    // Validate Name
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Please enter a valid name (at least 2 characters).' },
        { status: 400 }
      );
    }

    // Validate Email
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

    // Validate 4-6 digit numeric PIN
    if (!pin || typeof pin !== 'string' || !/^\d{4,6}$/.test(pin.trim())) {
      return NextResponse.json(
        { error: 'PIN must be 4 to 6 numeric digits (e.g. 1234 or 123456).' },
        { status: 400 }
      );
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPin = pin.trim();

    // Verify Email uniqueness
    const taken = await isEmailTaken(cleanEmail);
    if (taken) {
      return NextResponse.json(
        {
          error:
            'An account with this email address already exists. Please sign in.',
        },
        { status: 409 }
      );
    }

    // Create user (automatically grants special combined access to Rahul and Nishaa)
    const user = await createUser({
      name: cleanName,
      email: cleanEmail,
      pin: cleanPin,
    });

    const token = createSessionToken(user);

    const res = NextResponse.json({
      success: true,
      user,
      message: user.isCombined
        ? `Welcome ${user.name}! Special Combined Access activated for you and your partner.`
        : `Welcome ${user.name}! Your account has been created.`,
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
    console.error('Error during signup:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred during signup.' },
      { status: 500 }
    );
  }
}
