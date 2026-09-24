import fs from 'fs';
import path from 'path';
import { supabase, getServiceSupabase } from './supabase';
import {
  AuthUser,
  hashPin,
  verifyPin,
  generateSalt,
  isCombinedAccount,
} from './auth';

export interface StoredUser {
  id: string;
  name: string;
  pin_hash: string;
  pin_salt: string;
  is_combined: boolean;
  role: 'combined' | 'user';
  created_at: string;
  updated_at: string;
}

const LOCAL_USERS_FILE = path.join(process.cwd(), 'data', 'users.json');

// Memory cache for fallback
let fallbackUsers: StoredUser[] | null = null;

function loadLocalUsers(): StoredUser[] {
  if (fallbackUsers) return fallbackUsers;
  try {
    if (fs.existsSync(LOCAL_USERS_FILE)) {
      const content = fs.readFileSync(LOCAL_USERS_FILE, 'utf-8');
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
  fallbackUsers = users;
  try {
    const dir = path.dirname(LOCAL_USERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
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
  return {
    id: user.id,
    name: user.name,
    isCombined: Boolean(user.is_combined),
    role: user.role || (user.is_combined ? 'combined' : 'user'),
    createdAt: user.created_at,
  };
}

/**
 * Authenticate a user by 4-digit numeric PIN only.
 * Iterates through active users and verifies the PIN hash.
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
 * Check if a 4-digit PIN is already registered by any user.
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

  const local = loadLocalUsers().find((u) => u.id === id);
  return local ? toAuthUser(local) : null;
}

/**
 * Register a new user with Name and 4-digit PIN.
 * Automatically gives Rahul and Nishaa special combined access!
 */
export async function createUser(params: {
  name: string;
  pin: string;
}): Promise<AuthUser> {
  const { name, pin } = params;
  const isCombined = isCombinedAccount(name);
  const role: 'combined' | 'user' = isCombined ? 'combined' : 'user';
  const salt = generateSalt();
  const hash = hashPin(pin, salt);
  const now = new Date().toISOString();
  const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const newUser: StoredUser = {
    id,
    name: name.trim(),
    pin_hash: hash,
    pin_salt: salt,
    is_combined: isCombined,
    role,
    created_at: now,
    updated_at: now,
  };

  const db = getDbClient();
  let supabaseSaved = false;

  try {
    const { error } = await db.from('app_users').insert({
      id: newUser.id,
      name: newUser.name,
      pin_hash: newUser.pin_hash,
      pin_salt: newUser.pin_salt,
      is_combined: newUser.is_combined,
      role: newUser.role,
      created_at: newUser.created_at,
      updated_at: newUser.updated_at,
    });

    if (!error) {
      supabaseSaved = true;
    }
  } catch {
    // fallback below
  }

  // Always sync to local storage as resilient backup / dev environment
  const currentLocal = loadLocalUsers();
  const existingIdx = currentLocal.findIndex((u) => u.name.toLowerCase() === name.trim().toLowerCase());
  if (existingIdx >= 0) {
    currentLocal[existingIdx] = newUser;
  } else {
    currentLocal.push(newUser);
  }
  saveLocalUsers(currentLocal);

  return toAuthUser(newUser);
}

/**
 * Get all users that belong to the combined group (Rahul and Nishaa)
 */
export async function getCombinedUserIds(): Promise<string[]> {
  const db = getDbClient();
  try {
    const { data, error } = await db
      .from('app_users')
      .select('id, name')
      .eq('is_combined', true);

    if (!error && data && data.length > 0) {
      return data.map((u: { id: string }) => u.id);
    }
  } catch {
    // ignore
  }

  return loadLocalUsers()
    .filter((u) => u.is_combined)
    .map((u) => u.id);
}
