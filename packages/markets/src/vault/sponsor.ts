import { GAS_CEILING, type GasLane } from "@masayume/core/constants";
import type { Address, Hex } from "@masayume/core/types";
import {
  createWalletClient,
  http,
  toFunctionSelector,
  type ContractFunctionName,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { SOMNIA_SHANNON } from "../chain";
import { getClient } from "../runtime/read-runtime";
import { eventVaultAbi } from "../contracts/event-vault.abi";
import { forwarderAbi } from "../contracts/forwarder.abi";

/**
 * The sponsorship policy, as code (AD-15, NFR-7).
 *
 * A relayer pays gas for what the owner or the owner's session key signed, through the
 * ERC-2771 forwarder the vault trusts. Only these vault functions may ever ride it: every one
 * of them moves the signer's own funds or positions inside the vault's rules, and none of them
 * puts new capital in. Deposits, grants and grant funding are capital intake — never sponsored.
 */
export const SPONSORABLE_FUNCTIONS = ["placeFor", "withdraw", "withdrawPrivate", "revoke", "crankSettle", "sweep"] as const;
export type SponsorableFunction = (typeof SPONSORABLE_FUNCTIONS)[number];
export const NEVER_SPONSORED_FUNCTIONS = ["deposit", "depositAndGrant", "grant", "fundGrant"] as const;

type VaultFn = ContractFunctionName<typeof eventVaultAbi, "nonpayable">;

function selectorOf(name: string): Hex {
  const item = eventVaultAbi.find((entry) => entry.type === "function" && entry.name === name);
  if (!item || item.type !== "function") throw new Error(`no such vault function: ${name}`);
  return toFunctionSelector(item);
}

const SPONSORABLE_SELECTORS = new Map<Hex, SponsorableFunction>(SPONSORABLE_FUNCTIONS.map((name) => [selectorOf(name), name]));

/** Which allowlisted function a calldata blob targets, or null — the only question the policy asks of the bytes. */
export function sponsorableFunctionOf(data: Hex): SponsorableFunction | null {
  return SPONSORABLE_SELECTORS.get(data.slice(0, 10).toLowerCase() as Hex) ?? null;
}

export function isSponsorable(functionName: VaultFn): functionName is SponsorableFunction {
  return (SPONSORABLE_FUNCTIONS as readonly string[]).includes(functionName);
}

/** OpenZeppelin `ERC2771Forwarder.ForwardRequestData`, as the wire carries it (bigints as decimal strings). */
export interface ForwardRequestWire {
  from: Address;
  to: Address;
  value: string;
  gas: string;
  /** The forwarder's `deadline` (uint48), in seconds. */
  deadlineSec: number;
  data: Hex;
  signature: Hex;
}

/** The struct the forwarder verifies and executes; its field is named `deadline` and is in seconds. */
export function toForwardTuple(wire: ForwardRequestWire) {
  return {
    from: wire.from,
    to: wire.to,
    value: BigInt(wire.value),
    gas: BigInt(wire.gas),
    ["deadline"]: wire.deadlineSec,
    data: wire.data,
    signature: wire.signature,
  } as const;
}

export interface SponsorStatus {
  configured: boolean;
  sponsor: Address | null;
  balanceWei: bigint | null;
  forwarder: Address | null;
  allowlist: readonly SponsorableFunction[];
}

/** The forwarder's typed-data shape; the struct hash the relayer verifies is over exactly these fields. */
export const FORWARD_REQUEST_TYPES = {
  ForwardRequest: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "gas", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint48" },
    { name: "data", type: "bytes" },
  ],
} as const;

export const FORWARD_DEADLINE_SEC = 10 * 60;

export interface SignForwardInput {
  walletClient: WalletClient;
  publicClient: PublicClient;
  forwarder: Address;
  to: Address;
  data: Hex;
  gas: bigint;
  nowSec: number;
}

