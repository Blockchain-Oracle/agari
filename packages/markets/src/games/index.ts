/**
 * Duels and the season pool on Solana are `agari-arena` (S12b): a two-player match over real Windows, each card one
 * confirmed IOC pick, and only the side-pot the arena's to award. Reads come from the chain and the program's own
 * events; writes go through the session's lanes.
 */
export { deckCommitment, keccak256 } from "./commitment";
export { arenaProgramId, seasonVaultAddress } from "./deployment";
export { decodeArenaEvent } from "./events";
export {
  arenaHeadBlock, getArenaCredit, getArenaMatch, getArenaState, getSeasonPool, listArenaEvents, quoteArenaPick, readArenaAgent, resolveArenaDeployment,
  type ArenaMatchView, type ArenaState, type SeasonPoolState,
} from "./read";
export { submitArenaPickWrite, submitArenaTx, type ArenaPickOutcome } from "./write";
export { distributeSeasonPrizes, type DistributeSeasonInput } from "./admin-write";
