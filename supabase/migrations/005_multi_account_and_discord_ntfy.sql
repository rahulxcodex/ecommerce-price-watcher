-- ============================================================================
-- Migration: 005_multi_account_and_discord_ntfy.sql
-- Purpose: Add Discord Webhook & ntfy.sh support + Multi-account alert channels
-- ============================================================================

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS discord_webhook text,
  ADD COLUMN IF NOT EXISTS ntfy_topic text;

ALTER TABLE public.household_settings
  ADD COLUMN IF NOT EXISTS discord_webhook text,
  ADD COLUMN IF NOT EXISTS ntfy_topic text;
