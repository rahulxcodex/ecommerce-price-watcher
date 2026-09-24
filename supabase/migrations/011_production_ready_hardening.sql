-- ============================================================================
-- Migration: 011_production_ready_hardening.sql
-- Purpose:
--   1. Products table: Add granular scrape timestamps, price_source, version, and lock down RLS
--   2. App settings: User-scoped isolation, eliminate global shared state, lock down RLS
--   3. Push subscriptions: Add user_id, unique endpoint per user, lock down RLS
--   4. Search history: Restrict read/delete to owner and service_role
--   5. Rate limits: Restrict to service_role and create atomic increment RPC
--   6. Alert events: Idempotent notification tracking table with dedupe key
--   7. Scrape runs & items: Observability and run telemetry tracking tables
-- ============================================================================

-- Ensure pgcrypto or uuid-ossp extension exists for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. PRODUCTS TABLE HARDENING & RLS LOCKDOWN
-- ----------------------------------------------------------------------------

-- Ensure user_id column in products is flexible text (allowing custom auth and UUID strings)
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_user_id_fkey;
ALTER TABLE public.products ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.products ALTER COLUMN user_id TYPE text USING user_id::text;

-- Add granular scrape timestamps, price source, and optimistic concurrency version
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS last_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_successful_scrape_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz,
  ADD COLUMN IF NOT EXISTS price_source text DEFAULT 'server_scrape' CHECK (price_source IN ('server_scrape', 'browser_extension', 'manual')),
  ADD COLUMN IF NOT EXISTS version bigint DEFAULT 1 NOT NULL;

-- Initialize last_successful_scrape_at from last_checked_at if null
UPDATE public.products
SET last_successful_scrape_at = last_checked_at
WHERE last_successful_scrape_at IS NULL AND last_checked_at IS NOT NULL;

-- Drop overly permissive public read/insert policies
DROP POLICY IF EXISTS "Public can read products" ON public.products;
DROP POLICY IF EXISTS "Public can view products" ON public.products;
DROP POLICY IF EXISTS "Public can insert products" ON public.products;
DROP POLICY IF EXISTS "Allow public delete products" ON public.products;
DROP POLICY IF EXISTS "Allow public update products" ON public.products;
DROP POLICY IF EXISTS "Owner or service role can update products" ON public.products;
DROP POLICY IF EXISTS "Owner or service role can delete products" ON public.products;
DROP POLICY IF EXISTS "Users can read own products" ON public.products;
DROP POLICY IF EXISTS "Users can insert own products" ON public.products;

-- Scoped RLS: Users can only view their own products or if service_role
CREATE POLICY "Users can read own products"
  ON public.products FOR SELECT
  USING (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR (auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text)
    OR (user_id IS NULL AND created_by_name IS NOT NULL AND created_by_name = coalesce(auth.jwt() ->> 'name', ''))
  );

-- Scoped RLS: Authenticated users can insert products tied to their account
CREATE POLICY "Users can insert own products"
  ON public.products FOR INSERT
  WITH CHECK (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR (auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text)
    OR (user_id IS NULL AND auth.uid() IS NOT NULL)
  );

-- Scoped RLS: Only owner or service role can update products
CREATE POLICY "Owner or service role can update products"
  ON public.products FOR UPDATE
  USING (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR (auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text)
  )
  WITH CHECK (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR (auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text)
  );

-- Scoped RLS: Only owner or service role can delete products
CREATE POLICY "Owner or service role can delete products"
  ON public.products FOR DELETE
  USING (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR (auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text)
  );

