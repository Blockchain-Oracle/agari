use anchor_lang::prelude::*;

/// An owner's money behind private bets: theirs alone to withdraw, the desk's to spend inside the allowance.
#[account]
#[derive(InitSpace, Default)]
pub struct Budget {
    pub owner: Pubkey,
    pub balance_base: u64,
    /// What the desk may still spend of the balance. Zero refuses every private bet.
    pub allowance_base: u64,
    pub bump: u8,
}

/// One use of one key. A charge key and a credit key each get one, so a desk that resumes after a crash can see
/// what already landed without keeping a record, and two desk processes racing on one claim cannot pay it twice.
#[account]
#[derive(InitSpace, Default)]
pub struct KeyMark {
    pub amount_base: u64,
    pub bump: u8,
}

/// One bet's throwaway account: funded from the pool, minted on the venue, settled, swept back. It carries a market
/// and never an owner. The proof of whose it is lives off chain, in the claim the desk signs and the owner keeps.
#[account]
#[derive(InitSpace, Default)]
pub struct Slot {
    pub slot_id: [u8; 32],
    pub market: Pubkey,
    /// 0 Up (YES), 1 Down (NO).
    pub outcome: u8,
    pub funded_at_sec: i64,
    pub minted_at_sec: i64,
    pub settled_at_sec: i64,
    pub expiry_sec: i64,
    /// Contracts the desk's seat holds for this slot, in the venue's lots; zero once redeemed.
    pub lots: u64,
    /// Base units one lot pays when its side lands, so a reader need not fetch the Series to size the slot.
    pub lot_base: u64,
    /// Cash in the slot: the stake before the mint, the dust after it, the payout after settlement.
    pub balance_base: u64,
    pub cost_base: u64,
    pub payout_base: u64,
    /// Cumulative: what left the slot for the pool.
    pub swept_base: u64,
    pub bump: u8,
}
