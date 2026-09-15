import { STATUS, type StatusPayload, type StatusPipeline } from "@/features/status";

/**
 * Canned `/api/status` payloads for `/dev/status`: the three states the S5 gate names (proof-analytics.md §4 row 5c).
 * Figures are shaped on live readings (the 2026-09-14 session, ops `/health` at 06:10Z 09-15); none is a live read.
 */
type Tone = "good" | "warn" | "bad" | "expected" | "optional";

function row(id: string, label: string, tone: Tone, detail: string, lagSec: number | null = null, latencyMs: number | null = null): StatusPipeline {
  const ok = tone !== "bad" && tone !== "optional";
  return {
    id,
    label,
    ok,
    lagSec: tone === "expected" ? null : lagSec,
    latencyMs,
    detail,
    optional: tone === "optional",
    configured: tone !== "optional",
    expected: tone === "expected",
    grade: tone === "good" || tone === "warn" ? tone : null,
  };
}

const P = STATUS.pipelines;
const SLOT = 498_628_973;

function heartbeats(settler: StatusPipeline | null, sessionOpen: boolean): StatusPipeline[] {
  return [
    row("ops:roller", P.ops("window roller"), "good", sessionOpen ? "27 series (27 open)" : "27 series (27 closed)", 4),
    row("ops:relay", P.ops("price relay"), "good", sessionOpen ? "27 live Markets · due 0 · pending 27" : "0 live Markets · due 0 · pending 0", 2),
    settler ?? row("ops:settler", P.ops("settler"), "good", "0 Windows tracked over 28 Series; 0 due; nothing sent yet", 3),
    row("ops:seed-maker", P.ops("seed maker"), sessionOpen ? "good" : "expected", sessionOpen ? "quoting 6 series" : "no quotes resting · session closed", 9),
    row("ops:indexer", P.ops("indexer"), "good", "connected · walk 0 sigs (+0 new, 0 finalized) · 3951 txs 3859 events 4 fills", 13),
    row("ops:price-archive", P.ops("price archive"), "good", "archived 0 RedStone + 0 Pyth rows · 79 boundaries in view · missing RedStone 0, Pyth 0", 16),
  ];
}

function common(sessionOpen: boolean) {
  const session: Tone = sessionOpen ? "good" : "expected";
  const last = (text: string) => (sessionOpen ? text : STATUS.detail.lastSession("2026-09-14", text));
  return {
    rpc: row("rpc", P.rpc, "good", STATUS.detail.rpc(SLOT.toLocaleString("en-US"), "−1.5"), 2, 498),
    slotLag: row("slot-lag", P.slotLag, session, sessionOpen ? STATUS.detail.slotLag(9, "13:52:08 UTC") : STATUS.detail.slotLag(16_629, "2026-09-15 05:26:09 UTC"), null, 7),
    indexer: row("indexer", P.indexer, session, STATUS.detail.indexer("connected", 3_951, 4, 498_612_148), 2),
    pyth: row("relay:pyth", P.relay.pyth, session, last("9 lanes · recorded through 09:50 ET · slowest record 19s"), 19),
    redstone: row("relay:redstone", P.relay.redstone, sessionOpen ? "warn" : "expected", last("18 lanes · recorded through 09:50 ET · slowest record 49s"), 49),
    mix5: row("mix:5m", P.mix("5m"), session, last("Pyth 3 · RedStone 6")),
    mix15: row("mix:15m", P.mix("15m"), session, last("Pyth 3 · RedStone 6")),
    mix60: row("mix:60m", P.mix("60m"), session, last("Pyth 3 · RedStone 6")),
    trial: row("pyth-trial", P.pythTrial, "good", STATUS.detail.trialLeft(5, true, "2026-09-25 16:00")),
    archive: row("redstone", P.redstone, sessionOpen ? "warn" : "expected", last(STATUS.detail.archive(7, 13, 3, 0)), null, 24),
    switchboard: row("switchboard", P.switchboard, "optional", STATUS.detail.switchboard),
    crossCheck: row("cross-check", P.crossCheck, session, last(STATUS.detail.crossCheck("TSLA", 62, "2.46"))),
    lanes: row("paused", P.paused, session, STATUS.detail.lanes(27, sessionOpen ? "27 open" : "27 closed: no session"), null, 7),
    faucet: row("faucet", P.faucet, "good", STATUS.detail.faucet("4.97", "0.98", "1,990,000"), null, 830),
    sponsor: row("sponsor", P.sponsor, "optional", STATUS.detail.sponsor),
    store: row("store", P.store, "good", STATUS.detail.storeOk, null, 13),
    sensei: { ...row("sensei", P.sensei, "good", STATUS.detail.senseiOk("openai", "gpt-5.4", "direct")), optional: true, grade: null },
  };
}

function prices(sessionOpen: boolean): StatusPipeline[] {
  const tone: Tone = sessionOpen ? "good" : "expected";
  return [
    row("price:TSLA", P.price("TSLA"), tone, STATUS.detail.price("$358.98", "13:52:12 UTC"), 1, 12),
    row("price:NVDA", P.price("NVDA"), tone, STATUS.detail.price("$210.99", "13:52:00 UTC"), 12, 12),
    row("price:AAPL", P.price("AAPL"), tone, STATUS.detail.price("$333.10", "13:52:00 UTC"), 12, 12),
    row("price:MSFT", P.price("MSFT"), tone, STATUS.detail.price("$506.21", "13:52:00 UTC"), 12, 12),
  ].map((pipeline) => ({ ...pipeline, grade: null }));
}

function payload(sessionOpen: boolean, settler: StatusPipeline | null, overall: StatusPayload["overall"]): StatusPayload {
  const c = common(sessionOpen);
  const pipelines = [
    c.rpc, c.slotLag, c.indexer, c.pyth, c.redstone, c.mix5, c.mix15, c.mix60, c.trial, c.archive, c.switchboard, c.crossCheck,
    c.lanes, c.faucet, c.sponsor, c.store, ...heartbeats(settler, sessionOpen), ...prices(sessionOpen), c.sensei,
  ];
  const maxLag = sessionOpen ? { maxLagSec: 49, maxLagPipeline: P.relay.redstone } : { maxLagSec: 2, maxLagPipeline: P.rpc };
  return { checkedAtMs: Date.parse("2026-09-15T13:52:14Z"), overall, ...maxLag, slot: SLOT, session: { open: sessionOpen, label: sessionOpen ? "Closes 16:00 ET" : "Opens 09:30 ET" }, pipelines };
}

const stoppedSettler = row("ops:settler", P.ops("settler"), "bad", STATUS.detail.noBeat("settler"));

export const STATUS_FIXTURES = [
  { key: "off-hours", title: "Off-hours · closed (expected)", payload: payload(false, null, "healthy") },
  { key: "session", title: "In session · healthy", payload: payload(true, null, "healthy") },
  { key: "stopped", title: "In session · settler stopped", payload: payload(true, stoppedSettler, "degraded") },
] as const;
