-- ============================================================================
-- Migration: 002_allow_anonymous_products.sql
-- Purpose: Allow anonymous / public product tracking without mandatory auth.users FK
-- ============================================================================

-- 1. Drop NOT NULL constraint on products.user_id so anonymous users can track products
ALTER TABLE public.products ALTER COLUMN user_id DROP NOT NULL;

-- 2. Drop the strict foreign key constraint or make it nullable-compliant
-- (In PostgreSQL, nullable FK allows NULL user_id without FK violation)
ALTER TABLE public.products 
  DROP CONSTRAINT IF EXISTS products_user_id_fkey,
  ADD CONSTRAINT products_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;

-- 3. Update Unique Constraint to be URL-based (since multiple anonymous users can track same URL)
ALTER TABLE public.products 
  DROP CONSTRAINT IF EXISTS unique_user_product_url;

-- Ensure URL is unique across products so scraper checks each URL once
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_product_url'
  ) THEN
    ALTER TABLE public.products ADD CONSTRAINT unique_product_url UNIQUE (url);
  END IF;
END $$;

-- 4. Update Row-Level Security (RLS) to permit public read & insert
DROP POLICY IF EXISTS "Users can view own products" ON public.products;
CREATE POLICY "Public can view products" 
  ON public.products FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Users can insert own products" ON public.products;
CREATE POLICY "Public can insert products" 
  ON public.products FOR INSERT 
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update own products" ON public.products;
CREATE POLICY "Public can update products" 
  ON public.products FOR UPDATE 
  USING (true);

DROP POLICY IF EXISTS "Users can delete own products" ON public.products;
CREATE POLICY "Public can delete products" 
  ON public.products FOR DELETE 
  USING (true);

-- 5. Price History public policies
DROP POLICY IF EXISTS "Users can view history for own products" ON public.price_history;
CREATE POLICY "Public can view price history" 
  ON public.price_history FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Public can insert price history" ON public.price_history;
CREATE POLICY "Public can insert price history" 
  ON public.price_history FOR INSERT 
  WITH CHECK (true);
