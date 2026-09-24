-- Performance Indexes Migration
-- Adds missing indexes identified during query analysis audit

-- Index for filtering products by platform on dashboard
CREATE INDEX IF NOT EXISTS idx_products_platform ON products(platform);

-- Composite index for user's products sorted by creation date
CREATE INDEX IF NOT EXISTS idx_products_user_created ON products(user_id, created_at DESC);

-- Composite index for price history lookups (trend charts)
CREATE INDEX IF NOT EXISTS idx_price_history_product_checked ON price_history(product_id, checked_at DESC);

-- Index for all-time low price queries
CREATE INDEX IF NOT EXISTS idx_price_history_product_price ON price_history(product_id, price ASC);

-- Index for active product filtering during scrape cycles
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active) WHERE is_active = true;
