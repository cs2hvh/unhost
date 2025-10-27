-- Enable RLS on servers table if not already enabled
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (to recreate with updated permissions)
DROP POLICY IF EXISTS "Users can delete their own servers" ON public.servers;

-- Allow users to delete their own servers
CREATE POLICY "Users can delete their own servers"
  ON public.servers
  FOR DELETE
  USING (auth.uid() = owner_id);

-- Also ensure users can view their own servers
DROP POLICY IF EXISTS "Users can view their own servers" ON public.servers;
CREATE POLICY "Users can view their own servers"
  ON public.servers
  FOR SELECT
  USING (auth.uid() = owner_id);

-- And update their own servers
DROP POLICY IF EXISTS "Users can update their own servers" ON public.servers;
CREATE POLICY "Users can update their own servers"
  ON public.servers
  FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
