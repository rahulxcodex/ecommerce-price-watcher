import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { supabase, getServiceSupabase } from './supabase';
import {
  AuthUser,
  hashPin,
  verifyPin,
  generateSalt,
  isCombinedAccount,
  resolveUserRole,
} from './auth';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  pin_hash: string;
  pin_salt: string;
  is_combined: boolean;
  role: 'combined' | 'user';
  created_at: string;
  updated_at: string;
}

/**
 * Detect serverless production environment (Vercel, AWS Lambda, or production NODE_ENV).
 * In serverless production, ephemeral local disk (/tmp) is unsafe for stateful persistence.
 */
export function isServerlessProduction(): boolean {
  return Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NODE_ENV === 'production'
  );
}

function getLocalUsersFilePath(): string {
  return path.join(process.cwd(), 'data', 'users.json');
}

// Memory cache for local development/offline test fallback only
let fallbackUsers: StoredUser[] | null = null;

function loadLocalUsers(): StoredUser[] {
  // Never read ephemeral file stores in serverless production
  if (isServerlessProduction()) {
    return [];
  }
  if (fallbackUsers) return fallbackUsers;
  try {
    const filePath = getLocalUsersFilePath();
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      fallbackUsers = JSON.parse(content);
      return fallbackUsers || [];
    }
  } catch (err) {
    console.warn('Failed reading local users file:', err);
  }
  fallbackUsers = [];
  return fallbackUsers;
}

function saveLocalUsers(users: StoredUser[]): void {
  // Never write to ephemeral /tmp in serverless production
  if (isServerlessProduction()) {
    return;
  }
  fallbackUsers = users;
  try {
    const filePath = getLocalUsersFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Atomic write via temp file + rename to prevent corruption
    const tempFile = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(users, null, 2), 'utf-8');
    fs.renameSync(tempFile, filePath);
  } catch (err) {
    console.warn('Failed saving local users file:', err);
  }
}

function getDbClient() {
  try {
    return getServiceSupabase();
  } catch {
    return supabase;
  }
}

function toAuthUser(user: StoredUser): AuthUser {
  const { isCombined, role } = resolveUserRole(user.name, user.email);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isCombined,
    role,
    createdAt: user.created_at,
  };
}

/**
 * Authenticate a user by Email and PIN
 */
export async function authenticateByEmailAndPin(
  email: string,
  pin: string
): Promise<{ user: AuthUser | null; error?: string }> {
  if (!email || !pin) {
    return { user: null, error: 'Email and PIN are required.' };
  }

  const normEmail = email.trim().toLowerCase();
  const db = getDbClient();
  let userRecord: StoredUser | null = null;

  let dbError = false;
  try {
    const { data, error } = await db
      .from('app_users')
      .select('*')
      .ilike('email', normEmail)
      .maybeSingle();

    if (!error && data) {
      userRecord = data as StoredUser;
    } else if (error && (error.message.includes('column') || error.message.includes('schema cache'))) {
      // Schema bridge: fallback to search in name if migration 008 is pending in SQL editor
      const { data: fallbackData } = await db
        .from('app_users')
        .select('*')
        .ilike('name', `%[${normEmail}]%`)
        .maybeSingle();
      if (fallbackData) {
        userRecord = {
          ...fallbackData,
          name: fallbackData.name.replace(/\s*\[.*?\]$/, ''),
          email: normEmail,
        } as StoredUser;
      }
    } else if (error) {
      dbError = true;
    }
  } catch {
    dbError = true;
  }

  if (isServerlessProduction() && dbError && !userRecord) {
    return { user: null, error: 'Database service temporarily unavailable. Please try again shortly.' };
  }

  if (!userRecord && !isServerlessProduction()) {
    const local = loadLocalUsers().find((u) => (u.email || '').toLowerCase() === normEmail);
    if (local) {
      userRecord = local;
    }
  }

  if (!userRecord) {
    return { user: null, error: 'No account found with this email address.' };
  }

  if (!verifyPin(pin, userRecord.pin_salt, userRecord.pin_hash)) {
    return { user: null, error: 'Incorrect PIN. Please try again.' };
  }

  const authUser = toAuthUser(userRecord);
  if (userRecord.is_combined !== authUser.isCombined) {
    userRecord.is_combined = authUser.isCombined;
    userRecord.role = authUser.role;
    try {
      await db
        .from('app_users')
        .update({ is_combined: authUser.isCombined, role: authUser.role })
        .eq('id', userRecord.id);
    } catch {
      // ignore
    }
  }

  return { user: authUser };
}

/**
 * Check if an email address is already registered
 */
export async function isEmailTaken(email: string): Promise<boolean> {
  if (!email) return false;
  const normEmail = email.trim().toLowerCase();
  const db = getDbClient();

  try {
    const { data, error } = await db
      .from('app_users')
      .select('id')
      .ilike('email', normEmail)
      .maybeSingle();

    if (!error && data) {
      return true;
    } else if (error && (error.message.includes('column') || error.message.includes('schema cache'))) {
      const { data: fallbackData } = await db
        .from('app_users')
        .select('id')
        .ilike('name', `%[${normEmail}]%`)
        .maybeSingle();
      if (fallbackData) return true;
    }
  } catch {
    // ignore
  }

  if (!isServerlessProduction()) {
    return loadLocalUsers().some((u) => (u.email || '').toLowerCase() === normEmail);
  }
  return false;
}

