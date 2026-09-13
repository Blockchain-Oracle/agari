#!/usr/bin/env node
// Probes which market-data and infra credentials work for Stocklana research.
// Run: node --env-file-if-exists=.env.local scripts/probe-keys.mjs
// Prints status and a short response sample per check. Never prints secrets.

const env = process.env;
const TIMEOUT_MS = 10_000;
const results = [];

const PYTH_AAPL = "49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688"; // Equity.US.AAPL/USD
const PYTH_BTC = "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"; // Crypto.BTC/USD
// The Pyth trial's equities (plan PD-1): TSLA, QQQ, VOO.
const PYTH_TRIAL = {
  TSLA: "16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1",
  QQQ: "9695e2b96ea7b3859da9ed25b7a46a920a776e2fdae19a7bcfdf2b219230452d",
  VOO: "236b30dd09a9c00dfeec156c7b1efd646c0f01825a1758e3e4a0679e3bdff179",
};
const REDSTONE = "https://oracle-gateway-2.a.redstone.finance/data-packages";
const REDSTONE_NAMES = ["TSLA", "NVDA", "AAPL", "MSFT", "META", "AMZN", "GOOGL"];
const TSLAX_MINT = "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB";
const NVDAX_MINT = "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh";

async function probe(provider, check, url, { headers = {}, needs = [], method = "GET", body, summarize } = {}) {
  const missing = needs.filter((name) => !env[name]);
  if (missing.length) {
    results.push({ provider, check, status: "SKIP", detail: `set ${missing.join(", ")}` });
    return null;
  }
  try {
    const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(TIMEOUT_MS) });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {}
    const detail =
      res.ok && summarize && json !== undefined ? summarize(json) : text.slice(0, 140).replace(/\s+/g, " ");
    results.push({ provider, check, status: res.ok ? "OK" : `HTTP ${res.status}`, detail });
    return res.ok ? json ?? text : null;
  } catch (err) {
    results.push({ provider, check, status: "ERROR", detail: String(err?.message ?? err).slice(0, 140) });
    return null;
  }
}

// Most recent 16:00 New York close on a weekday. Assumes EDT (UTC-4) and ignores holidays; probe use only.
function lastRegularCloseUtc(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 20, 0, 0));
  while (d > now || d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return Math.floor(d.getTime() / 1000);
}

const iso = (sec) => new Date(sec * 1000).toISOString();
const pythParsed = (j) =>
  (j.parsed ?? [])
    .map((f) => `${f.id.slice(0, 6)}…=${(Number(f.price.price) * 10 ** f.price.expo).toFixed(2)} @${iso(f.price.publish_time)}`)
    .join(" | ") || "no parsed prices";

const close = lastRegularCloseUtc();
const bearer = (name) => ({ Authorization: `Bearer ${env[name]}` });

// --- Pyth Core (Hermes) ---
await probe("Pyth Hermes", "feed metadata (no key)", `https://hermes.pyth.network/v2/price_feeds?query=AAPL&asset_type=equity`, {
  summarize: (j) => `${j.length} feeds; AAPL is_open=${j.find((f) => f.id === PYTH_AAPL)?.market_hours?.is_open}`,
});
await probe("Pyth Hermes", "latest AAPL+BTC", `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${PYTH_AAPL}&ids[]=${PYTH_BTC}&parsed=true`, {
  headers: bearer("PYTH_API_KEY"),
  needs: ["PYTH_API_KEY"],
  summarize: pythParsed,
});
await probe("Pyth Hermes", `AAPL first update >= last close ${iso(close)}`, `https://hermes.pyth.network/v2/updates/price/${close}?ids[]=${PYTH_AAPL}&parsed=true`, {
  headers: bearer("PYTH_API_KEY"),
  needs: ["PYTH_API_KEY"],
  summarize: pythParsed,
});
const trialIds = Object.values(PYTH_TRIAL).map((id) => `ids[]=${id}`).join("&");
await probe("Pyth Hermes", `trial TSLA/QQQ/VOO exact-T at last close ${iso(close)}`, `https://hermes.pyth.network/v2/updates/price/${close}?${trialIds}&parsed=true`, {
  headers: bearer("PYTH_API_KEY"),
  needs: ["PYTH_API_KEY"],
  summarize: (j) =>
    (j.parsed ?? [])
      .map((f) => {
        const sym = Object.keys(PYTH_TRIAL).find((s) => PYTH_TRIAL[s] === f.id);
        const exact = f.metadata?.prev_publish_time < close && close <= f.price.publish_time && f.price.publish_time <= close + 5;
        return `${sym} ${(Number(f.price.price) * 10 ** f.price.expo).toFixed(2)} exactT=${exact}`;
      })
      .join(" | "),
});

