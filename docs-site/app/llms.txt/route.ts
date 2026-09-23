import { source } from '@/lib/source';
import { site } from '@/lib/site';
export const dynamic = 'force-static';

export function GET() {
  const start = ['/start/quickstart', '/trading/first-trade', '/architecture/overview', '/architecture/prestocks-and-pyth'];
  const pages = source.getPages();
  const priority = start.flatMap(url => pages.filter(page => page.url === url));
  const entry = (page: (typeof pages)[number]) => {
    const raw = `${site.docs}/raw/${page.slugs.join('/')}`;
    return `- [${page.data.title}](${site.docs}${page.url}): ${page.data.description || ''} [Markdown](${raw})`;
  };
  const readme = site.source && site.revision ? `\n- [Application README](${site.source}/blob/${site.revision}/README.md): Product overview, proof and architecture.` : '';
  const text = `# Agari Docs

> Guides to Agari, a stock-price Up/Down prediction market on Solana devnet. Reviewed ${site.reviewed}.

Agari's own Anchor programs settle Up/Down Windows on Solana devnet with tUSDC test collateral, from boundary prints verified on chain: Pyth pull updates, RedStone signatures, Switchboard On-Demand quotes, and PreStocks prices signed by Agari's attestor. The PreStocks desk (\`agari-desk\`) is a separate program built for Solana mainnet and not yet deployed there; practice desks move no money. ${site.source ? `Application source: ${site.source} at ${site.revision}.` : 'The application repository is not public yet, so source links are not included.'}

## Start here

${priority.map(entry).join('\n')}

## All guides

${pages.filter(page => !start.includes(page.url)).map(entry).join('\n')}

## Complete export

- [Full documentation text](${site.docs}/llms-full.txt): All guides with canonical URLs.${readme}
`;
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
