/**
 * The client half of the fee-payer co-sign (tap-trading.md §3): `GET /api/sponsor` for the fee payer to build with,
 * then `POST { transaction, lastValidBlockHeight }` with the device header for the signature over slot 0. Browser-safe
 * on purpose — `@agari/markets/sponsor` is the server's policy and reads the role key, so nothing here imports it.
 * The server never sends: markets journals the signature it gets back and sends on its own lane.
 */
import type { Address, Signature } from "@agari/core/types";
import type { SponsorStatus } from "../sponsor/status";
import type { CosignResult, SponsorCosigner } from "../vault/cosign";

export interface SponsorTransportConfig {
  /** The route's path or absolute URL (`/api/sponsor` in the web). */
  endpoint: string;
  /** This browser's id for the sponsor's per-device gate; an empty id is refused by the server, never guessed. */
  device: string;
  /** The status is re-asked at most this often while a key is armed (the breaker and balance move slowly). */
  statusTtlMs?: number;
  fetch?: typeof globalThis.fetch;
}

export interface SponsorTransport extends SponsorCosigner {
  /** The last refusal the sponsor gave, for the sheet that wants to say why the key paid instead. */
  lastRefusal(): string | null;
  status(): Promise<SponsorStatus>;
}

/** `GET /api/sponsor` on the wire: lamports as a decimal string (tap-trading.md §3). */
interface SponsorWire {
  configured: boolean;
  sponsor: Address | null;
  balanceLamports: string | null;
  allowlist: readonly string[];
  reason?: string;
}

const UNREACHABLE = (reason: string): SponsorStatus => ({ configured: false, sponsor: null, balanceLamports: null, allowlist: [], reason });
const DEFAULT_TTL_MS = 60_000;

export function createSponsorTransport(config: SponsorTransportConfig): SponsorTransport {
  const call = config.fetch ?? globalThis.fetch.bind(globalThis);
  const ttlMs = config.statusTtlMs ?? DEFAULT_TTL_MS;
  let cached: { atMs: number; status: SponsorStatus } | null = null;
  let refusal: string | null = null;

  const status = async (): Promise<SponsorStatus> => {
    if (cached && Date.now() - cached.atMs < ttlMs) return cached.status;
    let answer: SponsorStatus;
    try {
      // `cache-control` rather than `cache: "no-store"`: the same code compiles for the browser and for the ops
      // service, whose fetch types have no `cache` field.
      const response = await call(config.endpoint, { headers: { "cache-control": "no-store" } });
      const wire = (await response.json()) as SponsorWire;
      answer = {
        configured: wire.configured === true,
        sponsor: wire.sponsor ?? null,
        allowlist: wire.allowlist ?? [],
        balanceLamports: wire.balanceLamports == null ? null : BigInt(wire.balanceLamports),
        ...(wire.reason ? { reason: wire.reason } : {}),
      };
    } catch (error) {
      answer = UNREACHABLE(error instanceof Error ? error.message : "the sponsor could not be reached");
    }
    cached = { atMs: Date.now(), status: answer };
    return answer;
  };

  return {
    status,
    lastRefusal: () => refusal,
    async sponsor() {
      const answer = await status();
      if (!answer.configured) refusal = answer.reason ?? "no sponsor is configured";
      return answer.configured ? answer.sponsor : null;
    },
    async cosign({ transaction, lastValidBlockHeight }): Promise<CosignResult> {
      const refuse = (reason: string): CosignResult => {
        refusal = reason;
        // A refused co-sign may mean the breaker opened: ask for a fresh status before the next build.
        cached = null;
        return { ok: false, reason };
      };
      let response: Response;
      try {
        response = await call(config.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", "cache-control": "no-store", "x-agari-device": config.device },
          body: JSON.stringify({ transaction, lastValidBlockHeight: lastValidBlockHeight.toString() }),
        });
      } catch (error) {
        return refuse(error instanceof Error ? error.message : "the sponsor could not be reached");
      }
      const body = (await response.json().catch(() => null)) as { error?: string; signature?: string; transaction?: string } | null;
      if (!response.ok || !body?.transaction || !body.signature) return refuse(body?.error ?? `the sponsor answered ${response.status}`);
      refusal = null;
      return { ok: true, transaction: body.transaction, signature: body.signature as Signature };
    },
  };
}
