-- Migration: Create crypto callback function for unhost
-- Created: 2025-11-06
-- Description: Creates function to handle crypto payment callbacks and update wallet balance

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS crypto_callback (
    VARCHAR,
    VARCHAR,
    VARCHAR,
    DECIMAL,
    DECIMAL,
    VARCHAR,
    VARCHAR,
    VARCHAR,
    JSONB
);

-- Create the crypto_callback function
CREATE OR REPLACE FUNCTION crypto_callback(
  p_order_id VARCHAR(255),
  p_payment_status VARCHAR(50),
  p_payment_id VARCHAR(255),
  p_actually_paid DECIMAL(12,2) DEFAULT NULL,
  p_outcome_amount DECIMAL(12,2) DEFAULT NULL,
  p_outcome_currency VARCHAR(20) DEFAULT NULL,
  p_payin_hash VARCHAR(255) DEFAULT NULL,
  p_payout_hash VARCHAR(255) DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(
  transaction_id BIGINT,
  user_id UUID,
  new_balance DECIMAL(10,2),
  status_updated BOOLEAN,
  amount_credited DECIMAL(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id BIGINT;
  v_user_id UUID;
  v_wallet_id BIGINT;
  v_amount DECIMAL(10,2);
  v_current_balance DECIMAL(10,2);
  v_new_balance DECIMAL(10,2);
  v_current_status VARCHAR(20);
  v_new_status VARCHAR(20);
  v_status_updated BOOLEAN := FALSE;
  v_amount_credited DECIMAL(10,2) := 0;
  v_platform_fee DECIMAL(12,2);
  v_credited_amount DECIMAL(10,2);
BEGIN
  -- Validate required parameters
  IF p_order_id IS NULL OR p_order_id = '' THEN
    RAISE EXCEPTION 'Order ID is required';
  END IF;

  IF p_payment_status IS NULL OR p_payment_status = '' THEN
    RAISE EXCEPTION 'Payment status is required';
  END IF;

  -- Find the transaction by order_id in metadata
  SELECT wt.id, wt.user_id, wt.wallet_id, wt.amount, wt.status, wt.metadata->>'platform_fee'
  INTO v_transaction_id, v_user_id, v_wallet_id, v_amount, v_current_status, v_platform_fee
  FROM wallet_transactions wt
  WHERE wt.metadata->>'order_id' = p_order_id
    AND wt.type = 'deposit'
  ORDER BY wt.created_at DESC
  LIMIT 1;

  IF v_transaction_id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found for order ID: %', p_order_id;
  END IF;

  -- Map payment status to transaction status
  CASE p_payment_status
    WHEN 'finished', 'confirmed', 'overpaid' THEN
      v_new_status := 'completed';
    WHEN 'sending' THEN
      v_new_status := 'pending';
    WHEN 'confirming', 'waiting' THEN
      v_new_status := 'pending';
    WHEN 'partially_paid' THEN
      v_new_status := 'completed'; -- Treat partial payment as completed
    WHEN 'failed', 'refunded', 'expired' THEN
      v_new_status := 'failed';
    ELSE
      v_new_status := 'pending';
  END CASE;

  -- Only process if status has changed
  IF v_current_status != v_new_status THEN
    v_status_updated := TRUE;

    -- Get current wallet balance
    SELECT w.balance INTO v_current_balance
    FROM wallets w
    WHERE w.id = v_wallet_id;

    -- Start transaction
    BEGIN
      -- Update transaction status and metadata
      UPDATE wallet_transactions
      SET
        status = v_new_status,
        updated_at = NOW(),
        metadata = jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  COALESCE(metadata, '{}'::jsonb),
                  '{callback_data}',
                  to_jsonb(p_metadata)
                ),
                '{payment_status}',
                to_jsonb(p_payment_status)
              ),
              '{processed_at}',
              to_jsonb(NOW()::text)
            ),
            '{payin_hash}',
            to_jsonb(COALESCE(p_payin_hash, ''))
          ),
          '{payout_hash}',
          to_jsonb(COALESCE(p_payout_hash, ''))
        )
      WHERE id = v_transaction_id;

      -- If payment is completed (finished or partially_paid), credit the wallet
      IF v_new_status = 'completed' AND v_current_status != 'completed' THEN
        -- Calculate amount to credit
        IF p_payment_status = 'partially_paid' AND p_actually_paid IS NOT NULL THEN
          -- For partial payments, credit the actually paid amount minus platform fees
          v_credited_amount := GREATEST(0, p_actually_paid - COALESCE(v_platform_fee, 0));
        ELSE
          -- For full payments, credit the original amount
          v_credited_amount := v_amount;
        END IF;

        v_new_balance := v_current_balance + v_credited_amount;
        v_amount_credited := v_credited_amount;

        -- Update wallet balance
        UPDATE wallets w
        SET balance = v_new_balance,
            updated_at = NOW()
        WHERE w.id = v_wallet_id;

      ELSE
        v_new_balance := v_current_balance;
      END IF;

    EXCEPTION
      WHEN OTHERS THEN
        -- Rollback will happen automatically
        RAISE EXCEPTION 'Failed to process crypto payment callback: %', SQLERRM;
    END;
  ELSE
    -- Status hasn't changed, just return current balance
    SELECT w.balance INTO v_new_balance
    FROM wallets w
    WHERE w.id = v_wallet_id;
  END IF;

  -- Return the results
  RETURN QUERY SELECT
    v_transaction_id,
    v_user_id,
    v_new_balance,
    v_status_updated,
    v_amount_credited;

END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION crypto_callback TO service_role;

GRANT EXECUTE ON FUNCTION crypto_callback TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION crypto_callback IS 'Processes crypto payment callbacks, updates transaction status and credits wallet balance for completed payments';

-- Example usage:
-- SELECT * FROM crypto_callback(
--   p_order_id := 'abc123def456',
--   p_payment_status := 'finished',
--   p_payment_id := 'np_12345',
--   p_actually_paid := 107.00,
--   p_outcome_amount := 100.00,
--   p_outcome_currency := 'USD',
--   p_payin_hash := 'tx_hash_123',
--   p_payout_hash := NULL,
--   p_metadata := '{"source": "nowpayments"}'::jsonb
-- );
