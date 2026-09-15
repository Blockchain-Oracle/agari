import { source } from '@/lib/source';
import { site } from '@/lib/site';
export const dynamic = 'force-static';

export function GET() {
  const start = ['/start/quickstart', '/trading/first-trade', '/architecture/overview'];
  const pages = source.getPages();
  const priority = start.flatMap(url => pages.filter(page => page.url === url));
  const entry = (page: (typeof pages)[number]) => {
    const raw = `${site.docs}/raw/${page.slugs.join('/')}`;
    return `- [${page.data.title}](${site.docs}${page.url}): ${page.data.description || ''} [Markdown](${raw})`;
  };
  const readme = site.source && site.revision ? `\n- [Application README](${site.source}/blob/${site.revision}/README.md): Product overview, proof and architecture.` : '';
  const text = `# Agari Docs

> Guides to Agari, a stock-price Up/Down prediction market on Solana devnet. Reviewed ${site.reviewed}.

Agari's own Anchor programs (\`agari-events\`, \`agari-vault\`) settle calls from signed Pyth/RedStone/Switchboard price prints. Devnet only; tUSDC test collateral. No public application repository exists yet, so source links are not included until one does.

## Start here

${priority.map(entry).join('\n')}

## All guides

${pages.filter(page => !start.includes(page.url)).map(entry).join('\n')}

## Complete export

- [Full documentation text](${site.docs}/llms-full.txt): All guides with canonical URLs.${readme}
`;
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
