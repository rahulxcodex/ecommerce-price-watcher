-- ============================================================================
-- Migration: 010_add_rate_limits.sql
-- Purpose:
--   1. Create rate_limits table for cross-instance serverless rate limiting
--   2. Index on expire_at for automatic TTL filtering / pruning
--   3. Row Level Security policies for service_role and public
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY,
  points integer NOT NULL DEFAULT 1,
  expire_at timestamptz NOT NULL,
  last_attempt_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expire
  ON public.rate_limits(expire_at);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on rate_limits" ON public.rate_limits;
DROP POLICY IF EXISTS "Allow public read rate_limits" ON public.rate_limits;
DROP POLICY IF EXISTS "Allow public insert rate_limits" ON public.rate_limits;
DROP POLICY IF EXISTS "Allow public update rate_limits" ON public.rate_limits;

CREATE POLICY "Service role full access on rate_limits"
  ON public.rate_limits FOR ALL
  USING (coalesce(auth.jwt() ->> 'role', '') = 'service_role')
  WITH CHECK (coalesce(auth.jwt() ->> 'role', '') = 'service_role');

CREATE POLICY "Allow public read rate_limits"
  ON public.rate_limits FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert rate_limits"
  ON public.rate_limits FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update rate_limits"
  ON public.rate_limits FOR UPDATE
  USING (true)
  WITH CHECK (true);
