-- ============================================================================
-- Migration: 004_app_features.sql
-- Purpose: Variant tracking, personal notification settings, and web push
-- ============================================================================

-- 1. Extend products table with variant metadata & discount cache
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS selected_size text,
  ADD COLUMN IF NOT EXISTS selected_color text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS last_alerted_price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS bank_offers jsonb DEFAULT '[]'::jsonb;

-- 2. App settings table (Personal configuration for alerts and bank cards)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id text PRIMARY KEY DEFAULT 'default',
  telegram_chat_id text,
  whatsapp_phone text,
  whatsapp_apikey text,
  email text,
  notification_preference text DEFAULT 'all_time_low' CHECK (notification_preference IN ('all_time_low', 'any_drop', 'never')),
  selected_bank_cards jsonb DEFAULT '["HDFC", "ICICI", "SBI", "Axis"]'::jsonb,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Backward compatibility view/alias for household_settings
CREATE TABLE IF NOT EXISTS public.household_settings (
  id text PRIMARY KEY DEFAULT 'default',
  telegram_chat_id text,
  whatsapp_phone text,
  whatsapp_apikey text,
  email text,
  notification_preference text DEFAULT 'all_time_low',
  selected_bank_cards jsonb DEFAULT '["HDFC", "ICICI", "SBI", "Axis"]'::jsonb,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default row if not exists
INSERT INTO public.app_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.household_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS and public access
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view app settings" ON public.app_settings;
CREATE POLICY "Public can view app settings"
  ON public.app_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public can update app settings" ON public.app_settings;
CREATE POLICY "Public can update app settings"
  ON public.app_settings FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view household settings" ON public.household_settings;
CREATE POLICY "Public can view household settings"
  ON public.household_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public can update household settings" ON public.household_settings;
CREATE POLICY "Public can update household settings"
  ON public.household_settings FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Web Push subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  endpoint text UNIQUE NOT NULL,
  keys jsonb NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can manage push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Public can manage push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (true)
  WITH CHECK (true);
