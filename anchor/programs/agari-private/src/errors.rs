use anchor_lang::prelude::*;

#[error_code]
#[derive(PartialEq, Eq)]
pub enum PrivateError {
    #[msg("private mode is paused")]
    Paused,
    #[msg("the stake band is empty or inverted")]
    BadParams,
    #[msg("only the desk's admin can do that")]
    NotAdmin,
    #[msg("only the desk key can do that")]
    NotDesk,
    #[msg("those accounts are not one Window of the venue")]
    UnknownMarket,
    #[msg("the venue's collateral is not the desk's")]
    WrongCollateral,
    #[msg("the outcome is 0 (Up) or 1 (Down)")]
    BadOutcome,
    #[msg("the desk's seat is not registered with the venue")]
    DeskNotRegistered,
    #[msg("this Window opened before the desk was seated")]
    WindowPredatesDesk,
    #[msg("the Window is not trading")]
    WindowNotTrading,
    #[msg("too close to the Window's end for a three-transaction open")]
    TooLate,
    #[msg("the amount is zero")]
    ZeroAmount,
    #[msg("the private balance is smaller than that")]
    Insufficient,
    #[msg("the desk's allowance is smaller than that")]
    OverAllowance,
    #[msg("the pool holds less than that")]
    PoolShort,
    #[msg("that key has been used")]
    KeyUsed,
    #[msg("the stake is outside the desk's band")]
    StakeOutsideBand,
    #[msg("the slot is already funded")]
    SlotAlreadyFunded,
    #[msg("the slot is not funded")]
    SlotNotFunded,
    #[msg("the slot has already minted")]
    SlotAlreadyMinted,
    #[msg("the slot still holds contracts; settle it first")]
    SlotHoldsContracts,
    #[msg("the slot holds no cash")]
    SlotEmpty,
    #[msg("the book fills fewer contracts than the owner's guard")]
    BelowMinQuantity,
    #[msg("the fill cost more than the slot's stake")]
    StakeAboveMax,
    #[msg("nothing filled")]
    NothingFilled,
    #[msg("the venue has not settled that Window")]
    MarketNotSettled,
    #[msg("the slot holds no contracts to settle")]
    NothingToSettle,
    #[msg("the engine returned no result")]
    EngineResultMissing,
    #[msg("the engine's report does not match the money that moved")]
    EngineAccountingMismatch,
    #[msg("arithmetic overflowed")]
    MathOverflow,
}
