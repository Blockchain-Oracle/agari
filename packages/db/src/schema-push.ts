/**
 * Phone push (S26.4): the devices that asked to be told when something happens to a wallet, and what each has been
 * told. A device row is written only by a wallet-signed registration, so a token can only ever follow the wallet
 * that signed, and only the phone holding that registration's secret can change or stop it. The sent journal is
 * what keeps a notification from going out twice across drains.
 */
export const PUSH_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS push_devices (
  -- The Expo push token ("ExponentPushToken[...]"): one row per install.
  expo_token     TEXT PRIMARY KEY,
  -- Base58, exact; the wallet that signed the registration. Re-registering under another wallet moves the device.
  wallet         TEXT NOT NULL,
  -- sha256 (hex) of the device secret the signed registration handed the phone; later changes present the secret.
  secret_hash    TEXT NOT NULL,
  platform       TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  -- Which kinds of news this device wants: any of 'fills', 'results', 'payouts'.
  kinds          TEXT[] NOT NULL,
  -- Nothing that happened before this second is announced (the moment the device registered for this wallet).
  since_sec      BIGINT NOT NULL,
  -- Set when Expo reports the token dead (DeviceNotRegistered) or the owner turns push off.
  disabled_at_ms BIGINT,
  created_at_ms  BIGINT NOT NULL,
  updated_at_ms  BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS push_devices_wallet ON push_devices (wallet) WHERE disabled_at_ms IS NULL;
CREATE TABLE IF NOT EXISTS push_sent (
  expo_token  TEXT NOT NULL,
  -- The activity item's stable id ("settled:<market>:<owner>", "fill:<sig>:…").
  item_id     TEXT NOT NULL,
  sent_at_ms  BIGINT NOT NULL,
  PRIMARY KEY (expo_token, item_id)
);
CREATE INDEX IF NOT EXISTS push_sent_time ON push_sent (sent_at_ms);
`;
