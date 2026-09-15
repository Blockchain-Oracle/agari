//! Position slot booking (vault.md §3.4 booking, §3.5 step 6). Slots are written only after the engine returns.

use anchor_lang::prelude::*;

use crate::constants::ATTENDED;
use crate::errors::VaultError;
use crate::state::{PositionSlot, VaultAccount};

/// The slot a buy on `market` books into: the market's own slot, else the first free one.
pub fn buy_slot(account: &VaultAccount, market: &Pubkey) -> Result<usize> {
    account.slot_of(market).or_else(|| account.positions.iter().position(PositionSlot::is_free)).ok_or_else(|| error!(VaultError::PositionSlotsFull))
}

/// Lots of `outcome` the owner holds on `market` (0 without a slot).
pub fn held(account: &VaultAccount, market: &Pubkey, outcome: u8) -> u64 {
    account.slot_of(market).and_then(|i| account.positions.get(i)).map_or(0, |s| s.side(outcome).0)
}

/// Books a buy's `gained` lots into `slot`, claiming it for `market` on first use. A side opens when it held
/// nothing and carries no attribution; on a grant route it is then attributed and `true` is returned, so the
/// caller counts it against the grant's position cap.
pub fn book_buy(account: &mut VaultAccount, slot: usize, market: &Pubkey, outcome: u8, gained: u64, grant_id: u64) -> Result<bool> {
    let claim = account.positions.get(slot).ok_or(VaultError::PositionSlotsFull)?.is_free();
    if claim {
        account.slots_used = account.slots_used.checked_add(1).ok_or(VaultError::MathOverflow)?;
    }
    let s = account.positions.get_mut(slot).ok_or(VaultError::PositionSlotsFull)?;
    if claim {
        s.market = *market;
    }
    let (lots, attribution) = s.side_mut(outcome);
    let before = *lots;
    *lots = before.checked_add(gained).ok_or(VaultError::MathOverflow)?;
    let opened = gained > 0 && before == 0 && *attribution == ATTENDED && grant_id != ATTENDED;
    if opened {
        *attribution = grant_id;
    }
    Ok(opened)
}

/// Books a sale: the slot gives up `sold` lots and the owner's `available` takes the proceeds, whoever placed it.
/// The side keeps its attribution until the crank.
pub fn book_sell(account: &mut VaultAccount, slot: usize, outcome: u8, sold: u64, received: u64) -> Result<()> {
    let s = account.positions.get_mut(slot).ok_or(VaultError::Insufficient)?;
    let (lots, _) = s.side_mut(outcome);
    *lots = lots.checked_sub(sold).ok_or(VaultError::EngineAccountingMismatch)?;
    account.available = account.available.checked_add(received).ok_or(VaultError::MathOverflow)?;
    Ok(())
}

/// Settlement: the payout lands on `available` and the slot is freed.
pub fn settle_slot(account: &mut VaultAccount, slot: usize, payout: u64) -> Result<()> {
    account.available = account.available.checked_add(payout).ok_or(VaultError::MathOverflow)?;
    *account.positions.get_mut(slot).ok_or(VaultError::NothingToSettle)? = PositionSlot::default();
    account.slots_used = account.slots_used.checked_sub(1).ok_or(VaultError::MathOverflow)?;
    Ok(())
}
