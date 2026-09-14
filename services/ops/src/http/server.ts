/** The ops HTTP server (venue-ops.md §2.3, §6.5): `/health`, `/session`, `/prices/latest`, `/prices/stream`. GET only, CORS `*`. */
import { createServer } from "node:http";
import type { SessionService } from "../calendar/session-service";
import type { SpotFeed } from "../prices/spot";
import type { OpsEnv } from "../runtime/env";
import { healthBody, jsonText } from "./health";
import { sessionBody } from "./session";
import { latestBody, streamSpot } from "./spot-sse";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS" };

export interface OpsHttp {
  port: number;
  close(): Promise<void>;
}

export function startOpsHttp(input: { port: number; spot: SpotFeed | null; sessions?: SessionService; env?: OpsEnv; log?: (why: string) => void }): Promise<OpsHttp> {
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://ops").pathname;
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { ...CORS, "content-type": "application/json" });
      res.end(jsonText(body));
    };
    if (req.method === "OPTIONS") return void res.writeHead(204, CORS).end();
    if (req.method !== "GET") return json(405, { error: "GET only" });
    if (path === "/health") {
      const body = healthBody(input.env);
      return json(body.ok ? 200 : 503, body);
    }
    if (path === "/session") return json(200, sessionBody(input.sessions ?? null));
    if (path === "/prices/latest") return input.spot ? json(200, latestBody(input.spot)) : json(503, { error: "no spot feed in this process" });
    if (path === "/prices/stream") return input.spot ? streamSpot(req, res, input.spot, CORS) : json(503, { error: "no spot feed in this process" });
    return json(404, { error: "not found" });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(input.port, () => {
      input.log?.(`http on :${input.port} (/health, /session, /prices/latest, /prices/stream)`);
      resolve({ port: input.port, close: () => new Promise((done) => server.close(() => done())) });
    });
  });
}
