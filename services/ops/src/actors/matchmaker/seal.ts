import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { dirname } from "node:path";

/**
 * Sealing a deck's reveal material, and keeping a second copy of it somewhere else.
 *
 * Two failures are being defended against, and they are not the same failure.
 *
 * **Someone reading the store** would hold a preimage that opens a deck early, because `revealDeck` is
 * permissionless — so the material is encrypted with a key that is not in the database. AES-256-GCM
 * rather than CBC or CTR: the tag means a tampered ciphertext fails to open instead of decrypting to
 * something that hashes to the wrong commitment and looks like a bug in the contract.
 *
 * **Losing the store** would strand every unopened deck, and the doc's answer is a second recoverable
 * copy. A second table in the same Postgres is not a second copy — one outage takes both — so the copy
 * is an append-only file on the operator's own disk, and it is the one written *first*. That ordering
 * makes the file the durable record and the row the queryable one, which is why a deployment with no
 * database can still deal a deck and still open it: `fromJournal` is the recovery path, and the settler
 * falls back to it. The claim "no durable reveal, no join" is enforced against the file, not the row.
 */

const KEY_ENV = "GAME_DECK_KEY";
const JOURNAL_ENV = "GAME_DECK_JOURNAL";
const DEFAULT_JOURNAL = ".masayume/deck-journal.jsonl";

export interface RevealMaterial {
  matchId: string;
  serverSeed: string;
  clientSeeds: readonly string[];
  cards: readonly string[];
  policyVersion: number;
}

/** The key, or null when the operator has not set one — in which case no deck may be committed at all. */
export function deckKey(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  const raw = env[KEY_ENV];
  if (!raw || !/^(0x)?[0-9a-fA-F]{64}$/.test(raw)) return null;
  return Buffer.from(raw.replace(/^0x/, ""), "hex");
}

export const DECK_KEY_ENV = KEY_ENV;

/** `iv.ciphertext.tag`, base64url — one string, so the column needs no structure of its own. */
export function seal(material: RevealMaterial, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(material), "utf8"), cipher.final()]);
  return [iv, body, cipher.getAuthTag()].map((part) => part.toString("base64url")).join(".");
}

/** Opens what `seal` wrote. Throws on a tampered or truncated value rather than returning something. */
export function open(sealed: string, key: Buffer): RevealMaterial {
  const parts = sealed.split(".");
  if (parts.length !== 3) throw new Error("sealed deck is malformed");
  const [iv, body, tag] = parts.map((part) => Buffer.from(part, "base64url")) as [Buffer, Buffer, Buffer];
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  return JSON.parse(plain) as RevealMaterial;
}

/**
 * The second copy, appended before the row is written. `appendFileSync` on purpose: this is the one
 * write in the process that must not be lost to a crash between the call and the flush.
 */
export function journal(matchId: string, sealed: string, env: NodeJS.ProcessEnv = process.env): string {
  const path = env[JOURNAL_ENV] ?? DEFAULT_JOURNAL;
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify({ matchId, sealed, atMs: Date.now() })}\n`, "utf8");
  return path;
}

/**
 * The sealed material for one match, read back off the journal — the recovery path when the database is
 * gone or was never configured. Last entry wins, because the file is append-only and a re-deal appends.
 */
export function fromJournal(matchId: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const path = env[JOURNAL_ENV] ?? DEFAULT_JOURNAL;
  if (!existsSync(path)) return null;
  const wanted = matchId.toLowerCase();
  let found: string | null = null;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as { matchId?: string; sealed?: string };
      if (row.matchId?.toLowerCase() === wanted && row.sealed) found = row.sealed;
    } catch {
      // A half-written last line after a crash is expected; the entries before it are still good.
    }
  }
  return found;
}
