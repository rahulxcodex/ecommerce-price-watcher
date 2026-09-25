import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, verifySessionToken, resolveUserRole } from '@/lib/auth';
import { getUserById, isServerlessProduction } from '@/lib/auth-db';

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

    // Refresh authoritative user state from database
    const dbUser = await getUserById(payload.userId);

    if (dbUser) {
      // Authoritative DB state with dynamic role and email fallback from verified token
      const effectiveEmail = dbUser.email || payload.email;
      const { isCombined, role } = resolveUserRole(dbUser.name || payload.name, effectiveEmail);
      dbUser.email = effectiveEmail;
      dbUser.isCombined = isCombined;
      dbUser.role = role;
      return NextResponse.json({ user: dbUser });
    }

    // Gracefully fall back to cryptographically verified session token claims
    // (Prevents session loss and Scrape All button vanishing during transient DB cold-starts)
    const resolved = resolveUserRole(payload.name, payload.email);
    return NextResponse.json({
      user: {
        id: payload.userId,
        name: payload.name,
        email: payload.email,
        isCombined: resolved.isCombined,
        role: resolved.role,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg, user: null }, { status: 500 });
  }
}
