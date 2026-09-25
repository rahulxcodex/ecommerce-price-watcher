export type Platform = 'amazon' | 'flipkart' | 'meesho' | 'myntra' | 'ajio' | 'westside';

export interface Product {
  id: string;
  user_id: string;
  url: string;
  platform: Platform;
  title: string;
  image_url: string | null;
  current_price: number;
  lowest_price: number;
  highest_price: number;
  target_price: number | null;
  currency: string;
  is_active: boolean;
  last_checked_at: string;
  last_price_drop_at: string | null;
  check_status: 'ok' | 'error' | 'out_of_stock';
  error_message: string | null;
  selected_size?: string | null;
  selected_color?: string | null;
  notes?: string | null;
  last_alerted_price?: number | null;
  bank_offers?: BankOffer[];
  created_by_name?: string | null;
  last_attempted_at?: string | null;
  last_successful_scrape_at?: string | null;
  last_error_at?: string | null;
  price_source?: 'server_scrape' | 'browser_extension' | 'manual';
  version?: number;
  created_at: string;
  updated_at: string;
}

export interface BankOffer {
  bank: string;
  discountPercent?: number;
  maxDiscount?: number;
  description: string;
  calculatedPrice?: number;
}

export interface AppSettings {
  id: string;
  user_id?: string | null;
  telegram_chat_id: string | null;
  whatsapp_phone: string | null;
  whatsapp_apikey: string | null;
  email: string | null;
  discord_webhook?: string | null;
  ntfy_topic?: string | null;
  notification_preference: 'all_time_low' | 'any_drop' | 'never';
  selected_bank_cards: string[];
  updated_at?: string;
}

export interface PriceHistoryItem {
  id: number;
  product_id: string;
  price: number;
  currency: string;
  recorded_at: string;
}

export type ScrapeErrorCode =
  | 'BOT_BLOCKED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'OUT_OF_STOCK'
  | 'SELECTOR_MISMATCH'
  | 'INVALID_URL'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export interface ScrapeResult {
  success: boolean;
  price?: number;
  title?: string;
  imageUrl?: string;
  currency?: string;
  isOutOfStock?: boolean;
  availableSizes?: string[];
  bankOffers?: BankOffer[];
  error?: string;
  errorCode?: ScrapeErrorCode;
  source?: 'jsonld' | 'api' | 'meta' | 'dom' | 'browser';
}

export interface AlertEvent {
  id: string;
  product_id: string;
  event_type: 'price_drop' | 'all_time_low' | 'target_met' | 'back_in_stock';
  price: number;
  dedupe_key: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  recipient_count?: number;
  error?: string | null;
  created_at: string;
  sent_at?: string | null;
}

export interface ScrapeRun {
  id: string;
  started_at: string;
  finished_at?: string | null;
  status: 'running' | 'completed' | 'failed';
  trigger: 'cron' | 'manual' | 'watchdog';
  total_products: number;
  success_count: number;
  error_count: number;
  out_of_stock_count: number;
  duration_ms?: number | null;
}

export interface ScrapeRunItem {
  id: string;
  run_id: string;
  product_id: string;
  platform: Platform;
  status: 'ok' | 'error' | 'out_of_stock';
  old_price?: number | null;
  new_price?: number | null;
  error?: string | null;
  attempts?: number;
  duration_ms?: number;
  created_at: string;
}

export interface DiscoveryResult {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  brand?: string;
  imageUrl?: string;
  productUrl: string;
  rating?: number;
  reviewCount?: number;
  boughtCount?: string;
  platform: Platform;
  isParetoOptimal?: boolean;
  isAlreadyTracked?: boolean;
}

export interface SearchHistoryItem {
  id: string;
  user_id?: string | null;
  created_by_name?: string | null;
  platform: Platform;
  query: string;
  result_count: number;
  created_at: string;
}

export interface SmartFilterFacets {
  brands: Array<{ name: string; count: number }>;
  priceRange: { min: number; max: number };
  discountRanges: Array<{ label: string; min: number; count: number }>;
  ratings: Array<{ minRating: number; count: number }>;
}

