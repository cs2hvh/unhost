-- Migration: Create crypto payment function for unhost
-- Created: 2025-11-06
-- Description: Creates crypto_create_payment function for handling crypto payment creation

-- Create the crypto_create_payment function
CREATE OR REPLACE FUNCTION crypto_create_payment(
  p_user_id UUID,
  p_order_id VARCHAR(255),
  p_amount DECIMAL(12,2),
  p_fee_amount DECIMAL(12,2),
  p_currency VARCHAR(20),
  p_payment_provider VARCHAR(50),
  p_payment_id VARCHAR(255),
  p_payment_url VARCHAR(500),
  p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(
  transaction_id BIGINT,
  wallet_id BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_transaction_id BIGINT;
  v_wallet_id BIGINT;
  v_full_metadata JSONB;
BEGIN
  -- Validate user exists and is authenticated
  IF p_user_id IS NULL OR p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Invalid user ID';
  END IF;

  -- Validate required parameters
  IF p_order_id IS NULL OR p_order_id = '' THEN
    RAISE EXCEPTION 'Order ID is required';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Valid amount is required';
  END IF;

  IF p_fee_amount IS NULL OR p_fee_amount < 0 THEN
    RAISE EXCEPTION 'Valid fee amount is required';
  END IF;

  IF p_currency IS NULL OR p_currency = '' THEN
    RAISE EXCEPTION 'Currency is required';
  END IF;

  IF p_payment_provider IS NULL OR p_payment_provider = '' THEN
    RAISE EXCEPTION 'Payment provider is required';
  END IF;

  IF p_payment_id IS NULL OR p_payment_id = '' THEN
    RAISE EXCEPTION 'Payment ID is required';
  END IF;

  -- Prepare metadata with order_id, platform fees, and payment provider
  v_full_metadata := jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          COALESCE(p_metadata, '{}'::jsonb),
          '{order_id}',
          to_jsonb(p_order_id)
        ),
        '{platform_fee}',
        to_jsonb(p_fee_amount)
      ),
      '{payment_provider}',
      to_jsonb(p_payment_provider)
    ),
    '{payment_id}',
    to_jsonb(p_payment_id)
  );

  -- Get or create user's wallet
  SELECT id INTO v_wallet_id
  FROM wallets
  WHERE user_id = p_user_id AND currency = 'USD'
  LIMIT 1;

  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance, currency)
    VALUES (p_user_id, 0.00, 'USD')
    RETURNING id INTO v_wallet_id;
  END IF;

  -- Start transaction
  BEGIN
    -- Create pending transaction record for crypto deposit
    INSERT INTO wallet_transactions (
      wallet_id,
      user_id,
      type,
      amount,
      currency,
      status,
      description,
      reference_id,
      metadata
    ) VALUES (
      v_wallet_id,
      p_user_id,
      'deposit',
      p_amount,
      'USD',
      'pending',
      'Crypto Deposit (' || UPPER(p_currency) || ') - ' || p_payment_provider,
      p_payment_id,
      v_full_metadata
    ) RETURNING id INTO v_transaction_id;

    -- Return the results
    RETURN QUERY SELECT
      v_transaction_id,
      v_wallet_id;

  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback will happen automatically
      RAISE EXCEPTION 'Failed to create crypto payment record: %', SQLERRM;
  END;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION crypto_create_payment TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION crypto_create_payment IS 'Creates a pending crypto payment transaction record with metadata including order_id, platform fees, and payment provider';

-- Example usage:
-- SELECT * FROM crypto_create_payment(
--   p_user_id := auth.uid(),
--   p_order_id := 'wallet-topup-123-1641234567890',
--   p_amount := 100.00,
--   p_fee_amount := 7.00,
--   p_currency := 'usdttrc20',
--   p_payment_provider := 'nowpayments',
--   p_payment_id := 'np_12345',
--   p_payment_url := 'https://app.com/payments/np_12345',
--   p_metadata := '{"network": "trc20", "fee_structure": "$7 fixed fee"}'::jsonb
-- );
