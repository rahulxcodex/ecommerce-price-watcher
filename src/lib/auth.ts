import crypto from 'crypto';

export interface AuthUser {
  id: string;
  name: string;
  isCombined: boolean;
  role: 'combined' | 'user';
  createdAt?: string;
}

export interface SessionPayload {
  userId: string;
  name: string;
  isCombined: boolean;
  role: 'combined' | 'user';
  iat: number;
  exp: number;
}

export const AUTH_COOKIE_NAME = 'pw_session_token';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

// Secret key for HMAC signing session tokens
function getAuthSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'pricewatcher-secure-session-salt-default-key-32b'
  );
}

/**
 * Determine if a user's name qualifies for special combined access (Rahul and Nishaa)
 */
export function isCombinedAccount(name: string): boolean {
  if (!name) return false;
  const normalized = name.trim().toLowerCase();
  // Matches "Rahul", "Rahul Gupta", "Rahul Sah", "Nishaa", "Nisha", "Nishaa Gupta", etc.
  return (
    normalized.includes('rahul') ||
    normalized.includes('nisha') ||
    normalized === 'me'
  );
}

/**
 * Generate cryptographic random salt
 */
export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Hash a 4-digit PIN with a salt using SHA-256
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
 * Verify and parse a signed session token
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

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payloadJson = Buffer.from(payloadEncoded, 'base64url').toString('utf8');
    const payload: SessionPayload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}