/**
 * Legacy: Authenticate a user by PIN only (kept for backward compatibility)
 */
export async function authenticateByPin(pin: string): Promise<AuthUser | null> {
  const db = getDbClient();
  let candidateUsers: StoredUser[] = [];

  try {
    const { data, error } = await db.from('app_users').select('*');
    if (!error && data && data.length > 0) {
      candidateUsers = data as StoredUser[];
    } else {
      candidateUsers = loadLocalUsers();
    }
  } catch {
    candidateUsers = loadLocalUsers();
  }

  for (const user of candidateUsers) {
    if (verifyPin(pin, user.pin_salt, user.pin_hash)) {
      return toAuthUser(user);
    }
  }

  return null;
}

/**
 * Legacy: Check if a PIN is taken
 */
export async function isPinTaken(pin: string): Promise<boolean> {
  const user = await authenticateByPin(pin);
  return user !== null;
}

/**
 * Find user by ID
 */
export async function getUserById(id: string): Promise<AuthUser | null> {
  const db = getDbClient();

  try {
    const { data, error } = await db
      .from('app_users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!error && data) {
      return toAuthUser(data as StoredUser);
    }
  } catch {
    // ignore
  }

  if (!isServerlessProduction()) {
    const local = loadLocalUsers().find((u) => u.id === id);
    return local ? toAuthUser(local) : null;
  }

  return null;
}

/**
 * Register a new user with Name, Email, and PIN.
 * Automatically gives Rahul and Nishaa special combined access!
 * Generates RFC4122 v4 UUID to ensure 100% compatibility with Postgres UUID columns.
 */
export async function createUser(params: {
  name: string;
  email: string;
  pin: string;
}): Promise<AuthUser> {
  const { name, email, pin } = params;
  const normEmail = email.trim().toLowerCase();
  const isCombined = isCombinedAccount(name, normEmail);
  const role: 'combined' | 'user' = isCombined ? 'combined' : 'user';
  const salt = generateSalt();
  const hash = hashPin(pin, salt);
  const now = new Date().toISOString();
  // Valid UUID generation prevents "invalid input syntax for type uuid" in Supabase
  const id = crypto.randomUUID();

  const newUser: StoredUser = {
    id,
    name: name.trim(),
    email: normEmail,
    pin_hash: hash,
    pin_salt: salt,
    is_combined: isCombined,
    role,
    created_at: now,
    updated_at: now,
  };

  const db = getDbClient();

  let persistedToDb = false;
  try {
    const { error: insertErr } = await db.from('app_users').insert({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      pin_hash: newUser.pin_hash,
      pin_salt: newUser.pin_salt,
      is_combined: newUser.is_combined,
      role: newUser.role,
      created_at: newUser.created_at,
      updated_at: newUser.updated_at,
    });

    if (!insertErr) {
      persistedToDb = true;
    } else {
      console.warn('Direct insert into app_users failed, trying schema bridge:', insertErr.message);
      if (insertErr.message.includes('column') || insertErr.message.includes('schema cache')) {
        // Fallback for when migration 008 is pending in SQL editor: store email inside name
        const { error: bridgeErr } = await db.from('app_users').insert({
          id: newUser.id,
          name: `${newUser.name} [${newUser.email}]`,
          pin_hash: newUser.pin_hash,
          pin_salt: newUser.pin_salt,
          is_combined: newUser.is_combined,
          role: newUser.role,
          created_at: newUser.created_at,
          updated_at: newUser.updated_at,
        });
        if (!bridgeErr) {
          persistedToDb = true;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to insert user into Supabase app_users table:', err);
  }

  // In serverless production, Supabase persistence is strictly mandatory.
  if (!persistedToDb && isServerlessProduction()) {
    throw new Error('Database service unavailable. Persistent storage is required to register an account in production.');
  }

  // In non-serverless local development, sync to local storage as backup
  if (!isServerlessProduction()) {
    const currentLocal = loadLocalUsers();
    const existingIdx = currentLocal.findIndex(
      (u) => (u.email || '').toLowerCase() === normEmail || u.id === id
    );
    if (existingIdx >= 0) {
      currentLocal[existingIdx] = newUser;
    } else {
      currentLocal.push(newUser);
    }
    saveLocalUsers(currentLocal);
  }

  return toAuthUser(newUser);
}

/**
 * Get all users that belong to the combined group (strictly rahulr24g@gmail.com)
 */
export async function getCombinedUserIds(): Promise<string[]> {
  const db = getDbClient();
  try {
    const { data, error } = await db
      .from('app_users')
      .select('id, name, email')
      .eq('is_combined', true);

    if (!error && data && data.length > 0) {
      return data
        .filter((u: { id: string; name?: string; email?: string }) => isCombinedAccount(u.name, u.email))
        .map((u: { id: string }) => u.id);
    }
  } catch {
    // ignore
  }

  return loadLocalUsers()
    .filter((u) => isCombinedAccount(u.name, u.email))
    .map((u) => u.id);
}
