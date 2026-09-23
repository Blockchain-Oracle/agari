import { createMDX } from 'fumadocs-mdx/next';
import { legacyRedirects } from './lib/legacy-redirects.mjs';
const withMDX = createMDX();

export default withMDX({
  reactStrictMode: true,
  agentRules: false,
  devIndicators: false,
  async redirects() {
    return legacyRedirects.map(([source, destination]) => ({ source, destination, permanent: false }));
  },
});
