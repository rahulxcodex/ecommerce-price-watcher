-- Ecommerce Price Watcher: Secure Schema with RLS
-- Migration: 001_initial_schema.sql

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Platform enum type
create type platform_type as enum ('amazon', 'flipkart', 'meesho');

-- Table: user_profiles (links to Supabase auth.users)
create table if not exists public.user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  telegram_chat_id text,
  telegram_verified boolean default false,
  notification_preference text default 'all_time_low' check (notification_preference in ('all_time_low', 'any_drop', 'never')),
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- Table: products
create table if not exists public.products (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  url text not null,
  platform platform_type not null,
  title text not null,
  image_url text,
  current_price numeric(12, 2) not null check (current_price >= 0),
  lowest_price numeric(12, 2) not null check (lowest_price >= 0),
  highest_price numeric(12, 2) not null check (highest_price >= 0),
  target_price numeric(12, 2) check (target_price is null or target_price >= 0),
  currency text default 'INR' not null,
  is_active boolean default true not null,
  last_checked_at timestamptz default timezone('utc'::text, now()) not null,
  last_price_drop_at timestamptz,
  check_status text default 'ok' check (check_status in ('ok', 'error', 'out_of_stock')),
  error_message text,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null,
  constraint unique_user_product_url unique (user_id, url)
);

-- Table: price_history
create table if not exists public.price_history (
  id bigint generated always as identity primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  price numeric(12, 2) not null check (price >= 0),
  currency text default 'INR' not null,
  recorded_at timestamptz default timezone('utc'::text, now()) not null
);

-- Performance Indexes
create index if not exists idx_products_user_id on public.products(user_id);
create index if not exists idx_products_is_active on public.products(is_active);
create index if not exists idx_products_last_checked on public.products(last_checked_at);
create index if not exists idx_price_history_product_date on public.price_history(product_id, recorded_at desc);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- 1. User Profiles RLS
alter table public.user_profiles enable row level security;

create policy "Users can view own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = id);

-- 2. Products RLS
alter table public.products enable row level security;

create policy "Users can view own products"
  on public.products for select
  using (auth.uid() = user_id);

create policy "Users can insert own products"
  on public.products for insert
  with check (
    auth.uid() = user_id and
    (select count(*) from public.products where user_id = auth.uid()) < 50 -- DoS prevention limit: max 50 products
  );

create policy "Users can update own products"
  on public.products for update
  using (auth.uid() = user_id);

create policy "Users can delete own products"
  on public.products for delete
  using (auth.uid() = user_id);

-- 3. Price History RLS
alter table public.price_history enable row level security;

create policy "Users can view history for own products"
  on public.price_history for select
  using (
    exists (
      select 1 from public.products
      where products.id = price_history.product_id
      and products.user_id = auth.uid()
    )
  );

create policy "Service role and users can insert price history"
  on public.price_history for insert
  with check (
    exists (
      select 1 from public.products
      where products.id = price_history.product_id
      and (products.user_id = auth.uid() or auth.jwt() ->> 'role' = 'service_role')
    )
  );

-- Automatically create profile on new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
