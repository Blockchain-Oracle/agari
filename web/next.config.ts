import type { NextConfig } from "next";
import { DOCS_URL, docsUrl } from "./src/lib/docs-url";

const nextConfig: NextConfig = {
  redirects: () => [
    { source: "/docs", destination: DOCS_URL, permanent: false },
    { source: "/docs/:path*", destination: docsUrl(":path*"), permanent: false },
  ],
  transpilePackages: ["@agari/brain", "@agari/core", "@agari/markets"],
  // Next 16 writes AGENTS.md and CLAUDE.md on `next dev`; this repository carries no AI-tool files.
  agentRules: false,
};

export default nextConfig;
