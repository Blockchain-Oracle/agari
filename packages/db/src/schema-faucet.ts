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
CREATE TABLE IF NOT EXISTS faucet_claims (
  id TEXT PRIMARY KEY REFERENCES faucet_challenges(id),
  wallet TEXT NOT NULL,
  funder TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  amount_wei NUMERIC(78,0) NOT NULL CHECK (amount_wei > 0),
  fee_wei NUMERIC(78,0) NOT NULL CHECK (fee_wei >= 0),
  nonce BIGINT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  raw_transaction TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('prepared','confirmed','reverted','conflict')),
  created_at_ms BIGINT NOT NULL,
  UNIQUE (funder, nonce)
);
CREATE INDEX IF NOT EXISTS faucet_claims_wallet_time ON faucet_claims (wallet, created_at_ms);
CREATE INDEX IF NOT EXISTS faucet_claims_time ON faucet_claims (created_at_ms);
`;
