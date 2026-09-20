//! The reserve's rules one at a time: the caps, a partial sale, an exit under water, a settlement either way, the
//! withdrawal that waits, and money left owed. `random` drives the same methods in long sequences.

use super::*;
use crate::constants::MAX_OPEN;
use crate::errors::LeverageError;
use anchor_lang::prelude::Pubkey;

pub(super) const LOT_BASE: u64 = 1_000;

pub(super) fn params() -> LeverageParams {
    LeverageParams {
        max_leverage_bps: 30_000,
        premium_bps: 800,
        maintenance_bps: 11_000,
        max_exposure_bps: 6_000,
        max_open_positions: 24,
        min_time_left_sec: 60,
        min_entry_price_raw: 200_000,
        max_entry_price_raw: 800_000,
        max_fronted_per_position_base: 40_000_000,
        max_window_fronted_base: 90_000_000,
    }
}

pub(super) fn reserve() -> LeverageReserve {
    LeverageReserve {
        admin: Pubkey::default(),
        collateral_mint: Pubkey::default(),
        params: params(),
        outstanding_base: 0,
        user_owed_base: 0,
        supply_shares: 0,
        next_position_id: 1,
        paused: false,
        bump: 0,
        seat_bump: 0,
        custody_bump: 0,
        open: [OpenSlot::default(); MAX_OPEN],
    }
}

pub(super) fn window(n: u8) -> WindowBook {
    WindowBook { market: Pubkey::new_from_array([n; 32]), fronted_base: 0, positions_open: 0, bump: 0 }
}

pub(super) fn position(id: u64, market: Pubkey, lots: u64, stake: u64, fronted: u64, premium: u64, expiry: i64) -> Position {
    Position {
        owner: Pubkey::default(),
        market,
        position_id: id,
        status: PositionStatus::Live,
        outcome: 0,
        leverage_bps: 20_000,
        opened_at_sec: 0,
        expiry_sec: expiry,
        exited_at_sec: 0,
        lots,
        lot_base: LOT_BASE,
        stake_base: stake,
        fronted_base: fronted,
        premium_base: premium,
        entry_price_raw: 0,
        proceeds_base: 0,
        reclaimed_base: 0,
        returned_base: 0,
        owed_base: 0,
        bump: 0,
    }
}

#[test]
fn params_outside_the_reserves_bounds_are_refused() {
    assert_eq!(params().validate(), Ok(()));
    for bad in [
        LeverageParams { max_leverage_bps: 10_000, ..params() },
        LeverageParams { premium_bps: 10_000, ..params() },
        // A maintenance line under the claim itself would let a position sink below what the reserve is owed.
        LeverageParams { maintenance_bps: 9_999, ..params() },
        LeverageParams { max_exposure_bps: 10_001, ..params() },
        LeverageParams { max_open_positions: 0, ..params() },
        LeverageParams { max_open_positions: MAX_OPEN as u16 + 1, ..params() },
        LeverageParams { min_entry_price_raw: 0, ..params() },
        LeverageParams { min_entry_price_raw: 800_000, ..params() },
        LeverageParams { max_fronted_per_position_base: 0, ..params() },
        LeverageParams { max_window_fronted_base: 0, ..params() },
    ] {
        assert_eq!(bad.validate(), Err(LeverageError::BadParams));
    }
}

#[test]
fn the_front_comes_out_of_liquid_and_the_premium_may_pay_toward_it() {
    let (mut r, mut w) = (reserve(), window(1));
    assert_eq!(r.book_front(9_199_999, 10_000_000, 800_000, &mut w, 1, 300), Err(LeverageError::InsufficientLiquidity));
    // A refusal is a revert on chain; the pure method is only atomic up to its first cap, so start clean.
    let (mut r, mut w) = (reserve(), window(1));
    r.book_front(100_000_000, 10_000_000, 800_000, &mut w, 1, 300).unwrap();
    assert_eq!((r.outstanding_base, w.fronted_base, w.positions_open, r.open_count()), (10_000_000, 10_000_000, 1, 1));
}

#[test]
fn the_three_caps_are_checked_after_the_front_is_booked() {
    let liquid = 1_000_000_000;
    let (mut r, mut w) = (reserve(), window(1));
    assert_eq!(r.book_front(liquid, 40_000_001, 0, &mut w, 1, 300), Err(LeverageError::OverPositionCap));

    let (mut r, mut w) = (reserve(), window(1));
    r.book_front(liquid, 40_000_000, 0, &mut w, 1, 300).unwrap();
    r.book_front(liquid, 40_000_000, 0, &mut w, 2, 300).unwrap();
    assert_eq!(r.book_front(liquid, 10_000_001, 0, &mut w, 3, 300), Err(LeverageError::OverWindowCap));

    // 60% of total value may be out. With 100 liquid, fronting 38 then 23 would be 61 of 100.
    let (mut r, mut a, mut b) = (reserve(), window(1), window(2));
    r.book_front(100_000_000, 38_000_000, 0, &mut a, 1, 300).unwrap();
    assert_eq!(r.book_front(62_000_000, 23_000_000, 0, &mut b, 2, 300), Err(LeverageError::OverExposure));
}

#[test]
fn the_reserve_stops_at_its_limit_of_open_positions() {
    let mut r = reserve();
    r.params.max_open_positions = 2;
    let mut w = window(1);
    r.book_front(1_000_000_000, 1_000, 0, &mut w, 1, 300).unwrap();
    r.book_front(1_000_000_000, 1_000, 0, &mut w, 2, 300).unwrap();
    assert_eq!(r.book_front(1_000_000_000, 1_000, 0, &mut w, 3, 300), Err(LeverageError::TooManyOpen));
}

