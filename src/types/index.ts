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
}

