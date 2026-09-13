import type { EdgeWindow } from "@masayume/core/projection";

/** `/portfolio/edge` — ported from the reference's Trader Edge page; facts adapted to DreamDEX. */
export const EDGE = {
  title: "Trader Edge",
  back: "Portfolio",
  intro: {
    title: "Know your edge.",
    lede: "Your settled Masayume Windows, turned into a clear record of what pays, what costs, and when you trade best.",
    folio: "01",
    source: { label: "Source", value: "DreamDEX on Somnia" },
    method: { label: "Method", value: "On-chain / in your browser" },
    detailsLabel: "Report details",
  },
  states: {
    connect: {
      eyebrow: "Wallet-owned record",
      title: "See the trader your history reveals.",
      copy: "Connect the wallet you trade with. The report is calculated from its on-chain fills, without uploading a separate journal.",
    },
    reading: "Reading your on-chain trading history",
    failed: {
      eyebrow: "Account read failed",
      title: "Your history is still on-chain.",
      retry: "Try again",
      retrying: "Reading account",
    },
    none: {
      eyebrow: "No settled rounds yet",
      title: "Your edge starts after the close.",
      open: (n: number) => `${n} open ${n === 1 ? "round is" : "rounds are"} still waiting to settle.`,
      first: "Place a prediction, let it settle, and this report will build itself from your account.",
      action: "Go to markets",
    },
    partial: "This wallet has more history than one reading can page; the report covers its most recent part.",
  },
  report: {
    netLabel: "Net result",
    roi: (pct: string) => `${pct}% return on settled stake`,
    roiUnavailable: "Return unavailable",
    sample: (settled: number, open: number) => [`${settled} SETTLED ROUNDS`, `${open} OPEN`] as const,
    chartLabel: (net: string, settled: number) => `Cumulative result ${net} across ${settled} settled rounds`,
    firstClose: "FIRST CLOSE",
    latestClose: "LATEST CLOSE",
    readoutLabel: "Masayume readout",
    readoutFoot: "Patterns become more useful with a larger sample. This is a description of your record, not a promise about the next round.",
    readout: {
      moreRounds: (needed: number) => `${needed} more settled ${needed === 1 ? "round" : "rounds"} will reveal your first useful pattern.`,
      bestWindow: (label: string, net: string, count: number) => `${label} is your strongest window so far: ${net} across ${count} settled rounds.`,
      profitFactor: (factor: string, symbol: string) => `Your profitable rounds return ${factor} ${symbol} for every 1 ${symbol} lost.`,
      drawdown: (slide: string) => `Your deepest slide is ${slide}. Smaller stakes would reduce the part of your record doing the most damage.`,
      flat: "Your record is close to flat. More settled rounds will make the signal clearer.",
    },
    metrics: {
      winRate: { label: "Winning rounds", note: (wins: number, losses: number) => `${wins} won, ${losses} lost`, unset: "Not set" },
      profitFactor: { label: "Profit factor", note: "gross profit divided by gross loss", noLoss: "No loss" },
      expectancy: { label: "Average round", note: "your current expectancy", unset: "Not set" },
      drawdown: { label: "Deepest slide", note: (symbol: string) => `${symbol} from peak to trough` },
    },
    windows: {
      title: "When you perform best",
      copy: "Results are grouped by your browser's local time. Only fully settled rounds count.",
      unreadable: "Close times could not be read for this history. Your P&L totals above are still complete.",
      labels: {
        "late-night": { label: "Late night", range: "00:00-05:59" },
        morning: { label: "Morning", range: "06:00-11:59" },
        afternoon: { label: "Afternoon", range: "12:00-17:59" },
        evening: { label: "Evening", range: "18:00-23:59" },
      } satisfies Record<EdgeWindow["key"], { label: string; range: string }>,
      none: "No rounds",
      rounds: (n: number) => `${n} ${n === 1 ? "ROUND" : "ROUNDS"}`,
    },
    payoff: {
      title: "Your payoff shape",
      averageWin: "Average win",
      averageLoss: "Average loss",
      bestRun: "Best run",
      runs: (n: number) => `${n} ${n === 1 ? "win" : "wins"}`,
      fees: "Settlement fees",
      stake: "Settled stake",
      noWins: "No wins yet",
      noLosses: "No losses yet",
      provenanceLabel: "How this is verified",
      provenance:
        "The report is calculated in your browser from your fills and complete-set actions on DreamDEX's indexer, settled by the chain's own rule and checked against your live balances. Redeeming a position does not erase it from this ledger.",
    },
    footer: "This report measures settled Windows because a Window is what settles. Every figure is a fill, or the settlement rule applied to one — never an estimate.",
  },
} as const;
