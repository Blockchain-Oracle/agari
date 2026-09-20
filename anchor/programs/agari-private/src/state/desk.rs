use anchor_lang::prelude::*;

use crate::errors::PrivateError;
use crate::state::{Budget, KeyMark, Slot};

type Booked<T = ()> = std::result::Result<T, PrivateError>;

#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct PrivateParams {
    /// Stake band per slot, in collateral base units.
    pub min_stake_base: u64,
    pub max_stake_base: u64,
    /// No mints inside the last seconds of a Window: the three-transaction open needs room to land.
    pub min_time_left_sec: u32,
}

impl PrivateParams {
    pub fn validate(&self) -> Booked {
        if self.min_stake_base == 0 || self.min_stake_base > self.max_stake_base {
            return Err(PrivateError::BadParams);
        }
        Ok(())
    }
}

#[account]
#[derive(InitSpace, Default)]
pub struct Desk {
    pub admin: Pubkey,
    /// The one key that may charge, fund, mint, sweep and credit. It can never withdraw: only an owner can.
    pub desk: Pubkey,
    pub collateral_mint: Pubkey,
    pub params: PrivateParams,
    /// Money nobody has claimed yet: charged and not yet in a slot, or swept and not yet credited.
    pub pool_base: u64,
    /// The sum of every owner's balance.
    pub owed_base: u64,
    /// The sum of every slot's cash.
    pub in_slots_base: u64,
    pub paused: bool,
    pub bump: u8,
    pub seat_bump: u8,
    pub custody_bump: u8,
}

fn add(a: u64, b: u64) -> Booked<u64> {
    a.checked_add(b).ok_or(PrivateError::MathOverflow)
}

impl Desk {
    /// What the desk owes everyone. Custody holds exactly this after every instruction.
    pub fn total_owed_base(&self) -> u128 {
        u128::from(self.owed_base) + u128::from(self.pool_base) + u128::from(self.in_slots_base)
    }

    // ------------------------------------------------------------------ the owner

    pub fn book_deposit(&mut self, budget: &mut Budget, amount_base: u64) -> Booked {
        if amount_base == 0 {
            return Err(PrivateError::ZeroAmount);
        }
        budget.balance_base = add(budget.balance_base, amount_base)?;
        self.owed_base = add(self.owed_base, amount_base)?;
        Ok(())
    }

    /// Pays the owner and nobody else, and needs nothing from the desk: not its key, not its allowance, not its pause.
    pub fn book_withdraw(&mut self, budget: &mut Budget, amount_base: u64) -> Booked {
        if amount_base == 0 {
            return Err(PrivateError::ZeroAmount);
        }
        if budget.balance_base < amount_base {
            return Err(PrivateError::Insufficient);
        }
        budget.balance_base -= amount_base;
        self.owed_base = self.owed_base.saturating_sub(amount_base);
        Ok(())
    }

    // ------------------------------------------------------------------ the desk: opening

    /// OWNER SIDE. Debits the bettor into the pool's float, inside their allowance and the desk's band.
    pub fn book_charge(&mut self, budget: &mut Budget, mark: &mut KeyMark, amount_base: u64) -> Booked {
        if self.paused {
            return Err(PrivateError::Paused);
        }
        if amount_base == 0 {
            return Err(PrivateError::ZeroAmount);
        }
        // The band is checked here too, so a stake the mint would refuse never costs the desk three sends.
        if amount_base < self.params.min_stake_base || amount_base > self.params.max_stake_base {
            return Err(PrivateError::StakeOutsideBand);
        }
        if mark.amount_base != 0 {
            return Err(PrivateError::KeyUsed);
        }
        if budget.balance_base < amount_base {
            return Err(PrivateError::Insufficient);
        }
        if budget.allowance_base < amount_base {
            return Err(PrivateError::OverAllowance);
        }
        let pool = add(self.pool_base, amount_base)?;
        budget.balance_base -= amount_base;
        budget.allowance_base -= amount_base;
        self.owed_base = self.owed_base.saturating_sub(amount_base);
        self.pool_base = pool;
        mark.amount_base = amount_base;
        Ok(())
    }

