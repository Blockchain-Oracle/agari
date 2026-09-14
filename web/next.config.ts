import type { NextConfig } from "next";
import { DOCS_URL, docsUrl } from "./src/lib/docs-url";

const nextConfig: NextConfig = {
  redirects: () => [
    { source: "/docs", destination: DOCS_URL, permanent: false },
    { source: "/docs/:path*", destination: docsUrl(":path*"), permanent: false },
  ],
  transpilePackages: ["@agari/brain", "@agari/core", "@agari/markets"],
};

export default nextConfig;
