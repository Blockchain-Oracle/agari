//! Shared by every Agari program (plan §3.1 `agari-common`).
//!
//! S0 stub: the exact grid and payout constants that the engine and products agree on.
//! S2 adds `seeds`, `place_result`, `view::load_checked`, `book_walk` and `print/*`.

#![no_std]

/// Collateral and outcome amounts use 6 decimals (USDC); one whole share pays 10^6 base units.
pub const DECIMALS_SCALE: u64 = 1_000_000;

/// One lot is 1,000 outcome base units (0.001 share).
pub const LOT_BASE: u64 = 1_000;

/// One tick is 1,000 collateral base units per whole share (0.001 USDC).
pub const TICK_BASE: u64 = 1_000;

/// YES prices are `price_ticks ∈ 1..=999`; a YES and a NO at complementary prices sum to 1000.
pub const TICKS_PER_UNIT: u16 = 1_000;

/// Payout vector denominator: win 1e7, loss 0, void 5e6 (exactly half).
pub const PAYOUT_DENOMINATOR: u32 = 10_000_000;
pub const PAYOUT_VOID: u32 = PAYOUT_DENOMINATOR / 2;

/// A grid is exact when one lot at one tick costs a whole number of base units.
pub const fn grid_is_exact(lot_base: u64, tick_base: u64) -> bool {
    (lot_base * tick_base) % DECIMALS_SCALE == 0
}

/// Cash in collateral base units for `lots` at `price_ticks`: exactly `lots × price_ticks` on the
/// launch grid. `None` on overflow or an off-grid price.
pub fn cash_for(lots: u64, price_ticks: u16) -> Option<u64> {
    if price_ticks == 0 || price_ticks >= TICKS_PER_UNIT {
        return None;
    }
    let per_lot_tick = LOT_BASE * TICK_BASE / DECIMALS_SCALE;
    lots.checked_mul(u64::from(price_ticks))?.checked_mul(per_lot_tick)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn launch_grid_is_exact() {
        assert!(grid_is_exact(LOT_BASE, TICK_BASE));
        assert!(!grid_is_exact(1_000, 1));
    }

    #[test]
    fn a_pair_costs_exactly_one_lot_payout() {
        let p = 437;
        let yes = cash_for(5, p).unwrap();
        let no = cash_for(5, TICKS_PER_UNIT - p).unwrap();
        assert_eq!(yes + no, 5 * LOT_BASE);
        assert_eq!(5 * LOT_BASE * u64::from(PAYOUT_VOID) % u64::from(PAYOUT_DENOMINATOR), 0);
    }

    #[test]
    fn off_grid_prices_are_rejected() {
        assert_eq!(cash_for(1, 0), None);
        assert_eq!(cash_for(1, 1000), None);
    }
}