// --- RedStone (public signed packages, no key) ---
const rsSummary = (j, T) =>
  REDSTONE_NAMES.map((n) => {
    const pk = (j[n] ?? []).filter((p) => T === undefined || p.timestampMilliseconds === T);
    return `${n}:${new Set(pk.map((p) => p.signerAddress)).size}sig`;
  }).join(" ");
await probe("RedStone", "latest packages (no key)", `${REDSTONE}/latest/redstone-primary-prod`, {
  summarize: (j) => `${Object.keys(j).length} feeds; ${rsSummary(j)}; TSLA ts=${iso((j.TSLA?.[0]?.timestampMilliseconds ?? 0) / 1000)}`,
});
const rsT = Math.floor((Date.now() - 3_600_000) / 10_000) * 10_000;
await probe("RedStone", `historical exact T ${iso(rsT / 1000)} (no key)`, `${REDSTONE}/historical/redstone-primary-prod/${rsT}`, {
  summarize: (j) => `${rsSummary(j, rsT)}; TSLA signers ${[...new Set((j.TSLA ?? []).map((p) => p.signerAddress.slice(0, 8)))].join(",")}`,
});

const tslaxFeeds = await probe("Pyth Hermes", "xStock token feed lookup (no key)", `https://hermes.pyth.network/v2/price_feeds?query=TSLAX`, {
  summarize: (j) => j.map((f) => f.attributes?.symbol).join(", ") || "none",
});
const tslaxId = Array.isArray(tslaxFeeds) ? tslaxFeeds[0]?.id : undefined;
if (tslaxId) {
  await probe("Pyth Hermes", "latest TSLAx token (24/7)", `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${tslaxId}&parsed=true`, {
    headers: bearer("PYTH_API_KEY"),
    needs: ["PYTH_API_KEY"],
    summarize: pythParsed,
  });
}

// --- Pyth Pro ---
const proSymbols = await probe("Pyth Pro", "symbols (no key)", "https://pyth.dourolabs.app/v1/symbols", {
  summarize: (j) => `${j.length} symbols`,
});
const aaplPro = Array.isArray(proSymbols)
  ? proSymbols.find((s) => s.symbol === "Equity.US.AAPL/USD") ?? proSymbols.find((s) => /AAPL/.test(s.symbol ?? ""))
  : undefined;
if (aaplPro) {
  const channel = aaplPro.min_channel ?? "fixed_rate@200ms";
  await probe("Pyth Pro", `AAPL price at last close (${channel})`, `https://pyth.dourolabs.app/v1/${channel}/price?ids=${aaplPro.pyth_lazer_id}&timestamp=${close * 1_000_000}`, {
    headers: bearer("PYTH_API_KEY"),
    needs: ["PYTH_API_KEY"],
    summarize: (j) => JSON.stringify(j).slice(0, 140),
  });
}

// --- Jupiter ---
const jupPrices = (j) =>
  Object.entries(j)
    .map(([mint, p]) => `${mint.slice(0, 6)}… dex=${p.usdPrice?.toFixed(2)} ref=${p.stockData?.price ?? "-"}`)
    .join(" | ");
await probe("Jupiter", "Price v3 lite (no key)", `https://lite-api.jup.ag/price/v3?ids=${TSLAX_MINT},${NVDAX_MINT}`, { summarize: jupPrices });
await probe("Jupiter", "Price v3 keyed", `https://api.jup.ag/price/v3?ids=${TSLAX_MINT},${NVDAX_MINT}`, {
  headers: { "x-api-key": env.JUPITER_API_KEY ?? "" },
  needs: ["JUPITER_API_KEY"],
  summarize: jupPrices,
});

