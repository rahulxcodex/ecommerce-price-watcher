-- ============================================================================
-- Consolidate Migrations 002 to 005 for PriceWatcher
-- Paste and run this script in your Supabase Dashboard -> SQL Editor
-- ============================================================================

-- 1. Support Myntra, Ajio, and Westside in platform_type enum
ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'myntra';
ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'ajio';
ALTER TYPE platform_type ADD VALUE IF NOT EXISTS 'westside';

-- 2. Allow tracking without mandatory Supabase Auth user ID
ALTER TABLE public.products ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_user_id_fkey;

-- 3. Extend products table with variant metadata, notes & bank offers
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS selected_size text,
  ADD COLUMN IF NOT EXISTS selected_color text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS last_alerted_price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS bank_offers jsonb DEFAULT '[]'::jsonb;

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

-- Enable Row Level Security and allow public access for personal setup
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
