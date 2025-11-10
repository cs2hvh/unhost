-- Pricing Schema for Server Plans

-- Create pricing table
CREATE TABLE IF NOT EXISTS public.server_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL UNIQUE, -- e.g., 'g6-standard-2', 'g6-dedicated-4', etc.
  plan_category text NOT NULL, -- 'shared', 'dedicated', 'high_memory', 'premium', 'gpu'
  plan_name text NOT NULL,
  hourly_price decimal(10,4) NOT NULL DEFAULT 0.0000,
  monthly_price decimal(10,2) NOT NULL DEFAULT 0.00,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_server_pricing_plan_id ON public.server_pricing(plan_id);
CREATE INDEX IF NOT EXISTS idx_server_pricing_category ON public.server_pricing(plan_category);
CREATE INDEX IF NOT EXISTS idx_server_pricing_active ON public.server_pricing(is_active);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_pricing_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'server_pricing_update_updated_at'
  ) THEN
    CREATE TRIGGER server_pricing_update_updated_at
    BEFORE UPDATE ON public.server_pricing
    FOR EACH ROW EXECUTE FUNCTION public.update_pricing_updated_at();
  END IF;
END $$;

-- RLS Policies
ALTER TABLE public.server_pricing ENABLE ROW LEVEL SECURITY;

-- Anyone can view active pricing
CREATE POLICY "Anyone can view active pricing"
  ON public.server_pricing FOR SELECT
  USING (is_active = true);

-- Only service role can insert/update/delete (handled via admin API)
-- No direct user policies needed as admin operations use service role

-- Insert default pricing for common plans (these will be editable by admin)
INSERT INTO public.server_pricing (plan_id, plan_category, plan_name, hourly_price, monthly_price) VALUES
  -- Shared CPU (Standard)
  ('g6-standard-1', 'shared', 'Standard 1GB', 0.0075, 5.00),
  ('g6-standard-2', 'shared', 'Standard 2GB', 0.015, 10.00),
  ('g6-standard-4', 'shared', 'Standard 4GB', 0.030, 20.00),
  ('g6-standard-6', 'shared', 'Standard 8GB', 0.060, 40.00),
  ('g6-standard-8', 'shared', 'Standard 16GB', 0.120, 80.00),
  
  -- Dedicated CPU
  ('g6-dedicated-2', 'dedicated', 'Dedicated 4GB', 0.045, 30.00),
  ('g6-dedicated-4', 'dedicated', 'Dedicated 8GB', 0.090, 60.00),
  ('g6-dedicated-8', 'dedicated', 'Dedicated 16GB', 0.180, 120.00),
  ('g6-dedicated-16', 'dedicated', 'Dedicated 32GB', 0.360, 240.00),
  
  -- High Memory
  ('g7-highmem-1', 'high_memory', 'High Memory 24GB', 0.090, 60.00),
  ('g7-highmem-2', 'high_memory', 'High Memory 48GB', 0.180, 120.00),
  ('g7-highmem-4', 'high_memory', 'High Memory 90GB', 0.360, 240.00),
  ('g7-highmem-8', 'high_memory', 'High Memory 150GB', 0.720, 480.00),
  ('g7-highmem-16', 'high_memory', 'High Memory 300GB', 1.440, 960.00),
  
  -- Premium
  ('g6-premium-2', 'premium', 'Premium 4GB', 0.054, 36.00),
  ('g6-premium-4', 'premium', 'Premium 8GB', 0.108, 72.00),
  ('g6-premium-8', 'premium', 'Premium 16GB', 0.216, 144.00),
  ('g6-premium-16', 'premium', 'Premium 32GB', 0.432, 288.00)
ON CONFLICT (plan_id) DO NOTHING;
