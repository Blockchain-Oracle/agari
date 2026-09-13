/**
 * The shared read-only DreamDEX runtime. No account, no signer, no `.trader`.
 * Everything that signs lives in ../sessions.
 */
export { bookSnapshot, CANONICAL_BOOK_DEPTH, resetCoordinator, subscribeBook } from "./coordinator";
export {
  activeWsIndex,
  AUTO_ROTATE_RPC,
  closeRuntime,
  configureMarkets,
  ensureMarkets,
  exchangeVersion,
  getClient,
  rotateRpc,
  subscribeExchange,
} from "./read-runtime";
export { checkEndpoints, endpointHealth, selectReadEndpoint, type EndpointHealth } from "./health";
