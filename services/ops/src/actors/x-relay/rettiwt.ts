import { Rettiwt } from "rettiwt-api";
import type { Mention, XTransport } from "./transport";

const PAGE = 20;
const MAX_PAGES = 50;

/**
 * The relay over the account's own session (`rettiwt-api`): X's search for `@handle`, newest first, and a
 * reply posted as the account. The API key is the account's cookies encoded by the library's own login
 * (`rettiwt auth login` or `Rettiwt.auth.login`), kept as a secret like any other.
 */
export function rettiwtTransport(apiKey: string, handle: string): XTransport {
  const user = handle.replace(/^@/, "");
  const client = new Rettiwt({ apiKey, timeout: 30_000, maxRetries: 2 });
  // A network retry after an accepted POST can create a duplicate public reply.
  const writer = new Rettiwt({ apiKey, timeout: 30_000, maxRetries: 0 });
  return {
    describe: () => `rettiwt (the account's session) · mentions of @${user}`,
    async authenticatedAuthorId() {
      const profile = await client.user.details();
      if (!profile || !/^\d+$/.test(profile.id) || profile.userName?.toLowerCase() !== user.toLowerCase()) {
        throw new Error("X session identity does not match the configured relay account");
      }
      return profile.id;
    },
    async fetchMentions(sinceId) {
      const mentions = new Map<string, Mention>();
      const cursors = new Set<string>();
      let cursor: string | undefined;
      for (let i = 0; i < MAX_PAGES; i++) {
        const page = await client.tweet.search({ mentions: [user], ...(sinceId !== null ? { sinceId } : {}) }, PAGE, cursor);
        for (const t of page.list) {
          if (!/^\d+$/.test(t.id)) throw new Error("Invalid mention id from X");
          if (!t.tweetBy?.id || (sinceId !== null && BigInt(t.id) <= BigInt(sinceId))) continue;
          mentions.set(t.id, {
          id: t.id,
          authorId: t.tweetBy.id,
          handle: t.tweetBy?.userName ?? null,
          text: t.fullText,
          createdAtMs: t.createdAt ? Date.parse(t.createdAt) || Date.now() : Date.now(),
          replyTo: t.replyTo ?? null,
          });
        }
        // First startup only establishes the newest cursor; never walk historical instructions.
        if (sinceId === null || page.list.length === 0 || !page.next || page.list.every(t => BigInt(t.id) <= BigInt(sinceId))) {
          return [...mentions.values()].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
        }
        if (cursors.has(page.next)) throw new Error("X mention pagination repeated a cursor");
        cursors.add(page.next);
        cursor = page.next;
      }
      // A partial search must not advance since_id beyond unseen instructions.
      throw new Error("X mention backlog exceeds the bounded drain; cursor retained");
    },
    uploadImage: async (png) => {
      const id = await writer.tweet.upload(Uint8Array.from(png).buffer);
      if (!/^\d+$/.test(id)) throw new Error("X image upload did not return a media id");
      return id;
    },
    reply: async (mentionId, text, mediaId) => {
      if (!/^\d+$/.test(mentionId) || (mediaId && !/^\d+$/.test(mediaId))) throw new Error("Invalid reply identifier");
      if (text.length > 280 || /[^\x20-\x7E\n]/.test(text)) throw new Error("Reply text exceeded its verified ASCII budget");
      const id = await writer.tweet.post({ text, replyTo: mentionId, ...(mediaId ? { media: [{ id: mediaId }] } : {}) });
      return typeof id === "string" && id ? id : null;
    },
  };
}
