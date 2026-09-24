-- ============================================================================
-- Consolidate All Migrations (002 to 008) for PriceWatcher
-- Paste and run this script in your Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. Support Myntra, Ajio, and Westside in platform_type enum
ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'myntra';
ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'ajio';
ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'westside';

-- 2. Allow tracking without mandatory Supabase Auth user ID and fix UUID mismatch
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_user_id_fkey;
ALTER TABLE public.products ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.products ALTER COLUMN user_id TYPE text;

-- 3. Extend products table with variant metadata, notes, bank offers & creator attribution
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS selected_size text,
  ADD COLUMN IF NOT EXISTS selected_color text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS last_alerted_price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS bank_offers jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by_name text;

-- 4. Create App Settings table (Personal alert configuration)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id text PRIMARY KEY DEFAULT 'default',
  telegram_chat_id text,
  whatsapp_phone text,
  whatsapp_apikey text,
  email text,
  discord_webhook text,
  ntfy_topic text,
  notification_preference text DEFAULT 'all_time_low' CHECK (notification_preference IN ('all_time_low', 'any_drop', 'never')),
  selected_bank_cards jsonb DEFAULT '["HDFC", "ICICI", "SBI", "Axis"]'::jsonb,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Backward compatibility table for household_settings
CREATE TABLE IF NOT EXISTS public.household_settings (
  id text PRIMARY KEY DEFAULT 'default',
  telegram_chat_id text,
  whatsapp_phone text,
  whatsapp_apikey text,
  email text,
  discord_webhook text,
  ntfy_topic text,
  notification_preference text DEFAULT 'all_time_low',
  selected_bank_cards jsonb DEFAULT '["HDFC", "ICICI", "SBI", "Axis"]'::jsonb,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default settings row if not present
INSERT INTO public.app_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.household_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security on settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view app settings" ON public.app_settings;
CREATE POLICY "Public can view app settings" ON public.app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can update app settings" ON public.app_settings;
CREATE POLICY "Public can update app settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view household settings" ON public.household_settings;
CREATE POLICY "Public can view household settings" ON public.household_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can update household settings" ON public.household_settings;
CREATE POLICY "Public can update household settings" ON public.household_settings FOR ALL USING (true) WITH CHECK (true);

-- 5. Support Email + PIN Authentication and Combined Access (Migration 007 & 008)
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

ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS email text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email_unique
  ON public.app_users(lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_users_is_combined ON public.app_users(is_combined);

-- 6. RLS Security Lockdown on app_users
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view app users" ON public.app_users;
DROP POLICY IF EXISTS "Public can insert app users" ON public.app_users;
DROP POLICY IF EXISTS "Public can update app users" ON public.app_users;
DROP POLICY IF EXISTS "Service role full access on app_users" ON public.app_users;
DROP POLICY IF EXISTS "Allow registration on app_users" ON public.app_users;
DROP POLICY IF EXISTS "Self read app_users" ON public.app_users;

CREATE POLICY "Service role full access on app_users"
  ON public.app_users FOR ALL
  USING (coalesce(auth.jwt() ->> 'role', '') = 'service_role')
  WITH CHECK (coalesce(auth.jwt() ->> 'role', '') = 'service_role');

CREATE POLICY "Allow registration on app_users"
  ON public.app_users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Self read app_users"
  ON public.app_users FOR SELECT
  USING (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR (auth.uid() IS NOT NULL AND auth.uid()::text = id)
  );

-- 7. RLS Security Lockdown on products table
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public delete products" ON public.products;
DROP POLICY IF EXISTS "Allow public update products" ON public.products;
DROP POLICY IF EXISTS "Public can read products" ON public.products;
DROP POLICY IF EXISTS "Public can insert products" ON public.products;
DROP POLICY IF EXISTS "Owner or service role can update products" ON public.products;
DROP POLICY IF EXISTS "Owner or service role can delete products" ON public.products;

CREATE POLICY "Public can read products"
  ON public.products FOR SELECT
  USING (true);

CREATE POLICY "Public can insert products"
  ON public.products FOR INSERT
  WITH CHECK (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR auth.uid() IS NOT NULL
    OR user_id IS NULL
  );

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

CREATE POLICY "Owner or service role can delete products"
  ON public.products FOR DELETE
  USING (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR (auth.uid() IS NOT NULL AND auth.uid()::text = user_id)
  );
