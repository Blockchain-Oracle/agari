import { createMDX } from 'fumadocs-mdx/next';
const withMDX = createMDX();

// Pages removed while porting this fork from Masayume to Agari (D-084 defers S8-S12/S14;
// games/agents/builders each collapse to one honest page; several architecture pages described
// the old Somnia/DreamDEX substrate and are folded into the four kept architecture pages).
const removedRedirects = [
  ['/games/practice', '/games/overview'],
  ['/games/duel', '/games/overview'],
  ['/games/lucky-draw', '/games/overview'],
  ['/games/moonshot', '/games/overview'],
  ['/games/line-rider', '/games/overview'],
  ['/games/candle-hop', '/games/overview'],
  ['/games/history-rewards', '/games/overview'],
  ['/agents/launch', '/agents/overview'],
  ['/agents/copy', '/agents/overview'],
  ['/agents/memory-market', '/agents/overview'],
  ['/builders/dreamdex-sdk', '/builders/overview'],
  ['/builders/local-setup', '/builders/overview'],
  ['/builders/self-host-agent', '/builders/overview'],
  ['/builders/services', '/builders/overview'],
  ['/builders/contracts', '/builders/overview'],
  ['/builders/api', '/builders/overview'],
  ['/builders/configuration', '/builders/overview'],
  ['/builders/docs-site', '/builders/overview'],
  ['/architecture/event-contracts', '/architecture/programs'],
  ['/architecture/data', '/architecture/ops-and-indexer'],
  ['/architecture/realtime', '/architecture/ops-and-indexer'],
  ['/architecture/agents', '/agents/overview'],
  ['/architecture/games', '/games/overview'],
  ['/architecture/earn', '/trading/coming-soon'],
  ['/architecture/leverage', '/trading/coming-soon'],
  ['/architecture/private', '/trading/coming-soon'],
  ['/architecture/range', '/trading/coming-soon'],
  ['/architecture/x', '/explore/sensei'],
  ['/trading/earn', '/trading/coming-soon'],
  ['/trading/leverage', '/trading/coming-soon'],
  ['/trading/parlay', '/trading/coming-soon'],
  ['/trading/private', '/trading/coming-soon'],
  ['/trading/range', '/trading/coming-soon'],
  ['/explore/install', '/start/quickstart'],
  ['/explore/trade-from-x', '/help/availability'],
];

export default withMDX({
  reactStrictMode: true,
  agentRules: false,
  devIndicators: false,
  async redirects() {
    return removedRedirects.map(([source, destination]) => ({ source, destination, permanent: false }));
  },
});
