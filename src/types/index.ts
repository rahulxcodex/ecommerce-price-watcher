export type Platform = 'amazon' | 'flipkart' | 'meesho';

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
  created_at: string;
  updated_at: string;
}

export interface PriceHistoryItem {
  id: number;
  product_id: string;
  price: number;
  currency: string;
  recorded_at: string;
}

export interface UserProfile {
  id: string;
  telegram_chat_id: string | null;
  telegram_verified: boolean;
  notification_preference: 'all_time_low' | 'any_drop' | 'never';
  created_at: string;
  updated_at: string;
}

export interface ScrapeResult {
  success: boolean;
  price?: number;
  title?: string;
  imageUrl?: string;
  currency?: string;
  isOutOfStock?: boolean;
  error?: string;
}
