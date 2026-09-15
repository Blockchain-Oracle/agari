/**
 * The fee-payer co-signs the sponsor actually issued (tap-trading.md §3 check 9, D-065). One row per signature the
 * server signed, which is what every gate counts: per-signer and per-device hours, the device's and the venue's daily
 * lamports. Nothing here is chain truth — the chain has the transaction; this is the sponsor's own spend journal.
 */
export const SPONSOR_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sponsor_cosigns (
  -- The sponsor's own signature (slot 0), which is also the transaction's id.
  signature               TEXT PRIMARY KEY,
  -- The other signer: a session key, an owner's wallet, or a cranker.
  signer                  TEXT NOT NULL,
  -- The browser's device id from x-agari-device; never empty (the policy refuses without one).
  device                  TEXT NOT NULL CHECK (length(device) > 0),
  -- The allowlisted instruction, as "agari_vault:<name>".
  instruction             TEXT NOT NULL,
  fee_lamports            NUMERIC(20,0) NOT NULL CHECK (fee_lamports >= 0),
  last_valid_block_height BIGINT NOT NULL,
  created_at_ms           BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sponsor_cosigns_time ON sponsor_cosigns (created_at_ms);
CREATE INDEX IF NOT EXISTS sponsor_cosigns_signer_time ON sponsor_cosigns (signer, created_at_ms);
CREATE INDEX IF NOT EXISTS sponsor_cosigns_device_time ON sponsor_cosigns (device, created_at_ms);
`;
