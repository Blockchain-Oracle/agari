import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { source } from '@/lib/source';
import { Header, EmptySlot } from '@/components/header';
import { ArrowUpRight } from 'lucide-react';
import { site } from '@/lib/site';

function SidebarFooter() {
  return <div className="sidebar-footer">
    {site.source && <a className="sidebar-github" href={site.source} target="_blank" rel="noopener noreferrer" aria-label="GitHub (opens in a new tab)">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
      <span>GitHub</span>
      <ArrowUpRight size={15} aria-hidden="true" />
    </a>}
    <p className="sidebar-note">Built on Solana devnet.<br/>Explained step by step.</p>
  </div>;
}

export default function DocumentationLayout({ children }: { children: React.ReactNode }) {
  return <DocsLayout tree={source.getPageTree()} tabs={false} nav={{title:'Agari Docs'}} slots={{header:Header,navTitle:EmptySlot}} themeSwitch={{enabled:false}} searchToggle={{enabled:false}} sidebar={{collapsible:false,defaultOpenLevel:0,footer:<SidebarFooter key="docs-footer" />}} containerProps={{style:{gridTemplate:'"header header header" "sidebar toc-popover toc" "sidebar main toc" 1fr / var(--fd-sidebar-col) minmax(0, 1fr) var(--fd-toc-width)','--fd-docs-row-1':'72px','--fd-docs-row-2':'72px','--fd-docs-row-3':'calc(72px + var(--fd-toc-popover-height))'} as React.CSSProperties}}>{children}</DocsLayout>;
}
