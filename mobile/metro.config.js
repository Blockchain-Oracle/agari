// Workspace packages (@agari/markets) carry their own dev copies of React and React Query; Metro would load both
// copies beside the app's and React Native refuses two Reacts. Every import of these resolves to the app's copy.
// Metro does not tree-shake, so operator-only modules the phone never calls (the deploy client's undici transport)
// still get bundled: those resolve to an empty module.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const SINGLETONS = ["react", "react-native", "@tanstack/react-query"];
const OPERATOR_ONLY = new Set(["undici"]);
const appRoot = path.join(__dirname, "node_modules");

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (OPERATOR_ONLY.has(moduleName)) return { type: "empty" };
  const pinned = SINGLETONS.find((name) => moduleName === name || moduleName.startsWith(`${name}/`));
  const ctx = pinned ? { ...context, originModulePath: path.join(appRoot, "index.js") } : context;
  return (upstream ?? context.resolveRequest)(ctx, moduleName, platform);
};

module.exports = config;
