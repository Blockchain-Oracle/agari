import { isOk } from "@agari/core/schemas";
import type { Address, Hash32, Signature } from "@agari/core/types";
import { ensureMarkets } from "@agari/markets";
import { getArenaMatch, readArenaAgent, resolveArenaDeployment } from "@agari/markets/games";
import { gate, marketsEnvFromProcess, sponsorConfig, type SponsorConfig } from "@/features/session/sponsor.server";
import { sponsorDefaultCapLamports } from "./duel/gas";

/**
 * The games' sponsor — server only. Nothing here may be imported by a component.
 *
 * Flicky sponsors every transaction through an address-balance relayer, so a player signs nothing and
 * pays nothing per card. On Solana the vault's lane has the sponsor co-sign as fee payer; the arena's agent is
 * the pick's own signer, so the same sponsor pays the duel's fees another way — it sends SOL to the seat's key, and
 * the key pays for its own picks. What makes that safe is the order: the sponsor funds only a key
 * the arena has already named for a live seat (`agentOf(match, player)`), once per seat per match, up to
 * the deck's own envelope, under the same per-address and per-device gates the vault's lane uses. A key
 * the chain never named gets nothing, which is what stops the route being a faucet.
 *
 * The same `SPONSOR_PRIVATE_KEY` funds both lanes: one operator key, one balance to watch. The policy is
 * the vault's own (AD-15) — the sponsor never puts capital in; an entry that escrows a pot is the player's
 * transaction, and only the picks' fees are the sponsor's.
 */
export const SPONSOR_GAME_CAP_ENV = "SPONSOR_GAME_MAX_LAMPORTS";
/** Below this many decks' worth of SOL the status says the sponsor is not ready, so an entry funds its own key. */
const READY_DECKS = 2n;

/** Amounts are lamports; the `*Wei` field names are the route's wire contract and stay until S12 reshapes the arena (D-010). */
export interface GameSponsorStatusWire {
  configured: boolean;
  sponsor: Address | null;
  balanceWei: string | null;
  capWei: string;
  /** What the sponsor must hold, per match at the widest deck, to call itself ready. */
  deckEnvelopeWei: string;
  ready: boolean;
}

export type FundVerdict = { ok: true; amountWei: bigint; hash: Signature | null; why: string } | { ok: false; status: number; error: string };

/** The operator's per-match ceiling, or one full deck's envelope. */
export function gameSponsorCapLamports(): bigint {
  const raw = process.env[SPONSOR_GAME_CAP_ENV];
  return raw && /^\d+$/.test(raw) ? BigInt(raw) : sponsorDefaultCapLamports();
}

function boot(): { config: SponsorConfig | null; deployment: ReturnType<typeof resolveArenaDeployment> } {
  const env = marketsEnvFromProcess();
  ensureMarkets(env);
  return { config: sponsorConfig(env), deployment: resolveArenaDeployment(env) };
}

/** The sponsor's SOL balance: a read the Solana adapter serves (S4). Unreadable until then, so no status claims ready. */
async function sponsorBalanceLamports(_config: SponsorConfig | null): Promise<bigint | null> {
  return null;
}

export async function gameSponsorStatus(): Promise<GameSponsorStatusWire> {
  const { config, deployment } = boot();
  const cap = gameSponsorCapLamports();
  const envelope = sponsorDefaultCapLamports();
  const balance = await sponsorBalanceLamports(config);
  const configured = config !== null && deployment !== null;
  return {
    configured,
    sponsor: config?.sponsor ?? null,
    balanceWei: balance === null ? null : balance.toString(),
    capWei: cap.toString(),
    deckEnvelopeWei: envelope.toString(),
    ready: configured && balance !== null && balance >= envelope * READY_DECKS,
  };
}

/** One top-up per seat per match. In this process; a multi-instance deploy would count per instance (AD-7). */
const fundedSeats = new Map<string, Signature | null>();

const LIVE = new Set(["waiting", "activeUnrevealed", "picking"]);

export async function fundSeatKey(input: { matchId: Hash32; player: Address; agent: Address; device: string; nowMs: number }): Promise<FundVerdict> {
  const { config, deployment } = boot();
  if (!config) return { ok: false, status: 503, error: "no sponsor is configured on this deployment; the entry funds the key" };
  if (!deployment) return { ok: false, status: 503, error: "GameArena is not deployed on this network" };

  // The match id is hex and folds case; the wallet and the key are base58 and are compared exactly (D-010).
  const matchId = input.matchId.toLowerCase() as Hash32;
  const { player, agent } = input;

  const seat = `${matchId}:${player}`;
  if (fundedSeats.has(seat)) return { ok: false, status: 409, error: "this seat's key was already funded for this match" };

  const match = await getArenaMatch(matchId);
  if (!isOk(match)) return { ok: false, status: 502, error: "the arena could not be read" };
  if (!match.value) return { ok: false, status: 404, error: "the arena has no match by that id" };
  const record = match.value.match;
  if (record.creator !== player && record.challenger !== player) return { ok: false, status: 403, error: "that wallet is not in this match" };
  if (!LIVE.has(record.status)) return { ok: false, status: 409, error: `this match is ${record.status}; there are no picks left to pay for` };

  const named = await readArenaAgent(matchId, player);
  if (!isOk(named)) return { ok: false, status: 502, error: "the seat's agent could not be read" };
  if (!named.value || named.value.agent !== agent) return { ok: false, status: 403, error: "the arena has not named that key for this seat — the sponsor funds only what the chain vouches for" };
  if (named.value.expiresAtSec <= Math.floor(input.nowMs / 1_000)) return { ok: false, status: 409, error: "that key's grant has expired" };

  const byDevice = gate("device", input.device, config.maxPerDevicePerHour, input.nowMs);
  if (!byDevice.ok) return { ok: false, status: 429, error: byDevice.reason };
  const byAddress = gate("address", player, config.maxPerAddressPerHour, input.nowMs);
  if (!byAddress.ok) return { ok: false, status: 429, error: byAddress.reason };

  // Sizing and sending the top-up need the key's and the sponsor's SOL balances and a signed transfer from the
  // sponsor's keypair: the Solana adapter's reads and sends (S4), built for the arena program (S12). Until then the
  // route stops here, honestly, after every gate above has run; `sponsorTopUpLamports` sizes the send when it lands.
  return { ok: false, status: 503, error: "the sponsor's SOL transfer lands with the arena program; the entry funds the key" };
}