/** The signer signs; the relayer will pay. The domain and nonce are read off the forwarder so nothing here can drift from it. */
export async function signForwardRequest({ walletClient, publicClient, forwarder, to, data, gas, nowSec }: SignForwardInput): Promise<ForwardRequestWire> {
  const account = walletClient.account;
  if (!account) throw new Error("the signing client has no account bound");
  const [, name, version, chainId, verifyingContract] = await publicClient.readContract({ address: forwarder, abi: forwarderAbi, functionName: "eip712Domain" });
  const nonce = await publicClient.readContract({ address: forwarder, abi: forwarderAbi, functionName: "nonces", args: [account.address] });
  const deadlineSec = nowSec + FORWARD_DEADLINE_SEC;
  const signature = await walletClient.signTypedData({
    account,
    domain: { name, version, chainId: Number(chainId), verifyingContract },
    types: FORWARD_REQUEST_TYPES,
    primaryType: "ForwardRequest",
    message: { from: account.address, to, value: 0n, gas, nonce, ["deadline"]: deadlineSec, data },
  });
  return { from: account.address as Address, to, value: "0", gas: gas.toString(), deadlineSec, data, signature };
}

/** What a sponsor transport hands the relayer and what it gets back. */
export interface SponsoredCall {
  functionName: VaultFn;
  to: Address;
  data: Hex;
  gas: bigint;
}

export interface SponsorTransport {
  /** Whether the relayer would even be asked for this function; the gas gate is skipped only then. */
  covers(functionName: VaultFn): boolean;
  /** The transaction hash once the relayer sent it, or null when it refused or is unreachable — the caller then pays. */
  send(call: SponsoredCall): Promise<Hex | null>;
  /** The relayer's last refusal in its own words, so a fallback can say why the key is paying. */
  lastRefusal(): string | null;
}

export interface SponsorTransportConfig {
  endpoint: string;
  forwarder: Address;
  /** The session's own signer — the key, for taps. Reads go through the shared runtime. */
  walletClient: WalletClient;
  deviceId: string;
  nowSec: () => number;
  fetchImpl?: typeof fetch;
}

/** The browser side of the rail: sign the request as the session's key, post it, take the hash — or take the refusal and step aside. */
export function createSponsorTransport(config: SponsorTransportConfig): SponsorTransport {
  const fetchImpl = config.fetchImpl ?? fetch;
  let refusal: string | null = null;
  return {
    covers: (functionName) => isSponsorable(functionName),
    lastRefusal: () => refusal,
    async send(call) {
      if (!isSponsorable(call.functionName)) return null;
      try {
        const publicClient = getClient().getViemClient() as PublicClient;
        const request = await signForwardRequest({ ...config, publicClient, to: call.to, data: call.data, gas: call.gas, nowSec: config.nowSec() });
        const response = await fetchImpl(config.endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", "x-masayume-device": config.deviceId },
          body: JSON.stringify({ request }),
        });
        const body = (await response.json().catch(() => ({}))) as { hash?: Hex; error?: string };
        if (response.ok && body.hash) {
          refusal = null;
          return body.hash;
        }
        refusal = body.error ?? `sponsor answered ${response.status}`;
        return null;
      } catch (error) {
        refusal = error instanceof Error ? error.message : String(error);
        return null;
      }
    },
  };
}

export const SPONSOR_MAX_GAS = GAS_CEILING["vault-order" satisfies GasLane];

export interface ExecuteSponsoredInput {
  privateKey: Hex;
  rpcUrl: string;
  forwarder: Address;
  request: ForwardRequestWire;
  publicClient: PublicClient;
}

/** The relayer's own send (server-side only): verify with the forwarder first, then pay for `execute`. */
export async function executeSponsored({ privateKey, rpcUrl, forwarder, request, publicClient }: ExecuteSponsoredInput): Promise<Hex> {
  const account = privateKeyToAccount(privateKey);
  const tuple = toForwardTuple(request);
  const valid = await publicClient.readContract({ address: forwarder, abi: forwarderAbi, functionName: "verify", args: [tuple] });
  if (!valid) throw new Error("the forwarder rejects this request: bad signature, nonce or deadline");
  const relayer = createWalletClient({ account, chain: SOMNIA_SHANNON, transport: http(rpcUrl) });
  return relayer.writeContract({
    address: forwarder,
    abi: forwarderAbi,
    functionName: "execute",
    args: [tuple],
    // The relayer's own ceiling covers the forwarded gas plus the forwarder's overhead.
    gas: BigInt(request.gas) + 100_000n,
  });
}

export function sponsorAddressOf(privateKey: Hex): Address {
  return privateKeyToAccount(privateKey).address as Address;
}
