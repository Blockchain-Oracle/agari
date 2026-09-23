// Workspace packages (@agari/markets) carry their own dev copies of React and React Query; Metro would load both
// copies beside the app's and React Native refuses two Reacts. Every import of these resolves to the app's copy.
// Metro does not tree-shake, so operator-only modules the phone never calls (the deploy client's undici transport)
// still get bundled: those resolve to an empty module.
// The app reuses web's own hooks and copy (`@/` → web/src, tsconfig paths); the few web files bound to the browser or
// to Next resolve to the app's stand-ins in src/web-shims, whoever imports them.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const SINGLETONS = ["react", "react-native", "@tanstack/react-query"];
const OPERATOR_ONLY = new Set(["undici"]);
const appRoot = path.join(__dirname, "node_modules");
const webSrc = path.resolve(__dirname, "../web/src");
const shims = path.join(__dirname, "src/web-shims");
const WEB_SHIMS = new Map([
  [path.join(webSrc, "lib/env.ts"), path.join(shims, "env.ts")],
  [path.join(webSrc, "lib/visibility.ts"), path.join(shims, "visibility.ts")],
  [path.join(webSrc, "lib/toast.ts"), path.join(shims, "toast.ts")],
  [path.join(webSrc, "features/funding/credited.ts"), path.join(shims, "credited.ts")],
  [path.resolve(__dirname, "../packages/markets/src/runtime/page.ts"), path.join(shims, "page.ts")],
]);

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (OPERATOR_ONLY.has(moduleName)) return { type: "empty" };
  // tweetnacl's Node fallback requires "crypto"; the app's Node-compatible crypto is quick-crypto.
  if (moduleName === "crypto") return context.resolveRequest(context, "react-native-quick-crypto", platform);
  const pinned = SINGLETONS.find((name) => moduleName === name || moduleName.startsWith(`${name}/`));
  const ctx = pinned ? { ...context, originModulePath: path.join(appRoot, "index.js") } : context;
  const resolved = (upstream ?? context.resolveRequest)(ctx, moduleName, platform);
  const shim = resolved.type === "sourceFile" ? WEB_SHIMS.get(resolved.filePath) : undefined;
  return shim ? { type: "sourceFile", filePath: shim } : resolved;
};

module.exports = config;
