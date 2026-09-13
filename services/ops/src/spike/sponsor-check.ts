import { randomBytes } from "node:crypto";
import { isOk } from "@masayume/core/schemas";
import type { Address, Bytes32, Hex } from "@masayume/core/types";
import { closeRuntime, createMemoryJournal, createSubmitterSession, ensureMarkets, keyGasBalance, loadCollateral, parseMarketsEnv } from "@masayume/markets";
import { getArenaState, readArenaAgent, sendArenaIntent } from "@masayume/markets/games";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { finish } from "./finish";

/**
 * One pass of the games' sponsor on the deployed arena: a free-tier match is opened naming a fresh key
 * as the seat's agent with no gas sent, the web route is asked to fund that key, the key's balance is
 * read before and after, and the match is withdrawn. Scratch driver for slice C (2026-09-04).
 *
 *   PLAYER_KEY=… CHALLENGER=0x… WEB_URL=http://localhost:3000 pnpm --filter @masayume/ops spike:sponsor
 */
const WEB_URL = process.env.WEB_URL ?? "http://localhost:3000";
const CHALLENGER = (process.env.CHALLENGER ?? "").toLowerCase() as Address;
const bytes32 = (): Bytes32 => `0x${randomBytes(32).toString("hex")}`;

async function main(): Promise<void> {
  const key = process.env.PLAYER_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error("PLAYER_KEY is required");
  if (!/^0x[0-9a-f]{40}$/.test(CHALLENGER)) throw new Error("CHALLENGER (an address) is required");

  const env = parseMarketsEnv();
  ensureMarkets(env);
  const collateral = await loadCollateral();
  if (!isOk(collateral)) throw new Error(`collateral unreadable: ${collateral.error.technical}`);
  const state = await getArenaState();
  if (!isOk(state) || !state.value) throw new Error("no arena on this network");
  const cap = state.value.tiers[0]?.perCardCapBase ?? 0n;

  const session = await createSubmitterSession({ env, authority: "user-wallet", signer: { privateKey: key as Hex }, journal: createMemoryJournal() });
  const agent = privateKeyToAccount(generatePrivateKey()).address as Address;
  const matchId = bytes32();
  const deckSize = 3;
  console.log(`creator ${session.address} · agent ${agent} · match ${matchId}`);

  const created = await sendArenaIntent(session.contracts, {
    kind: "arena-create",
    matchId,
    challenger: CHALLENGER,
    tier: 0,
    deckHash: bytes32(),
    deckSize,
    policyVersion: 1,
    potBase: 0n,
    agent: { agent, ttlSec: 600, budgetBase: cap * BigInt(deckSize), gasWei: 0n },
  });
  console.log(`created with agent, no value: ${created.hash} · gas ${created.receipt.gasUsed}`);

  const named = await readArenaAgent(matchId, session.address);
  console.log(`arena names ${isOk(named) && named.value ? named.value.agent : "nobody"} for the seat`);
  const before = await keyGasBalance(agent);

  const ask = async (label: string) => {
    const res = await fetch(`${WEB_URL}/api/games/sponsor`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-masayume-device": "sponsor-check" },
      body: JSON.stringify({ matchId, player: session.address, agent }),
    });
    const body = (await res.json()) as { hash?: string; amountWei?: string; why?: string; error?: string };
    console.log(`${label}: ${res.status} ${JSON.stringify(body)}`);
  };
  // A stranger's key first: the arena never named it, so the sponsor must send it nothing — before the
  // once-per-seat guard could stand in for that refusal.
  const stranger = privateKeyToAccount(generatePrivateKey()).address;
  const res = await fetch(`${WEB_URL}/api/games/sponsor`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-masayume-device": "sponsor-check" },
    body: JSON.stringify({ matchId, player: session.address, agent: stranger }),
  });
  console.log(`stranger's key (must refuse: not the seat's): ${res.status} ${JSON.stringify(await res.json())}`);

  await ask("sponsor, first ask");
  const after = await keyGasBalance(agent);
  console.log(`key balance ${Number(before) / 1e18} → ${Number(after) / 1e18} STT`);
  await ask("sponsor, second ask (must refuse: once per seat)");

  const cancelled = await sendArenaIntent(session.contracts, { kind: "arena-cancel", matchId });
  console.log(`withdrawn: ${cancelled.hash}`);
  await session.dispose();
  await closeRuntime();
}

void main()
  .then(() => finish(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message.split("\n").slice(0, 3).join(" ") : error);
    finish(1);
  });
