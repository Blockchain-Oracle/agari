import { formatCadence } from "../copy";
import { phase, type MarketPhase } from "../lifecycle";
import { minStakeBase } from "../sizing";
import type { EventMarket } from "../types";
import { formatBaseUnits } from "../units";
import { X_REFUSAL_DETAILS } from "./refusal";
import type { XRefusalCode } from "./receipt";

/**
 * The Solana Actions wire, and Agari's half of it (S11, `00-plan.md` §S11, `R:solana-actions`).
 *
 * A Blink is a link a wallet unfurls into a signable transaction: the client `GET`s this metadata, renders the
 * buttons, then `POST`s `{ account }` and signs whatever transaction comes back. These are the spec's shapes, kept
 * here in `packages/core` for one reason — `@solana/actions` is an `@solana/*` module, and only `packages/markets`
 * may import those (plan §6, `kit-import-boundary`). The route stays a pure wire; the transaction is built in
 * `@agari/markets/x`.
 *
 * Refusal copy is never invented here: a Blink that cannot trade says exactly what an X reply would say, out of
 * `X_REFUSAL_DETAILS`. One vocabulary, three surfaces.
 */

export type ActionType = "action" | "completed";

/** The spec's linked-action kinds; Agari only ever returns a `transaction`. */
export type LinkedActionType = "transaction" | "message" | "post" | "external-link" | "inline-link";

export type ActionParameterType =
  | "text" | "email" | "url" | "number" | "date"
  | "datetime-local" | "checkbox" | "radio" | "textarea" | "select";

export interface ActionError {
  message: string;
}

export interface ActionParameter {
  name: string;
  type?: ActionParameterType;
  label?: string;
  required?: boolean;
  min?: string | number;
  max?: string | number;
  pattern?: string;
  patternDescription?: string;
}

export interface LinkedAction {
  type: LinkedActionType;
  href: string;
  label: string;
  parameters?: readonly ActionParameter[];
}

export interface ActionGetResponse {
  type: ActionType;
  icon: string;
  title: string;
  description: string;
  label: string;
  disabled?: boolean;
  links?: { actions: readonly LinkedAction[] };
  error?: ActionError;
}

/** The only field a blink client sends: the viewer's wallet, base58. */
export interface ActionPostRequest {
  account: string;
}

/** `transaction` is a base64 serialized v0 transaction the viewer's wallet signs and sends. */
export interface ActionPostResponse {
  transaction: string;
  message?: string;
}

export interface ActionRuleObject {
  pathPattern: string;
  apiPath: string;
}

export interface ActionsJson {
  rules: readonly ActionRuleObject[];
}

/** The spec version blink clients negotiate against. */
export const ACTION_VERSION = "2.4";

/** CAIP-2 chain ids. A client reads these to pick the cluster before it lets anyone sign. */
export const ACTION_CHAIN_IDS = {
  mainnet: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
  devnet: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  testnet: "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z",
} as const;

export type ActionCluster = keyof typeof ACTION_CHAIN_IDS;

/**
 * Every Action response carries these. `Access-Control-Allow-Origin: *` is required by the spec — an Action is
 * read by clients on domains we do not control, which is the whole point of a Blink.
 */
export function actionHeaders(cluster: ActionCluster): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Content-Encoding, Accept-Encoding",
    "Access-Control-Expose-Headers": "X-Action-Version, X-Blockchain-Ids",
    "X-Action-Version": ACTION_VERSION,
    "X-Blockchain-Ids": ACTION_CHAIN_IDS[cluster],
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
}

/** A phase that cannot take an order, mapped to the same public code an X reply would use. */
export function actionRefusalOf(p: MarketPhase): XRefusalCode | null {
  if (p === "trading") return null;
  if (p === "pendingOpeningPrint") return "opening-price-pending";
  if (p === "upcoming") return "window-not-started";
  if (p === "noEntryBuffer" || p === "locked") return "window-entry-closed";
  return "no-window";
}

const UTC = (sec: number) => `${new Date(sec * 1000).toISOString().slice(11, 16)} UTC`;

export function windowActionTitle(market: Pick<EventMarket, "asset" | "intervalSec">): string {
  return `${market.asset} · ${formatCadence(market.intervalSec)} Window`;
}

/**
 * What the card says before anyone signs: the exact question, when it is answered, and where the answer comes from.
 * A Blink is read by people who have never seen the app, so it names the settlement source rather than assuming it.
 */
export function windowActionDescription(market: Pick<EventMarket, "asset" | "expirySec" | "decimals">): string {
  const floor = formatBaseUnits(minStakeBase(market.decimals), market.decimals);
  return `Up or Down on ${market.asset} at the ${UTC(market.expirySec)} close, settled from a signed price print. `
    + `Your stake is the most you can lose. Minimum ${floor} tUSDC.`;
}

/** Two buttons, each with its own amount field: the side is in the path, the stake is the viewer's. */
export function windowActionLinks(market: Pick<EventMarket, "marketId" | "decimals">, basePath: string): readonly LinkedAction[] {
  const floor = formatBaseUnits(minStakeBase(market.decimals), market.decimals);
  const stake = (label: string): ActionParameter => ({ name: "stake", type: "number", label, required: true, min: floor });
  return [
    { type: "transaction", href: `${basePath}?side=up&stake={stake}`, label: "Up", parameters: [stake("tUSDC on Up")] },
    { type: "transaction", href: `${basePath}?side=down&stake={stake}`, label: "Down", parameters: [stake("tUSDC on Down")] },
  ];
}

export interface WindowActionInput {
  market: EventMarket;
  /** Absolute, so a client on another domain can load it: the spec requires an SVG, PNG or WebP URL. */
  icon: string;
  /** The Action's own path, e.g. `/api/actions/w/<marketId>`. */
  basePath: string;
  nowMs: number;
}

/**
 * One Window as a Blink. A Window that cannot be entered still renders — `disabled`, with the reason — because a
 * shared link outlives its Window, and a card that explains itself beats a card that 404s.
 */
export function windowAction({ market, icon, basePath, nowMs }: WindowActionInput): ActionGetResponse {
  const refusal = actionRefusalOf(phase(market, nowMs));
  const base = {
    type: "action" as const,
    icon,
    title: windowActionTitle(market),
    description: windowActionDescription(market),
  };
  if (refusal) return { ...base, label: "Closed", disabled: true, error: { message: X_REFUSAL_DETAILS[refusal] } };
  return { ...base, label: "Make a call", links: { actions: windowActionLinks(market, basePath) } };
}

/**
 * The venue's cluster name as a CAIP-2 selector. Takes a plain string: this maps configuration, and a config value
 * the venue has never heard of must still produce a chain id rather than a type error at the edge.
 */
export function actionClusterOf(cluster: string): ActionCluster {
  if (cluster === "mainnet" || cluster === "mainnet-beta") return "mainnet";
  if (cluster === "testnet") return "testnet";
  return "devnet";
}
