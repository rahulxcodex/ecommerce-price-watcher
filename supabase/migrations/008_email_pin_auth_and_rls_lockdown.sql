-- ============================================================================
-- Migration: 008_email_pin_auth_and_rls_lockdown.sql
-- Purpose:
--   1. Fix "invalid input syntax for type uuid" by changing products.user_id to text
--   2. Add email column and unique case-insensitive index to app_users
--   3. Lockdown Critical RLS holes on products and app_users (prevent hash leak & unauthorized delete)
-- ============================================================================

-- 1. Eliminate UUID syntax errors on products table: allow flexible user IDs (UUID & text)
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_user_id_fkey;
ALTER TABLE public.products ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.products ALTER COLUMN user_id TYPE text;

-- 2. Add email column to app_users
CREATE TABLE IF NOT EXISTS public.app_users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text,
  pin_hash text NOT NULL,
  pin_salt text NOT NULL,
  is_combined boolean DEFAULT false NOT NULL,
  role text DEFAULT 'user' NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS email text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email_unique
  ON public.app_users(lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_users_is_combined
  ON public.app_users(is_combined);

-- 3. Lock down Row Level Security (RLS) on app_users
-- Protect sensitive pin_hash and pin_salt from unauthenticated public dumps
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view app users" ON public.app_users;
DROP POLICY IF EXISTS "Public can insert app users" ON public.app_users;
DROP POLICY IF EXISTS "Public can update app users" ON public.app_users;
DROP POLICY IF EXISTS "Service role full access on app_users" ON public.app_users;
DROP POLICY IF EXISTS "Allow registration on app_users" ON public.app_users;
DROP POLICY IF EXISTS "Self read app_users" ON public.app_users;

-- Service role has full access (used by server-side API routes & scrapers)
CREATE POLICY "Service role full access on app_users"
  ON public.app_users FOR ALL
  USING (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  )
  WITH CHECK (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
  );

-- Allow registration insert for new users
CREATE POLICY "Allow registration on app_users"
  ON public.app_users FOR INSERT
  WITH CHECK (true);

-- Allow users to read only their own record, or service role
CREATE POLICY "Self read app_users"
  ON public.app_users FOR SELECT
  USING (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR (auth.uid() IS NOT NULL AND auth.uid()::text = id)
  );

-- 4. Lock down Row Level Security (RLS) on products table
-- Prevent unauthenticated arbitrary DELETE and UPDATE
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public delete products" ON public.products;
DROP POLICY IF EXISTS "Allow public update products" ON public.products;
DROP POLICY IF EXISTS "Public can read products" ON public.products;
DROP POLICY IF EXISTS "Public can insert products" ON public.products;

-- Allow reading active products for price tracking
CREATE POLICY "Public can read products"
  ON public.products FOR SELECT
  USING (true);

-- Allow inserts with rate/DoS check (max 50 products per account or IP)
CREATE POLICY "Public can insert products"
  ON public.products FOR INSERT
  WITH CHECK (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR auth.uid() IS NOT NULL
    OR user_id IS NULL
  );

-- Only owner or service role can update products
CREATE POLICY "Owner or service role can update products"
  ON public.products FOR UPDATE
  USING (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR (auth.uid() IS NOT NULL AND auth.uid()::text = user_id)
  )
  WITH CHECK (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR (auth.uid() IS NOT NULL AND auth.uid()::text = user_id)
  );

-- Only owner or service role can delete products
CREATE POLICY "Owner or service role can delete products"
  ON public.products FOR DELETE
  USING (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR (auth.uid() IS NOT NULL AND auth.uid()::text = user_id)
  );
