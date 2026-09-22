/** `/status` — ported from `reference/yosuku/app/status/page.tsx`; the mechanics named are ours. */
const n = (value: number | bigint) => value.toLocaleString("en-US");
const plural = (count: number, one: string, many = `${one}s`) => `${n(count)} ${count === 1 ? one : many}`;

export const STATUS = {
  title: "Status",
  section: { index: "01", title: "System Status" },
  loading: "Loading status...",
  unreachable: "Unable to reach the status probe.",
  healthy: "All Systems Operational",
  degraded: "Degraded Performance",
  maxLag: (sec: number, pipeline: string) => `Max lag: ${sec}s (${pipeline})`,
  noLag: "No lag measured",
  checkpoint: "Slot",
  noSlot: "—",
  tableTitle: (count: number) => `Pipeline Status (${count})`,
  lag: (sec: number) => `${sec}s`,
  latency: (ms: number) => `${ms}ms`,
  optional: "optional",
  /** Ours (proof-analytics.md §2.5): a session-bound row outside regular hours. */
  expected: (sessionLabel: string | null) => (sessionLabel ? `closed (expected) · ${sessionLabel}` : "closed (expected)"),
  lastChecked: (clock: string) => `Last checked: ${clock} · Auto-refreshes every 30s`,

  pipelines: {
    rpc: "Solana RPC · chain head",
    slotLag: "Indexer · slots behind head",
    indexer: "Indexer · live lag",
    relay: { pyth: "Price relay · Pyth freshness", redstone: "Price relay · RedStone freshness" },
    mix: (cadence: string) => `Print sources · ${cadence} Windows`,
    pythTrial: "Pyth trial · sessions left",
    pythIndex: "Pyth valuation index · entitlement",
    redstone: "RedStone gateway · latency, signers",
    switchboard: "Switchboard · quote success",
    crossCheck: "Cross-check · agreement",
    paused: "Lanes · paused",
    faucet: "Faucet budget · SOL and tUSDC",
    sponsor: "Sponsor budget",
    ops: (actor: string) => `Ops · ${actor}`,
    price: (asset: string) => `Price feed · ${asset}`,
    store: "Database · index, archive and social store",
    sensei: "Sensei · model",
  },

  /** Ops actor ids (`/health`) and the name each row shows. */
  actors: [
    { id: "roller", actor: "window-roller", name: "window roller" },
    { id: "relay", actor: "price-relay", name: "price relay" },
    { id: "settler", actor: "settler", name: "settler" },
    { id: "seed-maker", actor: "seed-maker", name: "seed maker" },
    { id: "indexer", actor: "indexer", name: "indexer" },
    { id: "price-archive", actor: "price-archive", name: "price archive" },
  ],

  sources: { 1: "Pyth", 2: "RedStone", 3: "Switchboard", 4: "Attested" } as Readonly<Record<number, string>>,

  detail: {
    rpc: (slot: string, offsetSec: string) => `slot ${slot} · head ${offsetSec}s vs this clock`,
    noPrint: "the feed has no print for this asset",
    price: (price: string, printedAt: string) => `${price} · printed ${printedAt}`,
    storeOff: "not connected on this deployment — set DATABASE_URL",
    storeOk: "answered",
    storeDown: (why: string) => `configured, not answering — ${why}`,
    senseiOff: (hint: string) => `no credential — set ${hint}`,
    senseiOk: (provider: string, model: string, via: string) => `${provider}/${model} via ${via}`,
    timedOut: (sec: number) => `timed out after ${sec}s`,
    stale: (asOf: string) => `last read failed — holding a reading from ${asOf}`,

    noDb: "no database on this deployment — set DATABASE_URL",
    noSessionCalendar: "ops has no session calendar to scope prints by",
    lastSession: (date: string, text: string) => `last session ${date}: ${text}`,
    slotLag: (slots: number, lastAt: string) => `${plural(slots, "slot")} behind head · last indexed tx ${lastAt}`,
    slotEmpty: "the index holds no transaction yet",
    noHead: "no chain head to compare against",
    indexer: (subscription: string, txs: number, fills: number, cursor: number | null) =>
      `subscription ${subscription} · ${plural(txs, "tx", "txs")} · ${plural(fills, "fill")} · cursor ${cursor === null ? "none" : n(cursor)}`,
    gaps: (count: number) => plural(count, "open gap"),
    failures: (count: number) => plural(count, "failed pass", "failed passes"),
    noBeat: (actor: string) => `no ${actor} heartbeat on ops /health`,
    beat: (why: string, failures: number) => (failures > 0 ? `${plural(failures, "failed pass", "failed passes")} · ${why}` : why),

    relayLanes: (lanes: number) => plural(lanes, "lane"),
    relayThrough: (clock: string) => `recorded through ${clock} ET`,
    relaySlowest: (sec: number) => `slowest record ${sec}s`,
    relayBehind: (lanes: readonly string[]) => `${lanes.length} behind: ${lanes.join(", ")}`,
    relayMissed: (count: number, since: string) => `relay missed ${plural(count, "slot")} since ${since}`,
    relayNone: "no print on this source yet",
    missingVoids: (count: number) => plural(count, "missing-print void"),
    mixNone: "no Windows yet",

    trialEnded: "ended: TSLA on RedStone, QQQ/VOO paused",
    trialLeft: (left: number, capped: boolean, lastClose: string) => `${n(left)}${capped ? "+" : ""} ${left === 1 && !capped ? "session" : "sessions"} left · last covered close ${lastClose} ET`,
    trialUnknown: "ops does not name the trial's last covered close",

    /** S20: "OPENAI, ANTHROPIC: not entitled (403 pyth-indices) · probed 18:31 UTC"; the valuation lanes list only once this reads entitled. */
    pythIndexNone: "ops does not report the valuation indices",
    pythIndexEntitled: (names: string) => `${names}: entitled`,
    pythIndexDenied: (names: string, reason: string | null) => `${names}: not entitled${reason ? ` (${reason})` : ""}`,
    pythIndexProbed: (clock: string) => `probed ${clock}`,
    pythIndexUnprobed: "not probed yet",

    archive: (feeds: number, fetchSec: number, minSigners: number, late: number) =>
      `${plural(feeds, "feed")} · slowest fetch ${fetchSec}s · min ${plural(minSigners, "signer")} · ${n(late)} late`,
    archiveNone: "no RedStone boundary archived yet",
    spot: (why: string) => `spot: ${why}`,

    switchboard: "arrives with the token lane (S6)",
    sponsorOff: "no sponsor key on this deployment · seat keys pay their own fee",
    sponsorUnread: "the sponsor's balance could not be read · seats fund themselves until it can",
    /** "0.29 SOL · a deck needs 0.02 SOL · ready" — the sponsor's balance against the widest deck's envelope. */
    sponsor: (balance: string, envelope: string, ready: boolean) => `${balance} SOL · a deck needs ${envelope} SOL · ${ready ? "ready" : "below two decks, seats fund themselves"}`,

    crossCheck: (symbols: string, pairs: number, maxBps: string) => `${symbols} · ${plural(pairs, "pair")} · max ${maxBps} bps`,
    singleSource: "single source · no cross-checked print",

    lanes: (total: number, groups: string) => `${plural(total, "lane")} · ${groups}`,
    noLanes: "the roller reports no lanes",

    faucetOff: "not set up on this deployment",
    faucet: (sol: string, solLeft: string, tusdcLeft: string | null) =>
      `${sol} SOL · ${solLeft} SOL left today · ${tusdcLeft === null ? "tUSDC unavailable" : `${tusdcLeft} tUSDC left today`}`,
  },
} as const;
