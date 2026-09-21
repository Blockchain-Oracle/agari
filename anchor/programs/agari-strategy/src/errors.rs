use anchor_lang::prelude::*;

#[error_code]
#[derive(PartialEq, Eq)]
pub enum StrategyError {
    #[msg("a strategy needs a runner")]
    ZeroRunner,
    #[msg("an envelope needs a stake ceiling, a daily ceiling and a position ceiling")]
    BadEnvelope,
    #[msg("the metadata is longer than a strategy can hold")]
    MetadataTooLong,
    #[msg("that write runs past the metadata the creator declared")]
    WriteOutOfBounds,
    #[msg("the strategy's metadata is sealed; publish a new revision to change it")]
    AlreadySealed,
    #[msg("the metadata written does not hash to what the creator declared")]
    MetadataMismatch,
    #[msg("only the strategy's creator may do that")]
    NotCreator,
    #[msg("the strategy is not taking subscribers")]
    StrategyInactive,
    #[msg("the strategy's metadata has not been sealed yet")]
    NotSealed,
    #[msg("that grant belongs to a different wallet")]
    NotGrantOwner,
    #[msg("only a strategy grant can back a subscription")]
    WrongGrantKind,
    #[msg("that grant names a different runner")]
    WrongActor,
    #[msg("that grant is revoked or has expired")]
    GrantNotLive,
    #[msg("that grant's ceilings are wider than the strategy's envelope")]
    CapsOutsideEnvelope,
    #[msg("the fee has risen above what the subscriber agreed to pay")]
    FeeAboveMax,
    #[msg("a fee is due, so the subscriber's and the creator's token accounts are needed")]
    FeeAccountsMissing,
    #[msg("that wallet is not subscribed to that strategy")]
    NotSubscribed,
    #[msg("that subscription belongs to a different strategy")]
    WrongStrategy,
    #[msg("arithmetic overflowed")]
    MathOverflow,
    #[msg("this wallet already follows this strategy; unsubscribe before fading it")]
    AlreadyFollowing,
    #[msg("this wallet already fades this strategy; stop fading before following it")]
    AlreadyFading,
    #[msg("this wallet does not fade this strategy")]
    NotFading,
}
