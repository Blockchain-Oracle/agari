use anchor_lang::prelude::*;

#[error_code]
#[derive(PartialEq, Eq)]
pub enum ParlayError {
    #[msg("the reserve is paused")]
    Paused,
    #[msg("those parameters are outside what the reserve accepts")]
    BadParams,
    #[msg("a ticket needs at least two legs and no more than the reserve's maximum")]
    BadLegCount,
    #[msg("each leg needs its Market, its Book and its Series, in that order")]
    BadLegAccounts,
    #[msg("the same Window cannot be two legs of one ticket")]
    DuplicateLeg,
    #[msg("that Window is not open for calls")]
    WindowNotTrading,
    #[msg("too little time is left in one of those Windows")]
    TooLate,
    #[msg("that Book does not belong to that Window")]
    WrongBook,
    #[msg("that Series does not belong to that Window")]
    WrongSeries,
    #[msg("that Series is priced on a different scale from the reserve's collateral")]
    WrongGrid,
    #[msg("the venue's book is too thin to price that leg")]
    ThinBook,
    #[msg("the two sides of that book are too far apart to price a leg")]
    WideSpread,
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
    #[msg("the reserve has capital riding on too many boundaries at once")]
    TooManyExpiries,
    #[msg("the ticket is not live")]
    TicketNotLive,
    #[msg("that leg is not part of this ticket")]
    WrongLeg,
    #[msg("an earlier leg of this ticket has to be decided first")]
    LegOutOfOrder,
    #[msg("that Window has not settled yet")]
    LegNotSettled,
    #[msg("the ticket has not been settled")]
    TicketNotSettled,
    #[msg("there is nothing to claim on that ticket")]
    NothingToClaim,
    #[msg("the ticket is not stale enough to void")]
    NotStale,
    #[msg("the venue has an answer for that leg, so it must be resolved rather than voided")]
    MustResolve,
    #[msg("that ticket belongs to a different reserve")]
    WrongReserve,
    #[msg("only the reserve's admin may do that")]
    NotAdmin,
    #[msg("that wallet does not hold that many shares")]
    InsufficientShares,
    #[msg("the amount is zero")]
    ZeroAmount,
    #[msg("the reserve has no equity to price shares against")]
    NoEquity,
    #[msg("arithmetic overflowed")]
    MathOverflow,
}
