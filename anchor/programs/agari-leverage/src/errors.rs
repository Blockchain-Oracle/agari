use anchor_lang::prelude::*;

#[error_code]
#[derive(PartialEq, Eq)]
pub enum LeverageError {
    #[msg("the reserve is paused")]
    Paused,
    #[msg("those parameters are outside what the reserve accepts")]
    BadParams,
    #[msg("only the reserve's admin may do that")]
    NotAdmin,
    #[msg("that Window is not the venue's, or its accounts do not belong together")]
    UnknownMarket,
    #[msg("that Window trades a different collateral")]
    WrongCollateral,
    #[msg("an outcome is 0 for Up or 1 for Down")]
    BadOutcome,
    #[msg("the reserve's seat is not registered with the venue")]
    ReserveNotRegistered,
    #[msg("that Window was opened before the reserve had a seat")]
    WindowPredatesReserve,
    #[msg("that Window is not open for trading")]
    WindowNotTrading,
    #[msg("too little time is left in that Window for a knock-out to act before the print")]
    TooLate,
    #[msg("a boost is more than 1x and no more than the reserve's maximum")]
    BadLeverage,
    #[msg("the book is too thin for that size")]
    ThinBook,
    #[msg("the entry price is outside the band the reserve boosts in")]
    OutsideBand,
    #[msg("the size is under the venue's minimum, or under what the owner asked for")]
    BelowMinQuantity,
    #[msg("the fill would charge more than the stake")]
    StakeAboveMax,
    #[msg("the boost could not beat the plain bet even when right")]
    Underpriced,
    #[msg("the position would open already under its knock-out line")]
    UnhealthyAtEntry,
    #[msg("the front is over the reserve's cap for one position")]
    OverPositionCap,
    #[msg("too much of the reserve is already fronted on that Window")]
    OverWindowCap,
    #[msg("that would take the reserve past its exposure limit")]
    OverExposure,
    #[msg("the reserve has as many positions open as it allows")]
    TooManyOpen,
    #[msg("the reserve cannot front that right now")]
    InsufficientLiquidity,
    #[msg("that wallet does not hold that many shares")]
    InsufficientShares,
    #[msg("nothing filled against the book")]
    NothingFilled,
    #[msg("the engine returned no result for the order")]
    EngineResultMissing,
    #[msg("what the engine reported and what moved in custody do not agree")]
    EngineAccountingMismatch,
    #[msg("only the position's owner may do that")]
    NotOwner,
    #[msg("the position is not live")]
    NotLive,
    #[msg("the position is above its knock-out line")]
    StillHealthy,
    #[msg("the sale fetched less than the owner's minimum")]
    Slippage,
    #[msg("that Window has not settled yet")]
    MarketNotSettled,
    #[msg("a position past its Window's expiry is unsettled; settle it first, anyone may")]
    UnsettledPosition,
    #[msg("there is nothing owed on that position")]
    NothingOwed,
    #[msg("the amount is zero")]
    ZeroAmount,
    #[msg("the reserve has no value to price shares against")]
    NoEquity,
    #[msg("arithmetic overflowed")]
    MathOverflow,
}
