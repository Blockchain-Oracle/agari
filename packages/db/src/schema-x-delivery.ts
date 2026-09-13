/** Reply delivery is independent of execution. A post with an uncertain response is never retried automatically. */
export const X_DELIVERY_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS x_reply_delivery (
  mention_id TEXT PRIMARY KEY REFERENCES x_receipts(mention_id),
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'preparing', 'posting', 'sent', 'unknown', 'failed')),
  lease TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  reply_text TEXT,
  media_id TEXT,
  reply_id TEXT,
  error_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS x_reply_delivery_pending_idx ON x_reply_delivery(state, updated_at);
`;
