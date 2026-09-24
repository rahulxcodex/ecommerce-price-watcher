import crypto from 'crypto';

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  isCombined: boolean;
  role: 'combined' | 'user';
  createdAt?: string;
}

export interface SessionPayload {
  userId: string;
  name: string;
  email?: string;
  isCombined: boolean;
  role: 'combined' | 'user';
  iat: number;
  exp: number;
}

export const AUTH_COOKIE_NAME = 'pw_session_token';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

// Secret key for HMAC signing session tokens
function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      'Critical Security Exception: Neither AUTH_SECRET nor SUPABASE_SERVICE_ROLE_KEY is set. ' +
      'Cannot sign or verify session tokens without a securely configured secret key.'
    );
  }
  return secret;
}

export const COMBINED_ACCESS_EMAIL = 'rahulr24g@gmail.com';

/**
 * Determine if a user qualifies for special combined access.
 * Strictly restricted to email rahulr24g@gmail.com.
 * No access is granted by name (even Rahul or Nisha), nor to any other email.
 */
export function isCombinedAccount(nameOrEmail?: string, email?: string): boolean {
  const candidateEmail = email || (nameOrEmail && nameOrEmail.includes('@') ? nameOrEmail : undefined);
  if (!candidateEmail) return false;
  return candidateEmail.trim().toLowerCase() === COMBINED_ACCESS_EMAIL;
}

/**
 * Unified resolver for user role and combined access status.
 * Single source of truth across auth.ts, auth-db.ts, and session routes to prevent drift.
 */
export function resolveUserRole(nameOrEmail?: string, email?: string): {
  isCombined: boolean;
  role: 'combined' | 'user';
} {
  const isCombined = isCombinedAccount(nameOrEmail, email);
  return {
    isCombined,
    role: isCombined ? 'combined' : 'user',
  };
}

/**
 * Generate cryptographic random salt
 */
export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Hash a PIN with a salt using SHA-256
 */
export function hashPin(pin: string, salt: string): string {
  return crypto
    .createHmac('sha256', salt)
    .update(pin)
    .digest('hex');
}

/**
 * Constant-time comparison of pin hashes
 */
export function verifyPin(pin: string, salt: string, storedHash: string): boolean {
  const hash = hashPin(pin, salt);
  const hashBuffer = Buffer.from(hash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');
  if (hashBuffer.length !== storedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(hashBuffer, storedBuffer);
}

/**
 * Create a signed, stateless session token
 */
export function createSessionToken(user: AuthUser): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    userId: user.id,
    name: user.name,
    email: user.email,
    isCombined: user.isCombined,
    role: user.role,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };

  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getAuthSecret())
    .update(payloadEncoded)
    .digest('base64url');

  return `${payloadEncoded}.${signature}`;
}

/**
 * Verify and parse a signed session token using constant-time comparison
 */
export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadEncoded, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', getAuthSecret())
    .update(payloadEncoded)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
    return null;
  }

  try {
    const payloadJson = Buffer.from(payloadEncoded, 'base64url').toString('utf8');
    const payload: SessionPayload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    // Enforce strict Combined Access authorization dynamically via unified resolver
    const resolved = resolveUserRole(payload.name, payload.email);
    payload.isCombined = resolved.isCombined;
    payload.role = resolved.role;

    return payload;
  } catch {
    return null;
  }
}
