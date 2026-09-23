import type { InferPageType } from 'fumadocs-core/source';
import type { source } from './source';
import { site, sourceUrl } from './site';

type GuidePage = InferPageType<typeof source>;

/** Keep the evidence visible when a reader uses Copy Markdown or a text export. */
export async function guideMarkdown(page: GuidePage): Promise<string> {
  const body = await page.data.getText('processed');
  const sources = page.data.sources ?? [];
  // Until the app repository is public, `sourceUrl` is null and a source note names the path alone.
  const notes = sources.length
    ? `\n\n## Source notes\n\nApplication source reviewed ${site.reviewed}, revision ${site.revision}.\n\n${sources.map(path => { const url = sourceUrl(path); return url ? `- [${path}](${url})` : `- \`${path}\``; }).join('\n')}`
    : '';

  return `# ${page.data.title}\n\n${page.data.description || ''}\n\nCanonical URL: ${site.docs}${page.url}\nApplication origin: ${site.app}\nReviewed: ${site.reviewed}\n\n${body}${notes}`;
}
