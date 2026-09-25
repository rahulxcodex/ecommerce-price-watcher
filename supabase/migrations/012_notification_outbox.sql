-- ============================================================================
-- Migration: 012_notification_outbox.sql
-- Description: Notification Outbox & Delivery Assurance System
-- Ensures all multi-channel price drop and back-in-stock alerts are persisted
-- in an outbox queue and retried with exponential backoff if transients occur.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notification_outbox (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_event_id uuid REFERENCES public.alert_events(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('telegram', 'whatsapp', 'email', 'discord', 'ntfy', 'web_push')),
  recipient text,
  payload jsonb NOT NULL,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'abandoned')),
  attempts integer DEFAULT 0 NOT NULL,
  max_attempts integer DEFAULT 3 NOT NULL,
  last_error text,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending
  ON public.notification_outbox(status, created_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_notification_outbox_event
  ON public.notification_outbox(alert_event_id);

-- Row Level Security
ALTER TABLE public.notification_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on notification_outbox" ON public.notification_outbox;
CREATE POLICY "Service role full access on notification_outbox"
  ON public.notification_outbox FOR ALL
  USING (coalesce(auth.jwt() ->> 'role', '') = 'service_role')
  WITH CHECK (coalesce(auth.jwt() ->> 'role', '') = 'service_role');
