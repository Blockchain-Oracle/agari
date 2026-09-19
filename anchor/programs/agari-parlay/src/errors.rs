use anchor_lang::prelude::*;

#[error_code]
pub enum ParlayError {
    #[msg("the reserve is paused")]
    Paused,
    #[msg("a ticket needs at least the minimum number of legs and no more than the maximum")]
    BadLegCount,
    #[msg("the same Window cannot be two legs of one ticket")]
    DuplicateLeg,
    #[msg("that Window is not open for calls")]
    WindowNotTrading,
    #[msg("that Window has no opening print yet")]
    NoOpeningPrint,
    #[msg("that Window has no closing print yet")]
    NoClosingPrint,
    #[msg("the venue's book is too thin to price that leg")]
    ThinBook,
    #[msg("too little time is left in one of those Windows")]
    TooLate,
    #[msg("the combination is too much of a long shot")]
    LongShot,
    #[msg("the stake would not be less than the payout")]
    Underpriced,
    #[msg("the payout exceeds the reserve's per-ticket cap")]
    OverPayoutCap,
    #[msg("the fresh stake is above the most the buyer agreed to pay")]
    StakeAboveMax,
    #[msg("the reserve cannot back that payout right now")]
    InsufficientLiquidity,
    #[msg("that would take the reserve past its exposure limit")]
    OverExposure,
    #[msg("too much of the reserve already settles at that boundary")]
    OverExpiryCap,
    #[msg("the ticket is not live")]
    TicketNotLive,
    #[msg("that leg has already been resolved")]
    LegAlreadyResolved,
    #[msg("that leg is not part of this ticket")]
    WrongLeg,
    #[msg("the ticket still has legs waiting on their Windows")]
    LegsPending,
    #[msg("the ticket has not been settled")]
    TicketNotSettled,
    #[msg("the ticket did not win")]
    TicketDidNotWin,
    #[msg("the ticket is not stale enough to void")]
    NotStale,
    #[msg("that Market belongs to a different engine")]
    WrongEngine,
    #[msg("that expiry book belongs to a different boundary")]
    WrongExpiry,
    #[msg("that wallet does not hold that many shares")]
    InsufficientShares,
    #[msg("the amount is zero")]
    ZeroAmount,
    #[msg("the reserve has no equity to price shares against")]
    NoEquity,
    #[msg("arithmetic overflowed")]
    MathOverflow,
}
