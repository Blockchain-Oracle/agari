/** What the relay needs, and what is missing — read once, reported in the heartbeat, never a crash. */
export interface RelayEnv {
  /** The account's session, encoded by rettiwt's own key format (the four session cookies, base64). */
  rettiwtApiKey: string;
  /** The handle whose mentions are the instructions, without the `@`. */
  handle: string;
  executorPrivateKey: `0x${string}`;
  /** Replies are posted as the account only when asked for. */
  postingEnabled: boolean;
  /** Branded images accompany receipts by default; set X_REPLY_IMAGES_ENABLED=0 for text only. */
  replyImagesEnabled: boolean;
  pollMs: number;
  databaseUrl: string;
}

export const RELAY_ENV = {
  rettiwtKey: "X_RETTIWT_API_KEY",
  handle: "X_HANDLE",
  executor: "X_EXECUTOR_PRIVATE_KEY",
  posting: "X_POSTING_ENABLED",
  images: "X_REPLY_IMAGES_ENABLED",
  poll: "X_POLL_MS",
  db: "DATABASE_URL",
} as const;

const DEFAULT_POLL_MS = 20_000;

export type RelayEnvReading = { ok: true; env: RelayEnv } | { ok: false; missing: string[] };

export function readRelayEnv(): RelayEnvReading {
  const missing: string[] = [];
  const rettiwtApiKey = process.env.X_RETTIWT_API_KEY ?? "";
  const handle = (process.env.X_HANDLE ?? "").replace(/^@/, "");
  const executorPrivateKey = process.env.X_EXECUTOR_PRIVATE_KEY ?? "";
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (!rettiwtApiKey) missing.push(RELAY_ENV.rettiwtKey);
  if (!handle) missing.push(RELAY_ENV.handle);
  if (!/^0x[0-9a-fA-F]{64}$/.test(executorPrivateKey)) missing.push(RELAY_ENV.executor);
  if (!databaseUrl) missing.push(RELAY_ENV.db);
  if (missing.length > 0) return { ok: false, missing };
  const pollMs = Number(process.env.X_POLL_MS);
  return {
    ok: true,
    env: {
      rettiwtApiKey,
      handle,
      executorPrivateKey: executorPrivateKey as `0x${string}`,
      postingEnabled: process.env.X_POSTING_ENABLED === "1" || process.env.X_POSTING_ENABLED === "true",
      replyImagesEnabled: process.env.X_REPLY_IMAGES_ENABLED !== "0" && process.env.X_REPLY_IMAGES_ENABLED !== "false",
      pollMs: Number.isFinite(pollMs) && pollMs >= 5_000 ? pollMs : DEFAULT_POLL_MS,
      databaseUrl,
    },
  };
}
