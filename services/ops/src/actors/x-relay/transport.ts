/** One mention of the account, as the relay reads it: who said what, when, and the post's own id. */
export interface Mention {
  id: string;
  authorId: string;
  handle: string | null;
  text: string;
  createdAtMs: number;
  replyTo?: string | null;
}

/**
 * The current deployment uses its existing account-session transport. Keep posting and uploading
 * separate so an upload failure can fall back to text before any reply is sent. The operator must
 * review X's current transport/automation requirements; this interface makes no policy or price claim.
 */
export interface XTransport {
  /** One line for the boot log: which way, and as whom. */
  describe(): string;
  /** Resolve the session's stable account id and verify the configured handle before polling. */
  authenticatedAuthorId(): Promise<string>;
  /** Mentions newer than `sinceId`, oldest first. */
  fetchMentions(sinceId: string | null): Promise<Mention[]>;
  /** Upload only; this must never post or execute an instruction. */
  uploadImage?: (png: Uint8Array) => Promise<string>;
  /** One POST attempt under the mention; no hidden retries after ambiguous responses. */
  reply: ((mentionId: string, text: string, mediaId?: string) => Promise<string | null>) | null;
}
