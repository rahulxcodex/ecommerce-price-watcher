import { NextRequest, NextResponse } from 'next/server';
import {
  AUTH_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
} from '@/lib/auth';
import { createUser, isPinTaken } from '@/lib/auth-db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, pin } = body;

    // Validate Name
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Please enter a valid name (at least 2 characters).' },
        { status: 400 }
      );
    }

    // Validate 4-digit numeric PIN
    if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin.trim())) {
      return NextResponse.json(
        { error: 'PIN must be exactly 4 numeric digits (e.g. 1234).' },
        { status: 400 }
      );
    }

    const cleanPin = pin.trim();
    const cleanName = name.trim();

    // Verify PIN uniqueness since sign-in is PIN-only
    const taken = await isPinTaken(cleanPin);
    if (taken) {
      return NextResponse.json(
        {
          error:
            'This 4-digit PIN is already assigned to an existing account. Please choose a different PIN or sign in.',
        },
        { status: 409 }
      );
    }

    // Create user (automatically grants special combined access to Rahul and Nishaa)
    const user = await createUser({
      name: cleanName,
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
