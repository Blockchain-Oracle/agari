// Workspace packages (@agari/markets) carry their own dev copies of React and React Query; Metro would load both
// copies beside the app's and React Native refuses two Reacts. Every import of these resolves to the app's copy.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const SINGLETONS = ["react", "react-native", "@tanstack/react-query"];
const appRoot = path.join(__dirname, "node_modules");

const upstream = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const pinned = SINGLETONS.find((name) => moduleName === name || moduleName.startsWith(`${name}/`));
  const ctx = pinned ? { ...context, originModulePath: path.join(appRoot, "index.js") } : context;
  return (upstream ?? context.resolveRequest)(ctx, moduleName, platform);
};

module.exports = config;
