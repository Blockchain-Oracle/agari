/**
 * Boost on Solana is `agari-leverage` (S10c): a reserve that fronts part of a position's cost, holds the contracts
 * as a program seat in the engine, and is repaid first out of whatever they fetch. Every figure a surface shows is
 * read from the chain or computed by the chain's own arithmetic (`@agari/core/leverage`).
 */
export { leverageProgramId } from "./deployment";
export { previewLeverageOpen, refusalDiagnosis, sizeLeverageForStake } from "./quote";
export { getLeverageMark, getLeveragePosition, getLeverageReserveState, getLeverageSharesOf, listLeverageOpenPositions, listLeveragePositionsOf } from "./reads";
export type { LeverageOpenOutcome } from "./types";
export { submitLeverageOpenWrite, submitLeverageTx } from "./writes";
