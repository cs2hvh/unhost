-- Function to delete users with 0 balance for past 30 days
CREATE OR REPLACE FUNCTION delete_inactive_zero_balance_users()
RETURNS TABLE(deleted_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count bigint;
BEGIN
  -- Delete users who have had 0 balance for 30+ days
  WITH users_to_delete AS (
    SELECT DISTINCT w.user_id
    FROM public.wallets w
    WHERE w.balance = 0.00
      AND w.updated_at <= NOW() - INTERVAL '30 days'
      AND NOT EXISTS (
        -- Check if user has any wallet with non-zero balance
        SELECT 1
        FROM public.wallets w2
        WHERE w2.user_id = w.user_id
          AND w2.balance > 0.00
      )
  )
  DELETE FROM auth.users
  WHERE id IN (SELECT user_id FROM users_to_delete);

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN QUERY SELECT v_deleted_count;
END;
$$;

-- Grant execute permission to authenticated users (adjust as needed)
GRANT EXECUTE ON FUNCTION delete_inactive_zero_balance_users() TO service_role;

-- To set up the cron job, run this in Supabase SQL Editor:
-- You need to enable pg_cron extension first if not already enabled
-- SELECT cron.schedule(
--   'delete-inactive-zero-balance-users',  -- Job name
--   '0 2 * * *',                           -- Cron expression: Run daily at 2 AM UTC
--   $$ SELECT delete_inactive_zero_balance_users(); $$
-- );

-- To check if cron job is scheduled:
-- SELECT * FROM cron.job;

-- To unschedule the job (if needed):
-- SELECT cron.unschedule('delete-inactive-zero-balance-users');
