//! One error enum (desk.md §4.6). Explicit discriminants from 1000, so Anchor's +6000 puts every code in 7000–7299
//! and a CPI failure's `Custom(code)` tells the desk from the router or a token program without reading logs.

use anchor_lang::prelude::*;

#[error_code]
pub enum DeskError {
    // 7000 roles and arguments
    #[msg("signer is not the program upgrade authority")]
    NotAdmin = 1000,
    #[msg("signer is not the desk's owner")]
    NotOwner = 1001,
    #[msg("signer is not the desk's operator")]
    NotOperator = 1002,
    #[msg("signer is neither the owner nor the operator")]
    NotOwnerOrOperator = 1003,
    #[msg("the desk is paused")]
    IsPaused = 1004,
    #[msg("the desk is in practice mode: nothing is sent")]
    ShadowMode = 1005,
    #[msg("decision hash must not be zero")]
    ZeroHash = 1006,
    #[msg("amount must be greater than zero")]
    ZeroAmount = 1007,
    #[msg("the deadline has passed")]
    DeadlinePassed = 1008,
    #[msg("caps must be positive and the per-action cap at most the daily cap; mode must be 0, 1 or 2")]
    BadConfig = 1009,
    #[msg("operator must be a real key other than the owner")]
    BadOperator = 1010,
    #[msg("cluster tag must be 101, 103 or 104")]
    BadClusterTag = 1011,
    #[msg("arithmetic overflow")]
    MathOverflow = 1012,
    #[msg("this instruction cannot be called through CPI")]
    CpiNotAllowed = 1013,

    // 7100 tokens and accounts
    #[msg("this mint is not configured on the desk")]
    TokenNotConfigured = 1100,
    #[msg("the owner has not allowed the desk to buy this name")]
    TokenNotEnabled = 1101,
    #[msg("the desk already holds the most names it can")]
    TooManyTokens = 1102,
    #[msg("a name must be a Token-2022 mint with 9 decimals and not the collateral")]
    BadToken = 1103,
    #[msg("mint does not match")]
    WrongMint = 1104,
    #[msg("token account does not belong to the owner, or is not the owner's associated account")]
    WrongTokenOwner = 1105,
    #[msg("swap program is not the configured router")]
    WrongSwapProgram = 1106,
    #[msg("a token account owned by the desk was slipped into the route")]
    DeskAccountLeak = 1107,

    // 7200 guards
    #[msg("action exceeds the per-action cap")]
    OverPerActionCap = 1200,
    #[msg("action exceeds what is left of the daily cap")]
    OverDailyCap = 1201,
    #[msg("no reference has been posted for this name")]
    ReferenceUnavailable = 1202,
    #[msg("the reference is too old, or a post is not from the last 15 minutes")]
    ReferenceStale = 1203,
    #[msg("a reference must be newer than the one posted")]
    ReferenceNotMonotonic = 1204,
    #[msg("reference prices and the multiplier must be positive")]
    InvalidReference = 1205,
    #[msg("the ed25519 instruction before this one does not sign this exact message")]
    BadAttestation = 1206,
    #[msg("the signing key is not a configured attestor")]
    UnknownAttestor = 1207,
    #[msg("the name is further above its reference than the owner's ceiling")]
    PremiumTooHigh = 1208,
    #[msg("this desk requires a Pyth index update with every buy")]
    PythIndexRequired = 1209,
    #[msg("the Pyth update is not fully verified, not this name's feed, not positive, or older than 60 s")]
    PythIndexInvalid = 1210,
    #[msg("the route returned less than the 8% band floor allows")]
    BelowOracleFloor = 1211,
    #[msg("the route spent a different amount than the desk asked")]
    UnexpectedSpend = 1212,
    #[msg("the route returned nothing")]
    NothingReceived = 1213,
}
