import { isDbConfigured, xReceiptsByWallet } from "@masayume/db";
import type { XReceipt } from "@masayume/core/x";
import { NextResponse, type NextRequest } from "next/server";
import { X_RECEIPTS_LIMIT, type XReceiptsFeed } from "@/features/x/protocol";

export const dynamic = "force-dynamic";

/** The mentions the relay executed for a wallet, newest first — public, as a receipt is. */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet") ?? "";
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) return NextResponse.json({ error: "wallet required" }, { status: 400 });
  if (!isDbConfigured()) return NextResponse.json({ configured: false, receipts: [] } satisfies XReceiptsFeed);
  const rows = await xReceiptsByWallet(wallet, X_RECEIPTS_LIMIT);
  if (rows === null) return NextResponse.json({ configured: false, receipts: [] } satisfies XReceiptsFeed);
  const receipts: XReceipt[] = rows.map((row) => ({ ...row }));
  return NextResponse.json({ configured: true, receipts } satisfies XReceiptsFeed);
}
