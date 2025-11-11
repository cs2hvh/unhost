-- CPU Types Management Schema
-- This schema manages CPU processor types for different plan categories
-- Users select Plan Type (shared/dedicated/etc) -> then select CPU within that type

-- Create CPU types table
CREATE TABLE IF NOT EXISTS public.cpu_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_category TEXT NOT NULL, -- shared, dedicated, highmem, premium, storage (NOT UNIQUE - can have multiple CPUs per category)
  cpu_name TEXT NOT NULL, -- e.g., "Intel Xeon 2334S"
  cpu_description TEXT, -- Optional description
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add new columns if they don't exist (for existing tables)
ALTER TABLE public.cpu_types 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.cpu_types 
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Add unique constraint if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cpu_types_plan_category_cpu_name_key'
  ) THEN
    ALTER TABLE public.cpu_types 
      ADD CONSTRAINT cpu_types_plan_category_cpu_name_key UNIQUE(plan_category, cpu_name);
  END IF;
END $$;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_cpu_types_category ON public.cpu_types(plan_category);
CREATE INDEX IF NOT EXISTS idx_cpu_types_active ON public.cpu_types(is_active);
CREATE INDEX IF NOT EXISTS idx_cpu_types_category_active ON public.cpu_types(plan_category, is_active);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.update_cpu_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cpu_types_updated_at ON public.cpu_types;
CREATE TRIGGER cpu_types_updated_at
  BEFORE UPDATE ON public.cpu_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_cpu_types_updated_at();

-- Insert default CPU types - ONE CPU per category for now
-- In the future, you can add more CPUs to each category
INSERT INTO public.cpu_types (plan_category, cpu_name, cpu_description, is_active, display_order)
VALUES
  -- Shared CPU Plans
  ('shared', 'Intel Xeon 2334S', 'Balanced performance for general workloads', true, 1),
  
  -- Dedicated CPU Plans
  ('dedicated', 'Intel Xeon 4343', 'Guaranteed dedicated resources', true, 1),
  
  -- High Memory Plans (both variations for compatibility)
  ('highmem', 'Intel Xeon 5644', 'Optimized for memory-intensive applications', true, 1),
  ('high_memory', 'Intel Xeon 5644', 'Optimized for memory-intensive applications', true, 1),
  
  -- Premium Plans
  ('premium', 'Intel Xeon 5644', 'Enhanced performance and reliability', true, 1),
  
  -- Storage Optimized Plans
  ('storage', 'Intel Xeon 5644', 'High I/O performance for databases', true, 1),
  
  -- GPU Plans
  ('gpu', 'Intel Xeon 5644', 'GPU-accelerated computing', true, 1)
ON CONFLICT (plan_category, cpu_name) DO UPDATE SET
  cpu_description = EXCLUDED.cpu_description,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order;

-- Add cpu_type_id column to server_pricing table (if not exists)
-- This references the specific CPU type selected
ALTER TABLE public.server_pricing
  ADD COLUMN IF NOT EXISTS cpu_type_id UUID REFERENCES public.cpu_types(id);

-- For backward compatibility, also keep cpu_category for filtering
ALTER TABLE public.server_pricing
  ADD COLUMN IF NOT EXISTS cpu_category TEXT;

-- Update existing rows: map to the first CPU in each category
DO $$
DECLARE
  pricing_row RECORD;
  cpu_id UUID;
BEGIN
  FOR pricing_row IN SELECT id, plan_category FROM public.server_pricing WHERE cpu_type_id IS NULL LOOP
    -- Find the first active CPU for this category
    SELECT ct.id INTO cpu_id
    FROM public.cpu_types ct
    WHERE ct.plan_category = pricing_row.plan_category
      AND ct.is_active = true
    ORDER BY ct.display_order, ct.created_at
    LIMIT 1;
    
    -- Update the pricing row
    IF cpu_id IS NOT NULL THEN
      UPDATE public.server_pricing
      SET cpu_type_id = cpu_id,
          cpu_category = pricing_row.plan_category
      WHERE id = pricing_row.id;
    END IF;
  END LOOP;
END $$;

-- Enable RLS
ALTER TABLE public.cpu_types ENABLE ROW LEVEL SECURITY;

-- Public read policy (anyone can view CPU types)
DROP POLICY IF EXISTS "Allow public read access to cpu_types" ON public.cpu_types;
CREATE POLICY "Allow public read access to cpu_types"
  ON public.cpu_types
  FOR SELECT
  TO public
  USING (true);

-- Admin write policy (you'll need to add admin check via service role)
-- For now, only authenticated users can modify (you can restrict further in API)
DROP POLICY IF EXISTS "Allow authenticated write access to cpu_types" ON public.cpu_types;
CREATE POLICY "Allow authenticated write access to cpu_types"
  ON public.cpu_types
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.cpu_types TO anon, authenticated;
GRANT ALL ON public.cpu_types TO authenticated;

COMMENT ON TABLE public.cpu_types IS 'Stores CPU processor types for different server plan categories. Multiple CPUs can exist per category.';
COMMENT ON COLUMN public.cpu_types.plan_category IS 'Category identifier (shared, dedicated, highmem, premium, storage) - multiple CPUs allowed per category';
COMMENT ON COLUMN public.cpu_types.cpu_name IS 'Processor name displayed to users (e.g., Intel Xeon 2334S)';
COMMENT ON COLUMN public.cpu_types.is_active IS 'Whether this CPU option is available for selection';
COMMENT ON COLUMN public.cpu_types.display_order IS 'Order in which CPUs are displayed within their category (lower = first)';

