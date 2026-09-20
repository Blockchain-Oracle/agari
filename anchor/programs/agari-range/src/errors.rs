use anchor_lang::prelude::*;

#[error_code]
pub enum RangeError {
    #[msg("the band is empty or inverted")]
    BadBand,
    #[msg("the reserve is paused")]
    Paused,
    #[msg("that Window is not open for calls")]
    WindowNotTrading,
    #[msg("that Window has no opening print yet")]
    NoOpeningPrint,
    #[msg("that Window has no closing print yet")]
    NoClosingPrint,
    #[msg("the venue has no fresh mark for that Window")]
    StaleMark,
    #[msg("the venue's mark is outside the band the reserve will price against")]
    CenterOutOfRange,
    #[msg("too little time is left in that Window to price a round")]
    TooLate,
    #[msg("that Window closes further out than the reserve will price")]
    BeyondHorizon,
    #[msg("the priced side is too much of a long shot")]
    LongShot,
    #[msg("the priced side is too close to certain")]
    NearCertain,
    #[msg("the stake would not be less than the payout")]
    Underpriced,
    #[msg("the payout exceeds the reserve's per-round cap")]
    OverPayoutCap,
    #[msg("the fresh stake is above the most the buyer agreed to pay")]
    StakeAboveMax,
    #[msg("the reserve cannot back that payout right now")]
    InsufficientLiquidity,
    #[msg("that would take the reserve past its exposure limit")]
    OverExposure,
    #[msg("too much of the reserve already settles at that boundary")]
    OverExpiryCap,
    #[msg("that expiry book belongs to a different boundary")]
    WrongExpiry,
    #[msg("the round is not live")]
    RoundNotLive,
    #[msg("the round has not been settled")]
    RoundNotSettled,
    #[msg("the round did not win")]
    RoundDidNotWin,
    #[msg("the round is not stale enough to void")]
    NotStale,
    #[msg("that Market belongs to a different engine")]
    WrongEngine,
    #[msg("that round belongs to a different Window")]
    WrongMarket,
    #[msg("that wallet does not hold that many shares")]
    InsufficientShares,
    #[msg("the amount is zero")]
    ZeroAmount,
    #[msg("the reserve has no equity to price shares against")]
    NoEquity,
    #[msg("arithmetic overflowed")]
    MathOverflow,
    #[msg("the venue has an answer for that Window, so the round must be settled rather than voided")]
    MustSettle,
}
