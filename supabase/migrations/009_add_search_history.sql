-- ============================================================================
-- Migration: 009_add_search_history.sql
-- Purpose:
--   1. Create search_history table for Product Discovery suggestions & monitoring
--   2. Index platform, query, and user_id for fast prefix & history lookups
--   3. Enable RLS with service_role and authenticated policies
-- ============================================================================

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

DROP POLICY IF EXISTS "Service role full access on search_history" ON public.search_history;
DROP POLICY IF EXISTS "Allow public read search_history" ON public.search_history;
DROP POLICY IF EXISTS "Allow public insert search_history" ON public.search_history;
DROP POLICY IF EXISTS "Allow public delete search_history" ON public.search_history;

CREATE POLICY "Service role full access on search_history"
  ON public.search_history FOR ALL
  USING (coalesce(auth.jwt() ->> 'role', '') = 'service_role')
  WITH CHECK (coalesce(auth.jwt() ->> 'role', '') = 'service_role');

CREATE POLICY "Allow public read search_history"
  ON public.search_history FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert search_history"
  ON public.search_history FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public delete search_history"
  ON public.search_history FOR DELETE
  USING (true);
