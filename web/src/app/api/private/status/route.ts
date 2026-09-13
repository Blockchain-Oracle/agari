import { deskHealth } from "@masayume/markets/private";
import { NextResponse } from "next/server";
import { getDesk } from "@/features/private/desk.server";

/** Whether the private route can run, and every reason it cannot — the control gates on `ready` and shows `reasons[0]`. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const desk = await getDesk();
    return NextResponse.json(await deskHealth(desk));
  } catch (error) {
    return NextResponse.json({ ready: false, reasons: [error instanceof Error ? error.message : String(error)], mode: "desk-signed-slot", desk: null, contract: null, chainId: 0, minStakeBase: null, maxStakeBase: null, paused: false });
  }
}