// --- DFlow (tokenized Kalshi) ---
// Docs list dev-prediction-markets-api.dflow.net, but it returned NXDOMAIN on 2026-09-13; the keyless dev Trade API host does resolve.
await probe("DFlow", "dev Trade API host (no key)", "https://dev-quote-api.dflow.net/", {
  summarize: (text) => String(text).slice(0, 60),
});
await probe("DFlow", "prod metadata markets (key)", "https://prediction-markets-api.dflow.net/api/v1/markets?limit=2", {
  headers: { "x-api-key": env.DFLOW_API_KEY ?? "" },
  needs: ["DFLOW_API_KEY"],
  summarize: (j) => JSON.stringify(j).slice(0, 140),
});
// Kalshi's public read API shows the same S&P 500 hourly Up/Down series DFlow tokenizes, without any key.
await probe("Kalshi", "S&P 500 hourly Up/Down series (no key)", "https://api.elections.kalshi.com/trade-api/v2/markets?series_ticker=KXINXHUD&limit=3", {
  summarize: (j) => (j.markets ?? []).map((m) => `${m.ticker} status=${m.status} result=${m.result || "-"}`).join(" | ") || "no markets returned",
});

// --- Alpaca ---
const alpacaHeaders = { "APCA-API-KEY-ID": env.ALPACA_KEY_ID ?? "", "APCA-API-SECRET-KEY": env.ALPACA_SECRET_KEY ?? "" };
const alpacaNeeds = ["ALPACA_KEY_ID", "ALPACA_SECRET_KEY"];
await probe("Alpaca", "latest trades IEX", "https://data.alpaca.markets/v2/stocks/trades/latest?symbols=AAPL,NVDA,TSLA&feed=iex", {
  headers: alpacaHeaders,
  needs: alpacaNeeds,
  summarize: (j) => Object.entries(j.trades ?? {}).map(([s, t]) => `${s}=${t.p} @${t.t}`).join(" | "),
});
await probe("Alpaca", `1-min bar ending last close`, `https://data.alpaca.markets/v2/stocks/AAPL/bars?timeframe=1Min&start=${iso(close - 60)}&end=${iso(close)}&feed=iex`, {
  headers: alpacaHeaders,
  needs: alpacaNeeds,
  summarize: (j) => JSON.stringify(j.bars ?? j).slice(0, 140),
});
await probe("Alpaca", "market clock", "https://paper-api.alpaca.markets/v2/clock", {
  headers: alpacaHeaders,
  needs: alpacaNeeds,
  summarize: (j) => `is_open=${j.is_open} next_open=${j.next_open} next_close=${j.next_close}`,
});
await probe("Alpaca", "calendar to year end", "https://paper-api.alpaca.markets/v2/calendar?start=2026-09-14&end=2026-12-31", {
  headers: alpacaHeaders,
  needs: alpacaNeeds,
  summarize: (j) => `${j.length} sessions; early closes: ${j.filter((d) => d.close !== "16:00").map((d) => `${d.date} ${d.close}`).join(", ") || "none"}`,
});

// --- Finnhub ---
const finnhub = (path) => `https://finnhub.io/api/v1/${path}${path.includes("?") ? "&" : "?"}token=${env.FINNHUB_API_KEY ?? ""}`;
await probe("Finnhub", "quote AAPL", finnhub("quote?symbol=AAPL"), {
  needs: ["FINNHUB_API_KEY"],
  summarize: (j) => `c=${j.c} pc=${j.pc} t=${j.t ? iso(j.t) : "-"}`,
});
await probe("Finnhub", "US market status", finnhub("stock/market-status?exchange=US"), {
  needs: ["FINNHUB_API_KEY"],
  summarize: (j) => `isOpen=${j.isOpen} session=${j.session} holiday=${j.holiday}`,
});
const today = new Date().toISOString().slice(0, 10);
const weekOut = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
await probe("Finnhub", "earnings next 7 days", finnhub(`calendar/earnings?from=${today}&to=${weekOut}`), {
  needs: ["FINNHUB_API_KEY"],
  summarize: (j) => `${j.earningsCalendar?.length ?? 0} reports; e.g. ${(j.earningsCalendar ?? []).slice(0, 5).map((e) => e.symbol).join(", ")}`,
});

// --- Helius ---
await probe("Helius", "devnet getSlot", `https://devnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY ?? ""}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot" }),
  needs: ["HELIUS_API_KEY"],
  summarize: (j) => `slot=${j.result}`,
});

// --- Stork ---
await probe("Stork", "latest AAPL/TSLA/NVDA 24_5", "https://rest.jp.stork-oracle.network/v1/prices/latest?assets=AAPL_24_5,TSLA_24_5,NVDA_24_5", {
  headers: { Authorization: `Basic ${env.STORK_API_KEY ?? ""}` },
  needs: ["STORK_API_KEY"],
  summarize: (j) => JSON.stringify(j).slice(0, 140),
});

console.log(`Last regular close used for settlement checks: ${iso(close)}\n`);
console.table(results);