-- ----------------------------------------------------------------------------
-- 2. APP SETTINGS USER-SCOPED ISOLATION & RLS LOCKDOWN
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.app_settings (
  id text PRIMARY KEY DEFAULT 'default',
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS user_id text;

-- Create unique index on user_id so each user has their own isolated settings row
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_settings_user_id
  ON public.app_settings(user_id)
  WHERE user_id IS NOT NULL;

-- Drop permissive public policies
DROP POLICY IF EXISTS "Public can view app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Public can update app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Service role full access on app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Users can read own settings" ON public.app_settings;
DROP POLICY IF EXISTS "Users can modify own settings" ON public.app_settings;

CREATE POLICY "Service role full access on app_settings"
  ON public.app_settings FOR ALL
  USING (coalesce(auth.jwt() ->> 'role', '') = 'service_role')
  WITH CHECK (coalesce(auth.jwt() ->> 'role', '') = 'service_role');

CREATE POLICY "Users can read own settings"
  ON public.app_settings FOR SELECT
  USING (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR (auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text)
  );

CREATE POLICY "Users can modify own settings"
  ON public.app_settings FOR ALL
  USING (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR (auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text)
  )
  WITH CHECK (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR (auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text)
  );

-- ----------------------------------------------------------------------------
-- 3. PUSH SUBSCRIPTIONS USER OWNERSHIP & RLS LOCKDOWN
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint text UNIQUE NOT NULL,
  keys jsonb NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS user_id text;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions(user_id);

DROP POLICY IF EXISTS "Public can manage push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Service role full access on push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Service role full access on push_subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (coalesce(auth.jwt() ->> 'role', '') = 'service_role')
  WITH CHECK (coalesce(auth.jwt() ->> 'role', '') = 'service_role');

CREATE POLICY "Users can manage own push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR (auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text)
  )
  WITH CHECK (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR (auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text)
  );

