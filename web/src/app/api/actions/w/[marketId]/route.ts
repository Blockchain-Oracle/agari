import { marketIdSchema } from "@agari/core/types";
import { addressSchema } from "@agari/core/types";
import { parseStakeBase } from "@agari/core/x";
import { actionClusterOf, actionHeaders, windowAction, X_REFUSAL_DETAILS, type ActionCluster, type ActionPostResponse } from "@agari/core/x";
import { ensureMarkets, marketsProvider } from "@agari/markets";
import { buildWindowActionTransaction } from "@agari/markets/x";
import { webEnv } from "@/lib/env";
import { regionRestricted } from "@/lib/region.server";
import { publicOrigin } from "@/lib/client-ip.server";

/**
 * `GET|POST /api/actions/w/<marketId>` — one Window as a Solana Action (S11, `00-plan.md` §S11).
 *
 * A blink client `GET`s the card, then `POST`s `{ account }` and signs the transaction it gets back. The wire shapes
 * live in `@agari/core/x` and the transaction is built in `@agari/markets/x`, so this file stays what every other
 * funded route is: policy plus serialization, with no chain import of its own (plan §6).
 *
 * The POST is a funded call, so it answers the geofence before it reads a book (D-095). The GET is a read and does
 * not: a held region may look at a Window, it just may not take one.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cluster = (): ActionCluster => actionClusterOf(webEnv.markets.cluster);

/** The host actually serving this Action, so a preview deployment and the real domain both render their own icon. */
function origin(request: Request): string {
  if (process.env.NEXT_PUBLIC_APP_ORIGIN) return webEnv.appOrigin.replace(/\/$/, "");
  return publicOrigin(request);
}

const headers = () => actionHeaders(cluster());
const fail = (message: string, status: number) => Response.json({ message }, { status, headers: headers() });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: headers() });
}

export async function GET(request: Request, { params }: { params: Promise<{ marketId: string }> }) {
  const marketId = marketIdSchema.safeParse((await params).marketId);
  if (!marketId.success) return fail("That is not a Window address.", 400);
  ensureMarkets(webEnv.markets);

  const reading = await marketsProvider.getMarket(marketId.data);
  if (!reading.ok) return fail(X_REFUSAL_DETAILS["market-data-unavailable"], 503);
  if (!reading.value) return fail(X_REFUSAL_DETAILS["no-window"], 404);

  const base = origin(request);
  const body = windowAction({
    market: reading.value,
    icon: `${base}/icons/icon-512.png`,
    basePath: `${base}/api/actions/w/${marketId.data}`,
    nowMs: marketsProvider.nowMs(),
  });
  return Response.json(body, { headers: headers() });
}

export async function POST(request: Request, { params }: { params: Promise<{ marketId: string }> }) {
  if (regionRestricted(request)) return fail("Funded actions are unavailable in your region.", 451);

  const marketId = marketIdSchema.safeParse((await params).marketId);
  if (!marketId.success) return fail("That is not a Window address.", 400);

  const url = new URL(request.url);
  const side = url.searchParams.get("side");
  if (side !== "up" && side !== "down") return fail("Choose Up or Down.", 400);

  ensureMarkets(webEnv.markets);
  const reading = await marketsProvider.getMarket(marketId.data);
  if (!reading.ok) return fail(X_REFUSAL_DETAILS["market-data-unavailable"], 503);
  if (!reading.value) return fail(X_REFUSAL_DETAILS["no-window"], 404);

  const stake = parseStakeBase(url.searchParams.get("stake"), reading.value.decimals);
  if (stake === null) return fail("Enter an amount of tUSDC.", 400);

  const body: unknown = await request.json().catch(() => null);
  const account = addressSchema.safeParse((body as { account?: unknown } | null)?.account);
  if (!account.success) return fail("Connect a wallet to make this call.", 400);

  const built = await buildWindowActionTransaction({ marketId: marketId.data, wallet: account.data, side, stakeBase: stake });
  if (!built.ok) return fail(built.message, 400);
  const response: ActionPostResponse = { transaction: built.transaction, message: built.message };
  return Response.json(response, { headers: headers() });
}
