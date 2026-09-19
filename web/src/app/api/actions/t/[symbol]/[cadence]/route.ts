import { isTickerSymbol, type TickerSymbol } from "@agari/core/market";
import {
  actionClusterOf, actionHeaders, selectActionWindow, windowAction, X_CADENCES,
  X_REFUSAL_DETAILS, windowActionTitle, type ActionCluster, type ActionGetResponse, type XCadence,
} from "@agari/core/x";
import { ensureMarkets, marketsProvider } from "@agari/markets";
import { webEnv } from "@/lib/env";

/**
 * `GET /api/actions/t/<symbol>/<cadence>` — a Blink that outlives its Window (S11).
 *
 * A per-Window link is correct but perishable: a 5-minute Window shared on X is closed before most people read the
 * post. This one names an asset and a cadence and resolves to whatever is tradeable right now, which is what a
 * shareable link has to do. The POST still targets the resolved Window's own path, so the transaction is built
 * against a concrete Window and cannot drift between the card and the signature.
 *
 * Lane follows D-103: `laneListable` puts a stock on Regular and a pre-IPO name on the 24/7 token lane, so a symbol
 * resolves to one lane with nothing to disambiguate.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cluster = (): ActionCluster => actionClusterOf(webEnv.markets.cluster);
const headers = () => actionHeaders(cluster());
const fail = (message: string, status: number) => Response.json({ message }, { status, headers: headers() });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: headers() });
}

function origin(request: Request): string {
  if (process.env.NEXT_PUBLIC_APP_ORIGIN) return webEnv.appOrigin.replace(/\/$/, "");
  return new URL(request.url).origin;
}

/** A symbol with no Window at all still renders: the card says which asset and why, never a 404 in a timeline. */
function absent(symbol: TickerSymbol, cadence: XCadence, icon: string, code: keyof typeof X_REFUSAL_DETAILS): ActionGetResponse {
  return {
    type: "action",
    icon,
    title: windowActionTitle({ asset: symbol, intervalSec: X_CADENCES[cadence] }),
    description: `Agari runs ${symbol} price Windows on a ${cadence} cadence. This one is not open for calls right now.`,
    label: "Closed",
    disabled: true,
    error: { message: X_REFUSAL_DETAILS[code] },
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ symbol: string; cadence: string }> }) {
  const { symbol: rawSymbol, cadence: rawCadence } = await params;
  const symbol = rawSymbol.toUpperCase();
  if (!isTickerSymbol(symbol)) return fail("Agari does not list that ticker.", 404);
  if (!Object.hasOwn(X_CADENCES, rawCadence)) return fail(`Choose one of ${Object.keys(X_CADENCES).join(", ")}.`, 400);
  const cadence = rawCadence as XCadence;

  ensureMarkets(webEnv.markets);
  const base = origin(request);
  const icon = `${base}/icons/icon-512.png`;

  const lanes = await marketsProvider.listLiveLanes(webEnv.markets.venueId!);
  if (!lanes.ok) return fail(X_REFUSAL_DETAILS["market-data-unavailable"], 503);

  const nowMs = marketsProvider.nowMs();
  const found = selectActionWindow(lanes.value.lanes.flatMap((lane) => lane.markets), { asset: symbol, intervalSec: X_CADENCES[cadence] }, nowMs);
  if (!found.ok && !found.market) return Response.json(absent(symbol, cadence, icon, found.code), { headers: headers() });

  const market = found.ok ? found.market : found.market!;
  const body = windowAction({ market, icon, basePath: `${base}/api/actions/w/${market.marketId}`, nowMs });
  return Response.json(body, { headers: headers() });
}
