import { addressSchema } from "@masayume/core/types";
import { hasBet, isDbConfigured, recordBettor } from "@masayume/db";
import { ensureMarkets, getClient, parseMarketsEnv } from "@masayume/markets";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ROOM_ERRORS } from "@/features/room/copy";

/**
 * The bettors registry's two doors.
 *
 * `GET ?marketId&address` answers "has this wallet ever bet on this Window" — the affordance the sheet needs
 * before it asks for a signature. `POST` records a seat, and only after this server has read the fill's own
 * receipt: it must have succeeded, and the wallet must be its sender or appear as an indexed party in one of
 * its logs (the venue's fill, the vault's `Executed`, the reserve's open and the desk's all index the owner).
 * A client cannot register itself with a hash that is not its own fill; the worst a spoofed hash can do is
 * register the wallet that really did bet.
 */
export const runtime = "nodejs";

const bodySchema = z.object({
  marketId: z.string().min(3).max(66),
  address: addressSchema,
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  route: z.enum(["wallet", "vault", "leverage", "private"]),
});

export async function GET(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ configured: false, hasBet: null });
  const url = new URL(req.url);
  const marketId = url.searchParams.get("marketId");
  const address = url.searchParams.get("address");
  if (!marketId || !address) return NextResponse.json({ error: ROOM_ERRORS.badRequest }, { status: 400 });
  const env = parseMarketsEnv();
  const answer = await hasBet(env.chainId, marketId, address);
  return NextResponse.json({ configured: true, hasBet: answer });
}

export async function POST(req: Request) {
  if (!isDbConfigured()) return NextResponse.json({ error: ROOM_ERRORS.unavailable }, { status: 503 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: ROOM_ERRORS.badRequest }, { status: 400 });
  const { marketId, address, txHash, route } = parsed.data;

  const env = parseMarketsEnv();
  ensureMarkets(env);
  const viem = getClient().getViemClient();
  let receipt;
  try {
    receipt = await viem.getTransactionReceipt({ hash: txHash as `0x${string}` });
  } catch {
    return NextResponse.json({ error: ROOM_ERRORS.gateUnreadable }, { status: 503 });
  }
  if (receipt.status !== "success") return NextResponse.json({ error: ROOM_ERRORS.badRequest }, { status: 400 });

  const who = address.toLowerCase();
  const asTopic = `0x${"0".repeat(24)}${who.slice(2)}`;
  const party = receipt.from.toLowerCase() === who || receipt.logs.some((log) => log.topics.some((topic) => topic.toLowerCase() === asTopic));
  if (!party) return NextResponse.json({ error: ROOM_ERRORS.noPosition }, { status: 403 });

  await recordBettor({ chainId: env.chainId, marketId, wallet: who, txHash, route });
  return NextResponse.json({ recorded: true });
}
