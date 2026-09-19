use anchor_lang::prelude::*;

/// A round's life. `Won` and `Lost` are the settled states; a claim is only ever made against `Won`.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum RoundStatus {
    Live,
    Won,
    Lost,
    Void,
    Claimed,
}

/// One band bet against the reserve.
///
/// Everything the settlement needs is frozen here at open — the band, the payout, the Window — so a round is
/// judged against the basis it was priced on and never against a later one.
#[account]
#[derive(InitSpace)]
pub struct Round {
    pub reserve: Pubkey,
    pub owner: Pubkey,
    /// The agari-events Market whose closing print decides this round.
    pub market: Pubkey,
    pub round_id: u64,
    pub status: RoundStatus,
    /// True when the owner bet the close lands inside `[low_print, high_print]`.
    pub is_inside: bool,
    /// Prints in the oracle's own scale.
    pub opening_print: i64,
    pub low_print: i64,
    pub high_print: i64,
    pub closing_print: i64,
    pub stake_base: u64,
    pub max_payout_base: u64,
    /// `max_payout − stake`: the reserve's part of the escrow, released back to it when the round loses.
    pub house_locked_base: u64,
    /// The fair win probability the reserve priced this round at, per whole unit of collateral.
    pub prob_raw: u64,
    pub opened_at_sec: i64,
    pub settled_at_sec: i64,
    /// The Window's own close boundary, so a stale round can be voided without reading the Market again.
    pub expiry_sec: i64,
    pub bump: u8,
}

impl Round {
    /// Whether the closing print landed in the band, and so whether the `inside` side won.
    pub fn inside_won(&self, closing_print: i64) -> bool {
        closing_print >= self.low_print && closing_print <= self.high_print
    }
}
