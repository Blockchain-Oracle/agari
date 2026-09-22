import { actionClusterOf, actionHeaders, type ActionCluster, type ActionsJson } from "@agari/core/x";
import { webEnv } from "@/lib/env";

/**
 * `GET /actions.json` — the file that makes Agari's links blinkable (S11, `00-plan.md` §S11).
 *
 * A blink client that meets `useagari.xyz/markets/<id>` looks here to learn which of our URLs it may `GET` as an Action.
 * The spec requires it at the domain root with `Access-Control-Allow-Origin: *`, which is why it is a route handler
 * rather than a file in `public/`: the headers are part of the contract, not a deployment setting someone has to
 * remember. A shared market link and its Action stay one URL apart, so nothing has to be re-shared to become a Blink.
 */
export const runtime = "nodejs";
export const dynamic = "force-static";

const cluster = (): ActionCluster => actionClusterOf(webEnv.markets.cluster);

const BODY: ActionsJson = {
  rules: [
    // A Window's own page, shared from the app or by the X relay.
    { pathPattern: "/markets/*", apiPath: "/api/actions/w/*" },
    // The idiomatic `/actions/**` surface every blink client probes first.
    { pathPattern: "/actions/**", apiPath: "/api/actions/**" },
  ],
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: actionHeaders(cluster()) });
}

export function GET() {
  return Response.json(BODY, { headers: actionHeaders(cluster()) });
}
