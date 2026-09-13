/**
 * What the X rail needs from the environment, and what is missing — server only.
 *
 * Every route answers `{ configured: false, missing: [...] }` rather than failing when a
 * variable is absent, so the pages keep their controls and say exactly what would connect them.
 *
 * Sign-in is OAuth 1.0a (2026-09-05), so the app's consumer key pair is what the web needs — the
 * same "API Key / API Key Secret" the developer portal shows first; no OAuth 2.0 client.
 */
export interface XConfig {
  consumerKey: string;
  consumerSecret: string;
  redirectUri: string;
  sessionSecret: string;
  /** The executor wallet an EXECUTOR grant names; the relay signs from it. */
  executorAddress: string | null;
}

export type XConfigReading = { configured: true; config: XConfig } | { configured: false; missing: string[] };

export const X_ENV = {
  consumerKey: "X_API_KEY",
  consumerSecret: "X_API_KEY_SECRET",
  redirectUri: "X_REDIRECT_URI",
  sessionSecret: "X_SESSION_SECRET",
  executor: "X_EXECUTOR_ADDRESS",
} as const;

export function readXConfig(origin: string): XConfigReading {
  const consumerKey = process.env.X_API_KEY ?? "";
  const consumerSecret = process.env.X_API_KEY_SECRET ?? "";
  const sessionSecret = process.env.X_SESSION_SECRET ?? "";
  const missing: string[] = [];
  if (!consumerKey) missing.push(X_ENV.consumerKey);
  if (!consumerSecret) missing.push(X_ENV.consumerSecret);
  if (!sessionSecret) missing.push(X_ENV.sessionSecret);
  if (missing.length > 0) return { configured: false, missing };
  return {
    configured: true,
    config: {
      consumerKey,
      consumerSecret,
      redirectUri: process.env.X_REDIRECT_URI || `${origin}/api/x/callback`,
      sessionSecret,
      executorAddress: executorAddress(),
    },
  };
}

/** The executor address is public information (it is what the grant names), so either spelling works. */
export function executorAddress(): string | null {
  const value = process.env.X_EXECUTOR_ADDRESS || process.env.NEXT_PUBLIC_X_EXECUTOR_ADDRESS || "";
  return /^0x[0-9a-fA-F]{40}$/.test(value) ? value.toLowerCase() : null;
}
