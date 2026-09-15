// Dev runner: the settler alone. `pnpm --filter @agari/ops exec tsx --env-file-if-exists=../../.env.local src/dev/settler.ts`
// Env: SOLANA_CLUSTER=localnet SURFPOOL_PORT=… for a Surfpool fork; DRY_RUN=0 to send; SETTLER_ALL_SERIES=1 includes drive-only Series.
import { createSessionService } from "../calendar/session-service";
import { createHaltBoard, createSessionEvents, readOpsEnv } from "../runtime";
import { startSettler } from "../actors/settler";

const env = readOpsEnv();
const log = (why: string) => console.log(JSON.stringify({ tsMs: Date.now(), actor: "settler", why }));
await startSettler({ env, log, sessions: createSessionService(), spot: null, halts: createHaltBoard(), events: createSessionEvents() });
