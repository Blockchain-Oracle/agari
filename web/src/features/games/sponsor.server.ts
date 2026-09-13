import { isOk } from "@masayume/core/schemas";
import type { Address, Bytes32, Hex } from "@masayume/core/types";
import { ensureMarkets, getClient, keyGasBalance } from "@masayume/markets";
import { getArenaMatch, readArenaAgent, resolveArenaDeployment, sponsorKeyTopUp } from "@masayume/markets/games";
import type { PublicClient } from "viem";
import { gate, marketsEnvFromProcess, sponsorConfig, type SponsorConfig } from "@/features/session/sponsor.server";
import { sponsorDefaultCapWei, sponsorTopUpWei } from "./duel/gas";

/**
 * The games' sponsor — server only. Nothing here may be imported by a component.
 *
 * Flicky sponsors every transaction through an address-balance relayer, so a player signs nothing and
 * pays nothing per card. The vault's lane here relays through the ERC-2771 forwarder; the arena's agent
 * check is `msg.sender`, so the same sponsor pays the duel's gas another way — it sends STT to the seat's
 * key, and the key pays for its own picks. What makes that safe is the order: the sponsor funds only a key
 * the arena has already named for a live seat (`agentOf(match, player)`), once per seat per match, up to
 * the deck's own envelope, under the same per-address and per-device gates the vault's lane uses. A key
 * the chain never named gets nothing, which is what stops the route being a faucet.
 *
 * The same `SPONSOR_PRIVATE_KEY` funds both lanes: one operator key, one balance to watch. The policy is
 * the vault's own (AD-15) — the sponsor never puts capital in; an entry that escrows a pot is the player's
 * transaction, and only the picks' gas is the sponsor's.
 */
export const SPONSOR_GAME_CAP_ENV = "SPONSOR_GAME_MAX_WEI";
/** Below this many decks' worth of STT the status says the sponsor is not ready, so an entry funds its own key. */
const READY_DECKS = 2n;

export interface GameSponsorStatusWire {
  configured: boolean;
  sponsor: Address | null;
  balanceWei: string | null;
  capWei: string;
  /** What the sponsor must hold, per match at the widest deck, to call itself ready. */
  deckEnvelopeWei: string;
  ready: boolean;
}

export type FundVerdict = { ok: true; amountWei: bigint; hash: Hex | null; why: string } | { ok: false; status: number; error: string };

/** The operator's per-match ceiling, or one full deck's envelope. */
export function gameSponsorCapWei(): bigint {
  const raw = process.env[SPONSOR_GAME_CAP_ENV];
  return raw && /^\d+$/.test(raw) ? BigInt(raw) : sponsorDefaultCapWei();
}

function boot(): { config: SponsorConfig | null; deployment: ReturnType<typeof resolveArenaDeployment> } {
  const env = marketsEnvFromProcess();
  ensureMarkets(env);
  return { config: sponsorConfig(env), deployment: resolveArenaDeployment(env) };
}

export async function gameSponsorStatus(): Promise<GameSponsorStatusWire> {
  const { config, deployment } = boot();
  const cap = gameSponsorCapWei();
  const envelope = sponsorDefaultCapWei();
  let balanceWei: bigint | null = null;
  if (config) balanceWei = await getClient().getNativeBalance(config.sponsor).catch(() => null);
  const configured = config !== null && deployment !== null;
  return {
    configured,
    sponsor: config?.sponsor ?? null,
    balanceWei: balanceWei === null ? null : balanceWei.toString(),
    capWei: cap.toString(),
    deckEnvelopeWei: envelope.toString(),
    ready: configured && balanceWei !== null && balanceWei >= envelope * READY_DECKS,
  };
}

/** One top-up per seat per match. In this process; a multi-instance deploy would count per instance (AD-7). */
const fundedSeats = new Map<string, Hex | null>();

const LIVE = new Set(["waiting", "activeUnrevealed", "picking"]);

export async function fundSeatKey(input: { matchId: Bytes32; player: Address; agent: Address; device: string; nowMs: number }): Promise<FundVerdict> {
  const { config, deployment } = boot();
  if (!config) return { ok: false, status: 503, error: "no sponsor is configured on this deployment; the entry funds the key" };
  if (!deployment) return { ok: false, status: 503, error: "GameArena is not deployed on this network" };

  const matchId = input.matchId.toLowerCase() as Bytes32;
  const player = input.player.toLowerCase() as Address;
  const agent = input.agent.toLowerCase() as Address;

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

  const held = await keyGasBalance(agent).catch(() => null);
  if (held === null) return { ok: false, status: 502, error: "the key's balance could not be read" };
  const amountWei = sponsorTopUpWei(record.deckSize, held, gameSponsorCapWei());
  if (amountWei === 0n) {
    fundedSeats.set(seat, null);
    return { ok: true, amountWei: 0n, hash: null, why: "the key already holds its envelope" };
  }

  const balance = await getClient().getNativeBalance(config.sponsor).catch(() => null);
  if (balance === null || balance < amountWei) return { ok: false, status: 503, error: "the sponsor is dry; the entry would have to fund the key" };

  // Claimed before the send, so a second ask that lands mid-flight is refused rather than paid twice.
  fundedSeats.set(seat, null);
  try {
    const hash = await sponsorKeyTopUp({ privateKey: config.privateKey, rpcUrl: config.rpcUrl, key: agent, amountWei, publicClient: getClient().getViemClient() as PublicClient });
    fundedSeats.set(seat, hash);
    return { ok: true, amountWei, hash, why: `topped the key up to the deck's envelope for ${record.deckSize} cards` };
  } catch (error) {
    fundedSeats.delete(seat);
    return { ok: false, status: 502, error: error instanceof Error ? error.message.split("\n")[0] ?? "the sponsor could not send" : "the sponsor could not send" };
  }
}
