/**
 * agari-vault's refusals (vault.md §6, 7000–7299) in the one diagnosis vocabulary, keyed by Masayume's error names
 * (`M:vault/errors.ts:6-29`) so web refusal copy reads `errorName` unchanged. A vault failure surfaces as `Custom(code)`
 * at the vault instruction's index; engine codes (6000–6399) raised inside its CPI keep the S4 table.
 */
import { diagnosis, type Diagnosis, type DiagnosisKind } from "@agari/core/types";
import { customCode, failureDiagnosis } from "../submitter/chain-failure";
import { describeChainFailure, type ChainFailure } from "../submitter/errors";

export const VAULT_ERROR_RANGE = { min: 7000, max: 7299 } as const;
/**
 * Anchor's own constraint failures run before any `#[error_code]` of ours (D-019): a grant account that does not exist
 * fails `AccountNotInitialized` (3012) or `AccountOwnedByWrongProgram` (3007), and an account whose seeds name another
 * owner fails `ConstraintSeeds` (2006). They mean the same thing to a person as 7100/7102, so they read the same.
 */
const ANCHOR_ERRORS = new Map<number, readonly [string, DiagnosisKind, string?]>([
  [2006, ["ConstraintSeeds", "grant-refused", "this account does not belong to that owner"]],
  [3007, ["AccountOwnedByWrongProgram", "grant-refused", "no grant with this id"]],
  [3012, ["AccountNotInitialized", "grant-refused", "no grant with this id"]],
]);
/** 7207's copy: a Window listed before the vault registered keeps a user in seat 0 (D-063). */
export const WINDOW_PREDATES_VAULT = "Trading Balance opens with the next Window";

/** code → [IDL / Masayume name, kind, what to tell a person when the name alone is not enough]. */
const VAULT_ERRORS = new Map<number, readonly [string, DiagnosisKind, string?]>([
  [7000, ["ZeroAmount", "below-min-quantity"]],
  [7001, ["Insufficient", "insufficient-collateral"]],
  [7002, ["WrongCollateral", "contract-revert"]],
  [7003, ["WrongTokenOwner", "contract-revert"]],
  [7004, ["NotAdmin", "contract-revert"]],
  [7005, ["MathOverflow", "contract-revert"]],
  [7100, ["NoSuchGrant", "grant-refused"]],
  [7101, ["NotGrantActor", "grant-refused"]],
  [7102, ["NotGrantOwner", "grant-refused"]],
  [7103, ["GrantIsRevoked", "grant-refused"]],
  [7104, ["GrantExpired", "grant-refused"]],
  [7105, ["BadExpiry", "grant-refused"]],
  [7106, ["ZeroActor", "grant-refused"]],
  [7107, ["BadGrantKind", "grant-refused"]],
  [7108, ["OverStakeCap", "grant-refused"]],
  [7109, ["OverDailyCap", "grant-refused"]],
  [7110, ["OverPositionCap", "grant-refused"]],
  [7111, ["OverPriceCap", "grant-refused"]],
  [7112, ["GrantAccountMissing", "grant-refused"]],
  [7113, ["ActiveGrantMismatch", "grant-refused"]],
  [7114, ["StaleGrantId", "grant-refused"]],
  [7200, ["UnknownMarket", "market-not-trading"]],
  [7201, ["MarketNotTrading", "market-not-trading"]],
  [7202, ["MarketNotSettled", "not-settled"]],
  [7203, ["NothingToSettle", "already-claimed"]],
  [7204, ["BadOutcome", "contract-revert"]],
  [7205, ["BadPrice", "invalid-price"]],
  [7206, ["VaultNotRegistered", "not-deployed", "agari-vault is not registered as a program authority on this venue yet"]],
  [7207, ["WindowPredatesVault", "market-not-trading", WINDOW_PREDATES_VAULT]],
  [7208, ["PositionSlotsFull", "contract-revert", "settle a finished Window first"]],
  [7209, ["EngineResultMissing", "contract-revert"]],
  [7210, ["EngineAccountingMismatch", "contract-revert"]],
]);

/** The vault's own code for a failure, or null when it is not a vault refusal. */
export function vaultCodeOf(failure: Pick<ChainFailure, "err">): number | null {
  const code = customCode(failure.err);
  if (code === null) return null;
  if (ANCHOR_ERRORS.has(code)) return code;
  return code >= VAULT_ERROR_RANGE.min && code <= VAULT_ERROR_RANGE.max ? code : null;
}

export const VAULT_CODE = {
  insufficient: 7001,
  staleGrantId: 7114,
  marketNotTrading: 7201,
  nothingToSettle: 7203,
  windowPredatesVault: 7207,
} as const;

/** A named vault refusal as a diagnosis; unknown codes in the range are a plain revert with the code. */
export function vaultDiagnosis(code: number, technical: string): Diagnosis {
  const known = VAULT_ERRORS.get(code) ?? ANCHOR_ERRORS.get(code);
  if (!known) return diagnosis("contract-revert", `agari-vault ${code}: ${technical}`);
  const [name, kind, copy] = known;
  return diagnosis(kind, copy ? `${copy} (${name}): ${technical}` : `${name}: ${technical}`, { errorName: name });
}

/** Any failure of a vault transaction: the vault's table first, then the engine's and the fee payer's (S4). */
export function vaultFailureDiagnosis(failure: ChainFailure): Diagnosis {
  const code = vaultCodeOf(failure);
  return code === null ? failureDiagnosis(failure) : vaultDiagnosis(code, describeChainFailure(failure));
}
