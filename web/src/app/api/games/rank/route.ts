import { isEligible } from "@masayume/core/games";
import { countRankedFinalized, gamesStoreConfigured, ladderRankOf, listTopRatings, readRatings } from "@masayume/db";
import { NextResponse } from "next/server";
import { seasonConfig } from "@/features/games/season.server";

/**
 * `GET /api/games/rank?address=0x…` — the ladder (Flicky's `/leaderboard`), each row annotated with its
 * finished ranked duels and whether that clears the season's floor; and the asking wallet's own row with
 * its 1-based place even when it sits below the cut (Flicky's `/leaderboard/me`). Ranking itself is the
 * settler's rating alone; eligibility only gates prizes, and with no season configured it gates nothing.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = 50;

export interface RankRowWire {
  wallet: string;
  rating: number;
  verifiedMatches: number;
  stakedDuels: number;
  eligible: boolean;
}

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address");
  if (!gamesStoreConfigured()) return NextResponse.json({ configured: false, rows: [], me: null });
  const season = seasonConfig();
  const floor = season?.minStakedDuels ?? 0;

  const rows = await listTopRatings(LIMIT);
  const asked = address && /^0x[0-9a-fA-F]{40}$/.test(address) ? address.toLowerCase() : null;
  const wallets = asked ? [...rows.map((r) => r.wallet), asked] : rows.map((r) => r.wallet);
  const staked = await countRankedFinalized(wallets);
  const annotate = (row: { wallet: string; rating: number; verifiedMatches: number }): RankRowWire => {
    const stakedDuels = staked.get(row.wallet) ?? 0;
    return { ...row, stakedDuels, eligible: isEligible(stakedDuels, floor) };
  };

  let me: (RankRowWire & { rank: number | null }) | null = null;
  if (asked) {
    const record = (await readRatings([asked])).get(asked) ?? null;
    if (record) me = { ...annotate(record), rank: await ladderRankOf(asked) };
  }
  return NextResponse.json({ configured: true, rows: rows.map(annotate), me });
}
