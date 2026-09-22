/**
 * `@agari/markets/desk` (S21, D-126): agari-desk on mainnet through an explicit RPC. Reads, instruction builders, the
 * attested reference, Jupiter quotes and routes, the operator client and its four actions, the event history, and
 * the owner's browser session. Nothing here uses the devnet read runtime.
 */
export { buy, checkpoint, postReference, sell, swapAccountsOf, type CheckpointAction, type PostReferenceAction, type SwapAction, type SwapResult } from "./actions";
export {
  associatedTokenAddress,
  DESK_MINTS,
  deskAddress,
  deskConfigAddress,
  deskEventAuthority,
  deskProgramId,
  deskRefAddress,
  deskSymbolOfMint,
  deskTokenAccounts,
  INSTRUCTIONS_SYSVAR,
  JUPITER_V6,
  MAINNET_CLUSTER_TAG,
  PYTH_INDEX_FEEDS,
  TOKEN_2022_PROGRAM,
  TOKEN_PROGRAM,
  tokenProgramOf,
  USDC_MAINNET,
} from "./deployment";
export { createBrowserDeskRpc, readOwnerDeskBalances, readSealsOf, type OwnerDeskBalances, type OwnerNameBalance } from "./browser-reads";
export { decodeDeskEventPayload, decodeDeskEvents, readDeskEventsOf, readDeskHistory, sealedActionsOf, type DeskEvent, type DeskEventName, type DeskHistoryEntry, type LocatedDeskEvent, type SealedAction } from "./history";
export {
  allowTokenIx,
  buyIx,
  checkpointIx,
  depositIx,
  disallowTokenIx,
  initConfigIx,
  initReferenceIx,
  openDeskIx,
  pauseIx,
  postReferenceIx,
  revokeOperatorIx,
  sellIx,
  setAttestorsIx,
  setLimitsIx,
  setModeIx,
  setOperatorIx,
  setReferenceFeedIx,
  unpauseIx,
  WHOLE_BALANCE,
  withdrawIx,
  type InitConfigInput,
  type OpenDeskInput,
  type PostReferenceIxInput,
  type SwapIxInput,
} from "./instructions";
export {
  DEFAULT_SLIPPAGE_BPS,
  DESK_MAX_ROUTE_ACCOUNTS,
  impactPctToBps,
  JUPITER_KEYED_SWAP_URL,
  JUPITER_LITE_SWAP_URL,
  JupiterError,
  quoteSwap,
  swapInstructions,
  type JupiterQuote,
  type JupiterRoute,
  type QuoteInput,
  type SwapInstructionsInput,
} from "./jupiter-swap";
export { forkAirdrop, forkClockSec, forkSetTokenAccount, forkTimeTravel, prewarmRoute, refreshRoute, surfnetCall, tokenBalance, type Prewarmed } from "./fork";
export { ensureDeskConfig, ensureDeskReference, initDesk, programUpgradeAuthority, readDeskInitPlan, type DeskInitPlan, type DeskInitRecord, type DeskInitWant } from "./init";
export { NotRefusedError, sendForRefusal, withdrawAsStrangerIx, type Refusal, type RefusalOptions, type RefusalStage } from "./prove";
export { fetchLookupTables, withLookupTables } from "./lookup-tables";
export { createDeskMainnetSession, type DeskMainnetSession, type DeskMainnetSessionConfig, type DeskWriteResult } from "./mainnet-session";
export { createDeskOperatorClient, deskErrorCode, DeskSendError, DeskSendUnknownError, type DeskOperatorClient, type DeskOperatorClientConfig, type DeskSendOptions, type DeskSendResult } from "./operator-client";
export { readDeskConfig, readDeskMints, readDeskRefs, readDeskState, type DeskAllowedToken, type DeskConfigState, type DeskMintState, type DeskRefState, type DeskRpc, type DeskState, type DeskTokenAccountState } from "./reads";
export { DESK_REF_MESSAGE_BYTES, deskReferenceMessage, postReferenceInstructions, type DeskReferenceFields, type PostReferenceInput } from "./reference";
export { chainNowSec, createDeskRpc, listDesksByOperator, signatureOutcome, type DiscoveredDesk, type SignatureOutcome } from "./rpc";
