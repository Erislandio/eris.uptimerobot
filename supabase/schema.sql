-- =============================================================
-- TriggerBot — Supabase Schema
-- Run this in your Supabase SQL Editor
-- =============================================================

-- Enable Row Level Security
-- monitors table
CREATE TABLE IF NOT EXISTS public.monitors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  url               TEXT NOT NULL,
  method            TEXT NOT NULL DEFAULT 'GET'
                      CHECK (method IN ('GET','POST','PUT','PATCH','DELETE')),
  headers           JSONB NOT NULL DEFAULT '{}',
  body              TEXT,
  interval_seconds  INTEGER NOT NULL DEFAULT 300,
  retry_count       INTEGER NOT NULL DEFAULT 3,
  timeout_seconds   INTEGER NOT NULL DEFAULT 30,
  status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','paused','error')),
  last_triggered_at TIMESTAMPTZ,
  next_trigger_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- monitor_logs table
CREATE TABLE IF NOT EXISTS public.monitor_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id       UUID NOT NULL REFERENCES public.monitors(id) ON DELETE CASCADE,
  status_code      INTEGER,
  response_time_ms INTEGER,
  success          BOOLEAN NOT NULL DEFAULT false,
  error_message    TEXT,
  triggered_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_monitors_user_id ON public.monitors(user_id);
CREATE INDEX IF NOT EXISTS idx_monitors_status ON public.monitors(status);
CREATE INDEX IF NOT EXISTS idx_monitors_next_trigger ON public.monitors(next_trigger_at);
CREATE INDEX IF NOT EXISTS idx_monitor_logs_monitor_id ON public.monitor_logs(monitor_id);
CREATE INDEX IF NOT EXISTS idx_monitor_logs_triggered_at ON public.monitor_logs(triggered_at DESC);

-- Enable RLS
ALTER TABLE public.monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitor_logs ENABLE ROW LEVEL SECURITY;

-- Policies for monitors
CREATE POLICY "Users can view own monitors"
  ON public.monitors FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own monitors"
  ON public.monitors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monitors"
  ON public.monitors FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own monitors"
  ON public.monitors FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for monitor_logs
CREATE POLICY "Users can view logs of own monitors"
  ON public.monitor_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.monitors
      WHERE monitors.id = monitor_logs.monitor_id
        AND monitors.user_id = auth.uid()
    )
  );

CREATE POLICY "Service can insert logs"
  ON public.monitor_logs FOR INSERT
  WITH CHECK (true);  -- Cron uses service role key

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER monitors_updated_at
  BEFORE UPDATE ON public.monitors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
