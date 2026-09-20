use anchor_lang::prelude::*;

#[error_code]
#[derive(PartialEq, Eq)]
pub enum ArenaError {
    #[msg("the arena is paused")]
    Paused,
    #[msg("the parameters do not describe a playable match")]
    BadParams,
    #[msg("only the arena's admin can do that")]
    NotAdmin,
    #[msg("those accounts are not one Window of the venue")]
    UnknownMarket,
    #[msg("the venue's collateral is not the arena's")]
    WrongCollateral,
    #[msg("the outcome is 0 (Up) or 1 (Down)")]
    BadOutcome,
    #[msg("the arena's seat is not registered with the venue")]
    ArenaNotRegistered,
    #[msg("this Window opened before the arena was seated")]
    WindowPredatesArena,
    #[msg("the Window is not trading")]
    WindowNotTrading,
    #[msg("the venue has not settled that Window")]
    MarketNotSettled,
    #[msg("that Window ends too soon to be a card")]
    TooLate,
    #[msg("the amount is zero")]
    ZeroAmount,
    #[msg("the book fills fewer contracts than the player's guard")]
    BelowMinQuantity,
    #[msg("the fill cost more than the stake")]
    CostAboveStake,
    #[msg("the stake is above the tier's cap for one card")]
    StakeAboveCap,
    #[msg("nothing filled")]
    NothingFilled,
    #[msg("a match with that id exists")]
    MatchExists,
    #[msg("the match is not in a status that allows that")]
    WrongStatus,
    #[msg("that tier is not enabled")]
    UnknownTier,
    #[msg("the deck size is outside the arena's limits")]
    BadDeckSize,
    #[msg("the same Window twice is not a deck")]
    DuplicateCard,
    #[msg("the revealed deck is not the one that was committed to")]
    DeckMismatch,
    #[msg("that wallet holds no seat in this match")]
    NotAPlayer,
    #[msg("a player cannot be their own opponent")]
    SelfJoin,
    #[msg("the deadline has passed")]
    DeadlinePassed,
    #[msg("the deadline has not passed yet")]
    DeadlineNotPassed,
    #[msg("there is no such card in this deck")]
    BadCard,
    #[msg("that seat has already played this card")]
    AlreadyPicked,
    #[msg("that card is already settled")]
    AlreadySettled,
    #[msg("a played card is still unsettled")]
    CardsOutstanding,
    #[msg("that player has no credit to claim")]
    NoCredit,
    #[msg("the signer is not that seat's key")]
    NotAgent,
    #[msg("the seat's key has expired")]
    AgentExpired,
    #[msg("the seat's key has spent the deck's ceiling")]
    AgentOverBudget,
    #[msg("a key's lifetime is between one second and one day")]
    BadTtl,
    #[msg("the key's escrow is still in play")]
    AgentStillLive,
    #[msg("the season pool has already been distributed")]
    AlreadyDistributed,
    #[msg("winners and amounts differ in number, or there are none")]
    BadWinners,
    #[msg("the season pool holds less than that")]
    InsufficientPool,
    #[msg("the engine returned no result")]
    EngineResultMissing,
    #[msg("the engine's report does not match the money that moved")]
    EngineAccountingMismatch,
    #[msg("arithmetic overflowed")]
    MathOverflow,
}
