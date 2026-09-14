/** The shared read runtime. No account, no signer: everything that signs lives in ../sessions. */
export { bookSnapshot, CANONICAL_BOOK_DEPTH, resetCoordinator, subscribeBook } from "./coordinator";
export {
  closeRuntime,
  configureMarkets,
  ensureMarkets,
  exchangeVersion,
  getClient,
  onRuntimeClose,
  subscribeExchange,
  type ReadClient,
} from "./read-runtime";