#[test]
fn a_partial_sale_leaves_the_position_live_with_a_smaller_claim() {
    let (mut r, mut w) = (reserve(), window(1));
    r.book_front(100_000_000, 10_000_000, 800_000, &mut w, 1, 300).unwrap();
    let mut p = position(1, w.market, 32_000, 10_000_000, 10_000_000, 800_000, 300);

    let half = r.book_exit(&mut p, &mut w, PositionStatus::Closed, 16_000, 9_000_000, 100);
    assert_eq!(half, ExitSplit { reclaimed_base: 9_000_000, returned_base: 0, finished: false });
    assert_eq!((p.status, p.lots, p.fronted_base), (PositionStatus::Live, 16_000, 1_000_000));
    assert_eq!((r.outstanding_base, w.fronted_base, r.open_count()), (1_000_000, 1_000_000, 1));

    let rest = r.book_exit(&mut p, &mut w, PositionStatus::Closed, 16_000, 9_000_000, 120);
    assert_eq!(rest, ExitSplit { reclaimed_base: 1_000_000, returned_base: 8_000_000, finished: true });
    assert_eq!((p.status, p.exited_at_sec, p.proceeds_base, p.reclaimed_base, p.returned_base), (PositionStatus::Closed, 120, 18_000_000, 10_000_000, 8_000_000));
    assert_eq!((r.outstanding_base, w.fronted_base, w.positions_open, r.open_count()), (0, 0, 0, 0));
}

/// The owner's loss is never more than the stake; the reserve's is the part of its claim the contracts did not fetch.
#[test]
fn an_exit_under_water_is_the_reserves_loss_and_frees_its_books_anyway() {
    let (mut r, mut w) = (reserve(), window(1));
    r.book_front(100_000_000, 10_000_000, 800_000, &mut w, 1, 300).unwrap();
    let mut p = position(1, w.market, 32_000, 10_000_000, 10_000_000, 800_000, 300);
    let exit = r.book_exit(&mut p, &mut w, PositionStatus::KnockedOut, 32_000, 7_000_000, 100);
    assert_eq!(exit, ExitSplit { reclaimed_base: 7_000_000, returned_base: 0, finished: true });
    // The 3,000,000 that did not come back is released too, or it would sit in `outstanding` as value forever.
    assert_eq!((r.outstanding_base, w.fronted_base, p.fronted_base), (0, 0, 0));
    // Custody went 100 − 10 + 0.8 + 7: the reserve is down 2.2 and says so.
    assert_eq!(r.total_value_base(97_800_000), 97_800_000);
}

#[test]
fn a_losing_settlement_pays_nothing_and_a_winning_one_pays_the_owner_the_rest() {
    let (mut r, mut w) = (reserve(), window(1));
    r.book_front(100_000_000, 10_000_000, 800_000, &mut w, 1, 300).unwrap();
    let mut lost = position(1, w.market, 32_000, 10_000_000, 10_000_000, 800_000, 300);
    assert_eq!(r.book_exit(&mut lost, &mut w, PositionStatus::Settled, 32_000, 0, 400), ExitSplit { reclaimed_base: 0, returned_base: 0, finished: true });

    r.book_front(100_000_000, 10_000_000, 800_000, &mut w, 2, 300).unwrap();
    let mut won = position(2, w.market, 32_000, 10_000_000, 10_000_000, 800_000, 300);
    // 32,000 lots pay 32,000,000: the reserve's 10 first, 22 to the owner. `winIfRight`, to the unit.
    assert_eq!(r.book_exit(&mut won, &mut w, PositionStatus::Settled, 32_000, 32_000_000, 400), ExitSplit { reclaimed_base: 10_000_000, returned_base: 22_000_000, finished: true });
}

#[test]
fn a_withdrawal_waits_for_an_expired_position_to_be_settled() {
    let (mut r, mut w) = (reserve(), window(1));
    r.supply_shares = 100_000_000;
    r.book_front(100_000_000, 10_000_000, 800_000, &mut w, 1, 300).unwrap();
    assert_eq!(r.amount_for(90_800_000, 1_000_000, 299), Ok(1_008_000));
    assert_eq!(r.unsettled_expired(300), Some(1));
    assert_eq!(r.amount_for(90_800_000, 1_000_000, 300), Err(LeverageError::UnsettledPosition));
    let mut p = position(1, w.market, 32_000, 10_000_000, 10_000_000, 800_000, 300);
    r.book_exit(&mut p, &mut w, PositionStatus::Settled, 32_000, 0, 400);
    // The loss is on the books now, and the share price says so: 90.8 of value over 100 shares.
    assert_eq!(r.amount_for(90_800_000, 1_000_000, 400), Ok(908_000));
}

#[test]
fn money_left_owed_is_not_the_providers() {
    let mut r = reserve();
    let mut p = position(1, Pubkey::default(), 0, 0, 0, 0, 0);
    r.book_owed(&mut p, 5_000_000).unwrap();
    assert_eq!((r.user_owed_base, p.owed_base, r.liquid_base(105_000_000)), (5_000_000, 5_000_000, 100_000_000));
    assert_eq!(r.book_claim(&mut p), 5_000_000);
    assert_eq!((r.user_owed_base, p.owed_base, r.book_claim(&mut p)), (0, 0, 0));
}
