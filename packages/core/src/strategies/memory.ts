import { SIGNED_MESSAGE_BRAND } from "../auth/signed-message";

/**
 * The Memory Market's two signed texts (ed25519 over the exact UTF-8 bytes, D-012). Both routes re-derive the text
 * from the request and verify it, so a signature for one strategy, one wallet or one moment opens nothing else.
 */
export const SEALED_TITLE_MAX = 80;
export const SEALED_BODY_MAX = 8_000;

/** The creator seals what their agent has learned. The body is part of the signed text, so it cannot be swapped in transit. */
export function sealMemoryMessage(strategyId: string, creator: string, issuedAtMs: number, title: string, body: string): string {
  return [`${SIGNED_MESSAGE_BRAND} seal memory`, `Strategy: ${strategyId}`, `Creator: ${creator}`, `Issued: ${issuedAtMs}`, `Title: ${title}`, "", body].join("\n");
}

/** A reader asks for one strategy's sealed memory. What opens it is their on-chain subscription, checked by the route. */
export function readMemoryMessage(strategyId: string, reader: string, issuedAtMs: number): string {
  return [`${SIGNED_MESSAGE_BRAND} read memory`, `Strategy: ${strategyId}`, `Reader: ${reader}`, `Issued: ${issuedAtMs}`].join("\n");
}
