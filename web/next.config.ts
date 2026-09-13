import type { NextConfig } from "next";
import { DOCS_URL, docsUrl } from "./src/lib/docs-url";

// RainbowKit's wallet list reaches @base-org/account, whose node entry imports @coinbase/cdp-sdk and, through it,
// optional x402 payment modules that are neither installed nor ever executed here. Turbopack fails the build on
// their unresolved imports, so the whole subtree resolves to an inert stub.
const OPTIONAL_DEPENDENCY_STUB = "./src/lib/optional-dependency-stub.cjs";
const NEVER_EXECUTED = ["@coinbase/cdp-sdk"];

const nextConfig: NextConfig = {
  redirects: () => [
    { source: "/docs", destination: DOCS_URL, permanent: false },
    { source: "/docs/:path*", destination: docsUrl(":path*"), permanent: false },
  ],
  transpilePackages: ["@masayume/brain", "@masayume/core", "@masayume/markets"],
  turbopack: {
    resolveAlias: Object.fromEntries(NEVER_EXECUTED.map((specifier) => [specifier, OPTIONAL_DEPENDENCY_STUB])),
  },
};

export default nextConfig;
