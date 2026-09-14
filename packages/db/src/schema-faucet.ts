export const FAUCET_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS faucet_challenges (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at_ms BIGINT NOT NULL,
  expires_at_ms BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS faucet_challenges_ip_time ON faucet_challenges (ip_hash, created_at_ms);
CREATE INDEX IF NOT EXISTS faucet_challenges_wallet_time ON faucet_challenges (wallet, created_at_ms);
-- Solana devnet SOL top-ups (D-012). A new table, not an altered one: the EVM-era faucet_claims (wei, nonce) is left untouched.
CREATE TABLE IF NOT EXISTS sol_faucet_claims (
  id TEXT PRIMARY KEY REFERENCES faucet_challenges(id),
  wallet TEXT NOT NULL,
  funder TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  amount_lamports NUMERIC(20,0) NOT NULL CHECK (amount_lamports > 0),
  fee_lamports NUMERIC(20,0) NOT NULL CHECK (fee_lamports >= 0),
  last_valid_block_height BIGINT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  raw_transaction TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('prepared','confirmed','reverted','conflict')),
  created_at_ms BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sol_faucet_claims_wallet_time ON sol_faucet_claims (wallet, created_at_ms);
CREATE INDEX IF NOT EXISTS sol_faucet_claims_time ON sol_faucet_claims (created_at_ms);
-- Server-sent test tUSDC mints (D-034): the SOL columns with the amount in tUSDC base units. One per challenge id.
CREATE TABLE IF NOT EXISTS tusdc_faucet_claims (
  id TEXT PRIMARY KEY REFERENCES faucet_challenges(id),
  wallet TEXT NOT NULL,
  funder TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  amount_base NUMERIC(20,0) NOT NULL CHECK (amount_base > 0),
  fee_lamports NUMERIC(20,0) NOT NULL CHECK (fee_lamports >= 0),
  last_valid_block_height BIGINT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  raw_transaction TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('prepared','confirmed','reverted','conflict')),
  created_at_ms BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS tusdc_faucet_claims_wallet_time ON tusdc_faucet_claims (wallet, created_at_ms);
CREATE INDEX IF NOT EXISTS tusdc_faucet_claims_time ON tusdc_faucet_claims (created_at_ms);
`;
