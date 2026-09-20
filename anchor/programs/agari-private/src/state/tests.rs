//! Targeted cases: each refusal in the order the chain checks it, and the identity the whole desk rests on.

use super::*;
use anchor_lang::prelude::Pubkey;
use crate::errors::PrivateError;

pub(super) const UNIT: u64 = 1_000_000;

pub(super) fn desk() -> Desk {
    Desk { params: PrivateParams { min_stake_base: UNIT, max_stake_base: 50 * UNIT, min_time_left_sec: 60 }, ..Desk::default() }
}

/// An owner with `balance` deposited and the desk allowed to spend `allowance` of it.
pub(super) fn funded(d: &mut Desk, balance: u64, allowance: u64) -> Budget {
    let mut budget = Budget::default();
    d.book_deposit(&mut budget, balance).unwrap();
    budget.allowance_base = allowance;
    budget
}

#[test]
fn the_three_transaction_open_moves_one_stake_from_a_balance_into_a_slot() {
    let mut d = desk();
    let mut budget = funded(&mut d, 20 * UNIT, 10 * UNIT);
    let (mut charge, mut slot) = (KeyMark::default(), Slot::default());

    d.book_charge(&mut budget, &mut charge, 4 * UNIT).unwrap();
    assert_eq!((budget.balance_base, budget.allowance_base, d.owed_base, d.pool_base), (16 * UNIT, 6 * UNIT, 16 * UNIT, 4 * UNIT));
    d.book_fund(&mut slot, 4 * UNIT, 100).unwrap();
    assert_eq!((d.pool_base, d.in_slots_base, slot.balance_base, slot.funded_at_sec), (0, 4 * UNIT, 4 * UNIT, 100));
    assert_eq!(d.mintable_stake(&slot), Ok(4 * UNIT));
    // The fill cost 3.9: that left custody for the venue, and the dust stays in the slot.
    d.book_mint(&mut slot, Pubkey::new_unique(), 0, 7_500, 1_000, 3_900_000, 900, 101).unwrap();
    assert_eq!((slot.balance_base, slot.cost_base, slot.lots, d.in_slots_base), (100_000, 3_900_000, 7_500, 100_000));
    // Custody now holds 20 − 3.9, and the desk owes exactly that.
    assert_eq!(d.total_owed_base(), u128::from(20 * UNIT - 3_900_000));
}

#[test]
fn a_win_comes_home_as_settle_sweep_credit_and_only_the_owner_can_take_it_out() {
    let mut d = desk();
    let mut budget = funded(&mut d, 10 * UNIT, 10 * UNIT);
    let (mut charge, mut credit, mut slot) = (KeyMark::default(), KeyMark::default(), Slot::default());
    d.book_charge(&mut budget, &mut charge, 4 * UNIT).unwrap();
    d.book_fund(&mut slot, 4 * UNIT, 100).unwrap();
    d.book_mint(&mut slot, Pubkey::new_unique(), 0, 7_500, 1_000, 3_900_000, 900, 101).unwrap();

    assert_eq!(d.book_sweep(&mut slot), Err(PrivateError::SlotHoldsContracts));
    d.book_settle(&mut slot, 7_500_000, 950).unwrap();
    assert_eq!(d.book_settle(&mut slot, 7_500_000, 951), Err(PrivateError::NothingToSettle));
    assert_eq!(d.book_sweep(&mut slot), Ok(7_600_000));
    assert_eq!(d.book_sweep(&mut slot), Err(PrivateError::SlotEmpty));
    d.book_credit(&mut budget, &mut credit, 7_600_000).unwrap();
    assert_eq!((budget.balance_base, d.pool_base, d.in_slots_base, d.owed_base), (13_600_000, 0, 0, 13_600_000));
    // The allowance was spent on the way out and is not restored by a win: the next bet needs the owner's say again.
    assert_eq!(budget.allowance_base, 6 * UNIT);
    d.book_withdraw(&mut budget, 13_600_000).unwrap();
    assert_eq!(d.total_owed_base(), 0);
}

