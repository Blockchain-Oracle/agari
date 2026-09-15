import type { Metadata } from 'next';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { Sora, Inter, JetBrains_Mono } from 'next/font/google';
import { site } from '@/lib/site';
import './global.css';
const sora = Sora({subsets:['latin'],variable:'--font-sora',display:'swap'});
const inter = Inter({subsets:['latin'],variable:'--font-inter',display:'swap'});
const mono = JetBrains_Mono({subsets:['latin'],variable:'--font-mono',display:'swap'});
export const metadata: Metadata = {
  metadataBase: new URL(site.docs),
  title: { default: 'Agari Docs — learn one step at a time', template: '%s · Agari Docs' },
  description: 'Guides to Agari: make a call, understand the sessions and lanes, and see how the Solana programs connect.',
  icons: { icon: '/icon.svg' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body className={`${sora.variable} ${inter.variable} ${mono.variable}`}><a className="skip-link" href="#main-content">Skip to content</a><RootProvider theme={{ defaultTheme:'system', enableSystem:true, storageKey:'agari-docs-theme' }} search={{links:[['Quickstart','/start/quickstart'],['Your first call','/trading/first-trade'],['How it fits together','/architecture/overview']]}}>{children}</RootProvider></body></html>;
}
