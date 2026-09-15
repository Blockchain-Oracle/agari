import { addressSchema, isAddress, marketIdSchema, signatureSchema } from "@agari/core/types";
import { hasBet, hasBetOnSymbol, hasIndexedBet, hasIndexedBetOnSymbol, hasIndexedFill, isDbConfigured, recordBettor } from "@agari/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ROOM_ERRORS } from "@/features/room/copy";
import { clientIp, ROOM_LIMITS } from "@/features/room/limits.server";
import { parseRoomId } from "@/features/room/room-id";
import { webEnv } from "@/lib/env";

/**
 * The bettors registry's two doors.
 *
 * `GET ?marketId&address` answers "has this wallet ever bet here" from the registry and the index — the affordance
 * the sheet needs before it asks for a signature; `marketId` may be any room id, `$TSLA` included. It never reads
 * the chain; the join does that.
 *
 * `POST` records a seat, and only once the indexer holds a confirmed fill in that transaction, on that Window, with
 * that wallet as taker or maker. A client cannot register itself with a hash that is not its own fill: the worst a
 * borrowed hash can do is register the wallet that really did bet.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

/** The indexer lags ≈ 2 s; four looks 2.5 s apart cover it without holding a function open for long. */
const INDEX_LOOKS = 4;
const INDEX_LOOK_GAP_MS = 2_500;
const NO_STORE = { "Cache-Control": "no-store" };

const bodySchema = z.object({
  marketId: marketIdSchema,
  address: addressSchema,
  txHash: signatureSchema,
  route: z.enum(["wallet", "vault", "leverage", "private"]),
});

function refuse(error: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status, headers: NO_STORE });
}

export async function GET(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ configured: false, hasBet: null }, { headers: NO_STORE });
  const url = new URL(req.url);
  const room = parseRoomId(url.searchParams.get("marketId") ?? "");
  const address = url.searchParams.get("address");
  if (!room || !isAddress(address)) return refuse(ROOM_ERRORS.badRequest, 400);
  const { chainId } = webEnv.markets;
  try {
    const registry = room.kind === "window" ? await hasBet(chainId, room.marketId, address) : await hasBetOnSymbol(chainId, room.symbol, address);
    const answer = registry || (room.kind === "window" ? await hasIndexedBet(room.marketId, address) : await hasIndexedBetOnSymbol(room.symbol, address));
    return NextResponse.json({ configured: true, hasBet: answer }, { headers: NO_STORE });
  } catch {
    // Unknown, not "no": the sheet then holds `joinable` and lets the join decide.
    return NextResponse.json({ configured: true, hasBet: null }, { headers: NO_STORE });
  }
}

/** Looks for the fill in the index, allowing for its lag. `null` when the index could not be read. */
async function findFill(txHash: string, marketId: string, wallet: string): Promise<boolean | null> {
  for (let look = 0; look < INDEX_LOOKS; look += 1) {
    if (look > 0) await new Promise((resolve) => setTimeout(resolve, INDEX_LOOK_GAP_MS));
    const found = await hasIndexedFill(txHash, marketId, wallet).catch(() => null);
    if (found !== false) return found;
  }
  return false;
}

export async function POST(req: Request) {
  if (!isDbConfigured()) return refuse(ROOM_ERRORS.unavailable, 503);
  if (!ROOM_LIMITS.bet.take(clientIp(req), Date.now())) return refuse(ROOM_ERRORS.rateLimited, 429);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return refuse(ROOM_ERRORS.badRequest, 400);
  const { marketId, address, txHash, route } = parsed.data;

  // The vault, leverage and private routes leave no fill under the bettor's own wallet; each earns its own index
  // proof when its program lands (S7/S10). Until then the gate's other steps are their only door.
  if (route !== "wallet") return refuse(ROOM_ERRORS.notDeployed, 503, { reason: "not-deployed" });

  const found = await findFill(txHash, marketId, address);
  if (found === null) return refuse(ROOM_ERRORS.gateUnreadable, 503);
  if (!found) {
    console.info(`[room] bet ${marketId} ${address}: no indexed fill in ${txHash}; nothing recorded`);
    return NextResponse.json({ recorded: false }, { status: 202, headers: NO_STORE });
  }

  const recorded = await recordBettor({ chainId: webEnv.markets.chainId, marketId, wallet: address, txHash, route });
  console.info(`[room] bet ${marketId} ${address}: indexed fill ${txHash}; registry ${recorded ? "written" : "unavailable"}`);
  return recorded ? NextResponse.json({ recorded: true }, { headers: NO_STORE }) : refuse(ROOM_ERRORS.unavailable, 503);
}