-- ----------------------------------------------------------------------------
-- 4. SEARCH HISTORY RLS LOCKDOWN
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.search_history (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id text,
  created_by_name text,
  platform text NOT NULL,
  query text NOT NULL,
  result_count integer DEFAULT 0,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_history_user_platform
  ON public.search_history(user_id, platform, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_history_query
  ON public.search_history(lower(query));

CREATE INDEX IF NOT EXISTS idx_search_history_created
  ON public.search_history(created_at DESC);

ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read search_history" ON public.search_history;
DROP POLICY IF EXISTS "Allow public insert search_history" ON public.search_history;
DROP POLICY IF EXISTS "Allow public delete search_history" ON public.search_history;
DROP POLICY IF EXISTS "Service role full access on search_history" ON public.search_history;
DROP POLICY IF EXISTS "Users can read own search_history" ON public.search_history;
DROP POLICY IF EXISTS "Users can insert own search_history" ON public.search_history;
DROP POLICY IF EXISTS "Users can delete own search_history" ON public.search_history;

CREATE POLICY "Service role full access on search_history"
  ON public.search_history FOR ALL
  USING (coalesce(auth.jwt() ->> 'role', '') = 'service_role')
  WITH CHECK (coalesce(auth.jwt() ->> 'role', '') = 'service_role');

CREATE POLICY "Users can read own search_history"
  ON public.search_history FOR SELECT
  USING (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR (auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text)
  );

CREATE POLICY "Users can insert own search_history"
  ON public.search_history FOR INSERT
  WITH CHECK (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR (auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text)
  );

CREATE POLICY "Users can delete own search_history"
  ON public.search_history FOR DELETE
  USING (
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR (auth.uid() IS NOT NULL AND auth.uid()::text = user_id::text)
  );

-- ----------------------------------------------------------------------------
-- 5. RATE LIMITS RLS LOCKDOWN & ATOMIC INCREMENT RPC
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY,
  points integer NOT NULL DEFAULT 1,
  expire_at timestamptz NOT NULL,
  last_attempt_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expire
  ON public.rate_limits(expire_at);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read rate_limits" ON public.rate_limits;
DROP POLICY IF EXISTS "Allow public insert rate_limits" ON public.rate_limits;
DROP POLICY IF EXISTS "Allow public update rate_limits" ON public.rate_limits;
DROP POLICY IF EXISTS "Service role full access on rate_limits" ON public.rate_limits;

CREATE POLICY "Service role full access on rate_limits"
  ON public.rate_limits FOR ALL
  USING (coalesce(auth.jwt() ->> 'role', '') = 'service_role')
  WITH CHECK (coalesce(auth.jwt() ->> 'role', '') = 'service_role');

-- Atomic sliding-window rate limit increment function
CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_expire_at timestamptz := v_now + (p_window_seconds || ' seconds')::interval;
  v_points integer;
  v_existing_expire timestamptz;
BEGIN
  -- Atomic upsert: increment points or reset expired window
  INSERT INTO public.rate_limits (key, points, expire_at, last_attempt_at)
  VALUES (p_key, 1, v_expire_at, v_now)
  ON CONFLICT (key) DO UPDATE
  SET
    points = CASE
      WHEN public.rate_limits.expire_at <= v_now THEN 1
      ELSE public.rate_limits.points + 1
    END,
    expire_at = CASE
      WHEN public.rate_limits.expire_at <= v_now THEN v_expire_at
      ELSE public.rate_limits.expire_at
    END,
    last_attempt_at = v_now
  RETURNING points, expire_at INTO v_points, v_existing_expire;

  RETURN jsonb_build_object(
    'allowed', v_points <= p_limit,
    'points', v_points,
    'remaining', GREATEST(0, p_limit - v_points),
    'retry_after_seconds', GREATEST(1, EXTRACT(EPOCH FROM (v_existing_expire - v_now))::integer)
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. ALERT EVENTS TABLE (IDEMPOTENT NOTIFICATION DISPATCH)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.alert_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('price_drop', 'all_time_low', 'target_met', 'back_in_stock')),
  price numeric(12, 2) NOT NULL CHECK (price >= 0),
  dedupe_key text UNIQUE NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  recipient_count integer DEFAULT 0,
  error text,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_alert_events_product ON public.alert_events(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_events_dedupe ON public.alert_events(dedupe_key);

ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on alert_events" ON public.alert_events;
CREATE POLICY "Service role full access on alert_events"
  ON public.alert_events FOR ALL
  USING (coalesce(auth.jwt() ->> 'role', '') = 'service_role')
  WITH CHECK (coalesce(auth.jwt() ->> 'role', '') = 'service_role');

-- ----------------------------------------------------------------------------
-- 7. SCRAPE RUNS & ITEMS (OBSERVABILITY & TELEMETRY)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.scrape_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  finished_at timestamptz,
  status text DEFAULT 'running' NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  trigger text DEFAULT 'cron' NOT NULL CHECK (trigger IN ('cron', 'manual', 'watchdog')),
  total_products integer DEFAULT 0,
  success_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  out_of_stock_count integer DEFAULT 0,
  duration_ms integer
);

CREATE TABLE IF NOT EXISTS public.scrape_run_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid REFERENCES public.scrape_runs(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  platform text NOT NULL,
  status text NOT NULL CHECK (status IN ('ok', 'error', 'out_of_stock')),
  old_price numeric(12, 2),
  new_price numeric(12, 2),
  error text,
  attempts integer DEFAULT 1,
  duration_ms integer,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scrape_runs_started ON public.scrape_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_run_items_run ON public.scrape_run_items(run_id);

ALTER TABLE public.scrape_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrape_run_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on scrape_runs" ON public.scrape_runs;
CREATE POLICY "Service role full access on scrape_runs"
  ON public.scrape_runs FOR ALL
  USING (coalesce(auth.jwt() ->> 'role', '') = 'service_role')
  WITH CHECK (coalesce(auth.jwt() ->> 'role', '') = 'service_role');

DROP POLICY IF EXISTS "Service role full access on scrape_run_items" ON public.scrape_run_items;
CREATE POLICY "Service role full access on scrape_run_items"
  ON public.scrape_run_items FOR ALL
  USING (coalesce(auth.jwt() ->> 'role', '') = 'service_role')
  WITH CHECK (coalesce(auth.jwt() ->> 'role', '') = 'service_role');