#[test]
fn a_charge_is_refused_in_the_chains_order() {
    let mut d = desk();
    let mut budget = funded(&mut d, 5 * UNIT, 3 * UNIT);
    let mut mark = KeyMark::default();
    d.paused = true;
    assert_eq!(d.book_charge(&mut budget, &mut mark, 2 * UNIT), Err(PrivateError::Paused));
    d.paused = false;
    assert_eq!(d.book_charge(&mut budget, &mut mark, 0), Err(PrivateError::ZeroAmount));
    assert_eq!(d.book_charge(&mut budget, &mut mark, UNIT - 1), Err(PrivateError::StakeOutsideBand));
    assert_eq!(d.book_charge(&mut budget, &mut mark, 51 * UNIT), Err(PrivateError::StakeOutsideBand));
    assert_eq!(d.book_charge(&mut budget, &mut mark, 6 * UNIT), Err(PrivateError::Insufficient));
    assert_eq!(d.book_charge(&mut budget, &mut mark, 4 * UNIT), Err(PrivateError::OverAllowance));
    d.book_charge(&mut budget, &mut mark, 2 * UNIT).unwrap();
    // The same key again, for any amount: refused, and nothing moves.
    let before = (budget.balance_base, budget.allowance_base, d.pool_base);
    assert_eq!(d.book_charge(&mut budget, &mut mark, UNIT), Err(PrivateError::KeyUsed));
    assert_eq!((budget.balance_base, budget.allowance_base, d.pool_base), before);
}

#[test]
fn the_desk_can_never_take_more_than_the_allowance_and_a_revoke_stops_it_cold() {
    let mut d = desk();
    let mut budget = funded(&mut d, 40 * UNIT, 5 * UNIT);
    d.book_charge(&mut budget, &mut KeyMark::default(), 5 * UNIT).unwrap();
    assert_eq!(d.book_charge(&mut budget, &mut KeyMark::default(), UNIT), Err(PrivateError::OverAllowance));
    budget.allowance_base = 0;
    assert_eq!(d.book_charge(&mut budget, &mut KeyMark::default(), UNIT), Err(PrivateError::OverAllowance));
    // The owner's way out needs nothing from the desk, paused or not.
    d.paused = true;
    d.book_withdraw(&mut budget, 35 * UNIT).unwrap();
    assert_eq!(d.book_withdraw(&mut budget, 1), Err(PrivateError::Insufficient));
}

#[test]
fn a_credit_is_bounded_by_the_pool_and_paid_once_per_key() {
    let mut d = desk();
    let mut budget = funded(&mut d, 10 * UNIT, 10 * UNIT);
    let (mut slot, mut credit) = (Slot::default(), KeyMark::default());
    d.book_charge(&mut budget, &mut KeyMark::default(), 4 * UNIT).unwrap();
    assert_eq!(d.book_credit(&mut budget, &mut credit, 5 * UNIT), Err(PrivateError::PoolShort));
    // A refused mint: the stake goes fund → sweep → credit, whole.
    d.book_fund(&mut slot, 4 * UNIT, 100).unwrap();
    assert_eq!(d.book_fund(&mut slot, UNIT, 101), Err(PrivateError::SlotAlreadyFunded));
    assert_eq!(d.book_sweep(&mut slot), Ok(4 * UNIT));
    // It is paid while paused: money on its way home is never held up.
    d.paused = true;
    d.book_credit(&mut budget, &mut credit, 4 * UNIT).unwrap();
    assert_eq!(d.book_credit(&mut budget, &mut credit, 1), Err(PrivateError::KeyUsed));
    assert_eq!((budget.balance_base, d.pool_base, d.owed_base), (10 * UNIT, 0, 10 * UNIT));
}

#[test]
fn a_mint_needs_a_funded_unminted_slot_and_never_costs_more_than_the_stake() {
    let mut d = desk();
    let mut budget = funded(&mut d, 10 * UNIT, 10 * UNIT);
    let mut slot = Slot::default();
    assert_eq!(d.mintable_stake(&slot), Err(PrivateError::SlotNotFunded));
    d.book_charge(&mut budget, &mut KeyMark::default(), 4 * UNIT).unwrap();
    d.book_fund(&mut slot, 4 * UNIT, 100).unwrap();
    d.paused = true;
    assert_eq!(d.mintable_stake(&slot), Err(PrivateError::Paused));
    d.paused = false;
    assert_eq!(d.book_mint(&mut slot, Pubkey::new_unique(), 1, 8_000, 1_000, 4 * UNIT + 1, 900, 101), Err(PrivateError::StakeAboveMax));
    d.book_mint(&mut slot, Pubkey::new_unique(), 1, 8_000, 1_000, 4 * UNIT, 900, 101).unwrap();
    assert_eq!(d.mintable_stake(&slot), Err(PrivateError::SlotAlreadyMinted));
}

#[test]
fn the_band_has_to_make_sense() {
    assert_eq!(PrivateParams { min_stake_base: 0, max_stake_base: 5, min_time_left_sec: 0 }.validate(), Err(PrivateError::BadParams));
    assert_eq!(PrivateParams { min_stake_base: 6, max_stake_base: 5, min_time_left_sec: 0 }.validate(), Err(PrivateError::BadParams));
    assert!(PrivateParams { min_stake_base: 5, max_stake_base: 5, min_time_left_sec: 0 }.validate().is_ok());
}
