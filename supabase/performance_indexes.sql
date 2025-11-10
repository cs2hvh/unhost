-- Performance Indexes for Unhost Database
-- Run this script to improve query performance

-- Servers table indexes
CREATE INDEX IF NOT EXISTS idx_servers_owner_id ON servers(owner_id);
CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);
CREATE INDEX IF NOT EXISTS idx_servers_created_at ON servers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_servers_linode_id ON servers(linode_id);
CREATE INDEX IF NOT EXISTS idx_servers_owner_status ON servers(owner_id, status);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_servers_owner_created ON servers(owner_id, created_at DESC);

-- Wallets table indexes
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_currency ON wallets(user_id, currency);

-- Wallet transactions indexes
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_created ON wallet_transactions(wallet_id, created_at DESC);

-- Support tickets indexes
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_updated_at ON tickets(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_user_status ON tickets(user_id, status);

-- Ticket messages indexes
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_created_at ON ticket_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_is_staff ON ticket_messages(is_staff);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_created ON ticket_messages(ticket_id, created_at ASC);

-- Crypto payments indexes
CREATE INDEX IF NOT EXISTS idx_crypto_payments_user_id ON crypto_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_crypto_payments_payment_id ON crypto_payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_crypto_payments_status ON crypto_payments(status);
CREATE INDEX IF NOT EXISTS idx_crypto_payments_created_at ON crypto_payments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crypto_payments_user_status ON crypto_payments(user_id, status);

-- Pricing config indexes (if exists)
CREATE INDEX IF NOT EXISTS idx_pricing_config_plan_type ON pricing_config(plan_type);
CREATE INDEX IF NOT EXISTS idx_pricing_config_enabled ON pricing_config(enabled);

-- Auth users indexes (Supabase managed, but useful for queries)
-- These may already exist, but adding IF NOT EXISTS is safe
CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth.users(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_created_at ON auth.users(created_at DESC);

-- User metadata indexes (if using user_metadata frequently)
-- Note: GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_users_metadata_is_admin ON auth.users USING gin ((raw_user_meta_data) jsonb_path_ops) 
WHERE (raw_user_meta_data->>'is_admin')::boolean = true;

-- Server billing indexes (if you have a billing table)
-- Uncomment if you track billing separately
-- CREATE INDEX IF NOT EXISTS idx_server_billing_server_id ON server_billing(server_id);
-- CREATE INDEX IF NOT EXISTS idx_server_billing_created_at ON server_billing(created_at DESC);

-- Analyze tables for query planner
ANALYZE servers;
ANALYZE wallets;
ANALYZE wallet_transactions;
ANALYZE tickets;
ANALYZE ticket_messages;
ANALYZE crypto_payments;

-- Vacuum tables to reclaim space and update statistics
VACUUM ANALYZE servers;
VACUUM ANALYZE wallets;
VACUUM ANALYZE wallet_transactions;
VACUUM ANALYZE tickets;
VACUUM ANALYZE ticket_messages;
VACUUM ANALYZE crypto_payments;

COMMENT ON INDEX idx_servers_owner_id IS 'Fast lookup of servers by owner';
COMMENT ON INDEX idx_servers_owner_status IS 'Fast filtering of user servers by status';
COMMENT ON INDEX idx_tickets_user_status IS 'Efficient ticket queries by user and status';
COMMENT ON INDEX idx_wallet_transactions_wallet_created IS 'Optimized transaction history queries';