    /// SLOT SIDE. Float into this bet's slot.
    pub fn book_fund(&mut self, slot: &mut Slot, amount_base: u64, now: i64) -> Booked {
        if amount_base == 0 {
            return Err(PrivateError::ZeroAmount);
        }
        if slot.funded_at_sec != 0 {
            return Err(PrivateError::SlotAlreadyFunded);
        }
        if self.pool_base < amount_base {
            return Err(PrivateError::PoolShort);
        }
        let in_slots = add(self.in_slots_base, amount_base)?;
        self.pool_base -= amount_base;
        self.in_slots_base = in_slots;
        slot.balance_base = amount_base;
        slot.funded_at_sec = now;
        Ok(())
    }

    /// What a mint may spend: the slot's whole stake, once, while the desk is open for business.
    pub fn mintable_stake(&self, slot: &Slot) -> Booked<u64> {
        if self.paused {
            return Err(PrivateError::Paused);
        }
        if slot.funded_at_sec == 0 {
            return Err(PrivateError::SlotNotFunded);
        }
        if slot.minted_at_sec != 0 {
            return Err(PrivateError::SlotAlreadyMinted);
        }
        Ok(slot.balance_base)
    }

    /// SLOT SIDE. The fill left custody for the venue: it cost `cost_base` of the slot's stake, never more, and the
    /// dust stays in the slot.
    #[allow(clippy::too_many_arguments)]
    pub fn book_mint(&mut self, slot: &mut Slot, market: Pubkey, outcome: u8, lots: u64, lot_base: u64, cost_base: u64, expiry_sec: i64, now: i64) -> Booked {
        if cost_base > slot.balance_base {
            return Err(PrivateError::StakeAboveMax);
        }
        slot.balance_base -= cost_base;
        self.in_slots_base = self.in_slots_base.saturating_sub(cost_base);
        slot.market = market;
        slot.outcome = outcome;
        slot.lots = lots;
        slot.lot_base = lot_base;
        slot.cost_base = cost_base;
        slot.expiry_sec = expiry_sec;
        slot.minted_at_sec = now;
        Ok(())
    }

    // ------------------------------------------------------------------ settlement and the way home

    /// The venue paid `payout_base` into custody for this slot's contracts. It stays in the slot whoever cranked it.
    pub fn book_settle(&mut self, slot: &mut Slot, payout_base: u64, now: i64) -> Booked {
        if slot.lots == 0 {
            return Err(PrivateError::NothingToSettle);
        }
        let balance = add(slot.balance_base, payout_base)?;
        let in_slots = add(self.in_slots_base, payout_base)?;
        slot.lots = 0;
        slot.payout_base = payout_base;
        slot.balance_base = balance;
        self.in_slots_base = in_slots;
        slot.settled_at_sec = now;
        Ok(())
    }

    /// SLOT SIDE. Whatever cash a slot holds (an unminted stake, the dust, a payout) back into the pool.
    pub fn book_sweep(&mut self, slot: &mut Slot) -> Booked<u64> {
        if slot.lots != 0 {
            return Err(PrivateError::SlotHoldsContracts);
        }
        let amount_base = slot.balance_base;
        if amount_base == 0 {
            return Err(PrivateError::SlotEmpty);
        }
        let pool = add(self.pool_base, amount_base)?;
        slot.balance_base = 0;
        slot.swept_base = slot.swept_base.saturating_add(amount_base);
        self.in_slots_base = self.in_slots_base.saturating_sub(amount_base);
        self.pool_base = pool;
        Ok(amount_base)
    }

    /// OWNER SIDE. Pool float into an owner's balance. Bounded by what the pool actually holds, one credit per key.
    /// It is not gated by the pause: money on its way home is never held up.
    pub fn book_credit(&mut self, budget: &mut Budget, mark: &mut KeyMark, amount_base: u64) -> Booked {
        if amount_base == 0 {
            return Err(PrivateError::ZeroAmount);
        }
        if mark.amount_base != 0 {
            return Err(PrivateError::KeyUsed);
        }
        if self.pool_base < amount_base {
            return Err(PrivateError::PoolShort);
        }
        let balance = add(budget.balance_base, amount_base)?;
        let owed = add(self.owed_base, amount_base)?;
        self.pool_base -= amount_base;
        self.owed_base = owed;
        budget.balance_base = balance;
        mark.amount_base = amount_base;
        Ok(())
    }
}
