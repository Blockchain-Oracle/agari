/**
 * The indexer's read-only chain access (plan §4 indexer steps 1, 2, 6, 8): no signer, one request queue paced to a
 * requests-per-second budget (Helius devnet: 10 RPS for the whole service; the indexer's share is 3, venue-ops.md §1),
 * with bounded retries. Values leave as plain strings and numbers.
 */
import { AGARI_EVENTS_PROGRAM_ADDRESS, getSeriesDecoder } from "@agari/clients/agari-events";
import { TICKER_SYMBOLS, TICKERS, type TickerSymbol } from "@agari/core/market";
import {
  address,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  getBase64Encoder,
  getProgramDerivedAddress,
  signature as toSignature,
  type Signature,
} from "@solana/kit";
import type { RawTransaction } from "./decode";

export interface IndexerRpcConfig {
  rpcUrl: string;
  rpcSubscriptionsUrl: string;
  /** Requests per second across every call this client makes (default 3). */
  rps?: number;
}

export interface SignatureInfo {
  signature: string;
  slot: number;
  blockTimeSec: number | null;
  failed: boolean;
}

export interface SeriesInfo {
  series: string;
  ticker: number;
  symbol: TickerSymbol | null;
  cadenceSec: number;
  basis: number;
  lotBase: string;
  tickBase: string;
  cashUnit: string;
}

export type IndexerRpc = Awaited<ReturnType<typeof createIndexerRpc>>;

const PAGE_LIMIT = 1_000;
const STATUS_BATCH = 256;
const RETRIES = 4;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const SYMBOL_BY_SERIES_ID = new Map<number, TickerSymbol>(TICKER_SYMBOLS.map((s) => [TICKERS[s].seriesId, s]));

export const AGARI_EVENTS_PROGRAM_ID: string = AGARI_EVENTS_PROGRAM_ADDRESS;

/** The `__event_authority` PDA every `emit_cpi!` inner instruction names first. */
export async function eventAuthorityOf(programId = AGARI_EVENTS_PROGRAM_ID): Promise<string> {
  const [pda] = await getProgramDerivedAddress({ programAddress: address(programId), seeds: ["__event_authority"] });
  return pda;
}

export async function createIndexerRpc(config: IndexerRpcConfig) {
  const rpc = createSolanaRpc(config.rpcUrl);
  const subscriptions = createSolanaRpcSubscriptions(config.rpcSubscriptionsUrl);
  const gapMs = 1000 / Math.max(0.2, config.rps ?? 3);
  let nextAtMs = 0;

  /** Paces every request start and retries transient failures with backoff. */
  async function call<T>(send: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const now = Date.now();
      nextAtMs = Math.max(now, nextAtMs) + gapMs;
      const wait = nextAtMs - gapMs - now;
      if (wait > 0) await sleep(wait);
      try {
        return await send();
      } catch (error) {
        if (attempt >= RETRIES) throw error;
        await sleep(500 * 2 ** attempt);
      }
    }
  }

  return {
    /** Newest first, at most 1,000 per call; `before`/`until` exclude the named signatures. */
    async signaturesPage(of: string, options: { before?: string; until?: string; limit?: number } = {}): Promise<SignatureInfo[]> {
      const rows = await call(() =>
        rpc
          .getSignaturesForAddress(address(of), {
            commitment: "confirmed",
            limit: options.limit ?? PAGE_LIMIT,
            ...(options.before ? { before: toSignature(options.before) } : {}),
            ...(options.until ? { until: toSignature(options.until) } : {}),
          })
          .send(),
      );
      return rows.map((r) => ({ signature: r.signature, slot: Number(r.slot), blockTimeSec: r.blockTime === null ? null : Number(r.blockTime), failed: r.err !== null }));
    },

    /** The confirmed transaction, or null while the node doesn't have it yet. */
    async transaction(sig: string): Promise<RawTransaction | null> {
      const tx = await call(() =>
        rpc.getTransaction(toSignature(sig), { encoding: "json", maxSupportedTransactionVersion: 0, commitment: "confirmed" }).send(),
      );
      return tx as unknown as RawTransaction | null;
    },

    async finalizedSlot(): Promise<number> {
      return Number(await call(() => rpc.getSlot({ commitment: "finalized" }).send()));
    },

    /** Per signature: its slot and confirmation status, or null when the cluster doesn't know it. */
    async signatureStatuses(sigs: readonly string[]): Promise<Array<{ slot: number; status: string | null } | null>> {
      const out: Array<{ slot: number; status: string | null } | null> = [];
      for (let i = 0; i < sigs.length; i += STATUS_BATCH) {
        const batch = sigs.slice(i, i + STATUS_BATCH).map((s) => toSignature(s));
        const { value } = await call(() => rpc.getSignatureStatuses(batch, { searchTransactionHistory: true }).send());
        for (const row of value) out.push(row ? { slot: Number(row.slot), status: row.confirmationStatus } : null);
      }
      return out;
    },

    /** Series accounts decoded to what the projections need; null where the account doesn't exist. */
    async seriesInfo(addresses: readonly string[]): Promise<Array<SeriesInfo | null>> {
      if (addresses.length === 0) return [];
      const { value } = await call(() => rpc.getMultipleAccounts(addresses.map((a) => address(a)), { encoding: "base64" }).send());
      const decoder = getSeriesDecoder();
      return value.map((account, i) => {
        if (!account) return null;
        const s = decoder.decode(getBase64Encoder().encode(account.data[0]));
        return {
          series: addresses[i]!,
          ticker: s.ticker,
          symbol: SYMBOL_BY_SERIES_ID.get(s.ticker) ?? null,
          cadenceSec: s.cadenceSec,
          basis: s.basis,
          lotBase: s.lotBase.toString(),
          tickBase: s.tickBase.toString(),
          cashUnit: s.cashUnit.toString(),
        };
      });
    },

    /**
     * Streams signatures of confirmed transactions that mention `of` (`logsSubscribe`), failed ones included with
     * `failed`. Resolves when `signal` aborts; rejects when the socket drops, so the caller backfills and resubscribes.
     */
    async subscribeMentions(of: string, onSignature: (sig: string, failed: boolean, slot: number) => void, signal: AbortSignal, onReady?: () => void): Promise<void> {
      const stream = await subscriptions.logsNotifications({ mentions: [address(of)] }, { commitment: "confirmed" }).subscribe({ abortSignal: signal });
      onReady?.();
      for await (const note of stream) onSignature(note.value.signature as Signature, note.value.err !== null, Number(note.context.slot));
    },
  };
}

/**
 * Every signature mentioning `of` newer than `until` (exclusive), newest first, paging until a short page or a
 * slot below `stopBelowSlot`.
 */
export async function walkSignatures(rpc: IndexerRpc, of: string, options: { until?: string; stopBelowSlot?: number } = {}): Promise<SignatureInfo[]> {
  const out: SignatureInfo[] = [];
  let before: string | undefined;
  for (;;) {
    const page = await rpc.signaturesPage(of, { ...(before ? { before } : {}), ...(options.until ? { until: options.until } : {}) });
    for (const row of page) {
      if (options.stopBelowSlot !== undefined && row.slot < options.stopBelowSlot) return out;
      out.push(row);
    }
    if (page.length < PAGE_LIMIT) return out;
    before = page[page.length - 1]!.signature;
  }
}
