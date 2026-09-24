-- ============================================================================
-- Migration: 007_add_pin_auth.sql
-- Purpose: PIN-based authentication & Special Combined Access for Rahul & Nishaa
-- ============================================================================

-- 1. Create app_users table for PIN-based accounts
CREATE TABLE IF NOT EXISTS public.app_users (
  id text PRIMARY KEY,
  name text NOT NULL,
  pin_hash text NOT NULL,
  pin_salt text NOT NULL,
  is_combined boolean DEFAULT false NOT NULL,
  role text DEFAULT 'user' NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for combined access queries
CREATE INDEX IF NOT EXISTS idx_app_users_is_combined ON public.app_users(is_combined);

-- 2. Add creator attribution to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS created_by_name text;

-- 3. Row Level Security
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view app users" ON public.app_users;
CREATE POLICY "Public can view app users"
  ON public.app_users FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public can insert app users" ON public.app_users;
CREATE POLICY "Public can insert app users"
  ON public.app_users FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update app users" ON public.app_users;
CREATE POLICY "Public can update app users"
  ON public.app_users FOR UPDATE
  USING (true)
  WITH CHECK (true);
