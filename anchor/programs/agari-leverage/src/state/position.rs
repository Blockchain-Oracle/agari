use anchor_lang::prelude::*;

/// Live while the reserve holds the contracts; Closed by the owner's own cash-out; KnockedOut when the mark fell to
/// the maintenance line and anyone sold it; Settled on the venue's resolution. In the client's enum order.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum PositionStatus {
    Live,
    Closed,
    KnockedOut,
    Settled,
}

/// PDA `["position", position_id u64 LE]`.
#[account]
#[derive(InitSpace)]
pub struct Position {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub position_id: u64,
    pub status: PositionStatus,
    /// 0 Up (YES), 1 Down (NO).
    pub outcome: u8,
    pub leverage_bps: u32,
    pub opened_at_sec: i64,
    pub expiry_sec: i64,
    pub exited_at_sec: i64,
    /// Contracts the reserve still holds for this position, in the venue's lots.
    pub lots: u64,
    /// Base units one lot pays when its side lands, so a reader need not fetch the Series to size the position.
    pub lot_base: u64,
    /// What the owner put in, premium included: the most they can lose.
    pub stake_base: u64,
    /// The reserve's outstanding claim, repaid first out of whatever the contracts fetch.
    pub fronted_base: u64,
    pub premium_base: u64,
    /// Collateral per whole contract paid at open, in the bought side's own terms.
    pub entry_price_raw: u64,
    /// Cumulative: what the contracts fetched, what the reserve took back, what the owner was due.
    pub proceeds_base: u64,
    pub reclaimed_base: u64,
    pub returned_base: u64,
    /// The part of `returned_base` not yet paid out. An exit never waits on the owner's token account: when a
    /// permissionless exit is not handed one, the money waits here for `public_claim`.
    pub owed_base: u64,
    pub bump: u8,
}

impl Position {
    /// What the position pays if its side lands: a contract pays one unit.
    pub fn quantity_raw(&self) -> u128 {
        u128::from(self.lots) * u128::from(self.lot_base)
    }
}
