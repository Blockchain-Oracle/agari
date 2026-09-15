//! One error enum (vault.md §6, D-064). Explicit discriminants from 1000, so Anchor's +6000 puts every code in
//! 7000–7299 and a CPI failure's `Custom(code)` tells vault from engine (6000–6307) without reading logs.

use anchor_lang::prelude::*;

#[error_code]
pub enum VaultError {
    // 7000 funding
    #[msg("amount must be greater than zero")]
    ZeroAmount = 1000,
    #[msg("not enough balance for this amount")]
    Insufficient = 1001,
    #[msg("collateral mint does not match the vault")]
    WrongCollateral = 1002,
    #[msg("token account does not belong to the owner")]
    WrongTokenOwner = 1003,
    #[msg("signer is not the program upgrade authority")]
    NotAdmin = 1004,
    #[msg("arithmetic overflow")]
    MathOverflow = 1005,

    // 7100 grants and caps
    #[msg("no grant with this id")]
    NoSuchGrant = 1100,
    #[msg("signer is not the grant's actor")]
    NotGrantActor = 1101,
    #[msg("grant does not belong to this owner")]
    NotGrantOwner = 1102,
    #[msg("grant is revoked")]
    GrantIsRevoked = 1103,
    #[msg("grant has expired")]
    GrantExpired = 1104,
    #[msg("grant expiry must be in the future")]
    BadExpiry = 1105,
    #[msg("grant actor must not be the zero key")]
    ZeroActor = 1106,
    #[msg("grant kind must be SESSION, EXECUTOR or STRATEGY")]
    BadGrantKind = 1107,
    #[msg("fill cost exceeds the per-trade cap")]
    OverStakeCap = 1108,
    #[msg("fill cost exceeds today's spending cap")]
    OverDailyCap = 1109,
    #[msg("a new position exceeds the open-position cap")]
    OverPositionCap = 1110,
    #[msg("price exceeds the grant's price cap")]
    OverPriceCap = 1111,
    #[msg("a grant attributed to this position was not passed")]
    GrantAccountMissing = 1112,
    #[msg("previous grant does not match the active grant of this kind")]
    ActiveGrantMismatch = 1113,
    #[msg("grant id is not the next grant id")]
    StaleGrantId = 1114,

    // 7200 trading and settlement
    #[msg("market, series, book or ledger is not a bound agari-events Window")]
    UnknownMarket = 1200,
    #[msg("market is not trading")]
    MarketNotTrading = 1201,
    #[msg("market is not resolved or voided")]
    MarketNotSettled = 1202,
    #[msg("no position to settle on this market")]
    NothingToSettle = 1203,
    #[msg("outcome must be 0 (YES) or 1 (NO)")]
    BadOutcome = 1204,
    #[msg("price must be between 1 and 999 ticks")]
    BadPrice = 1205,
    #[msg("the vault seat is not a registered program authority")]
    VaultNotRegistered = 1206,
    #[msg("this Window was listed before the vault registered its seat")]
    WindowPredatesVault = 1207,
    #[msg("every position slot is in use: settle a finished Window first")]
    PositionSlotsFull = 1208,
    #[msg("the engine returned no placement result")]
    EngineResultMissing = 1209,
    #[msg("engine amounts do not match the vault's accounting")]
    EngineAccountingMismatch = 1210,
}
