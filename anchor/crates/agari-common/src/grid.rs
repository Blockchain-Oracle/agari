//! The exact grid (events-engine.md §1). Prices are YES ticks `1..=999`; a YES and a NO at complementary
//! prices cost exactly one pair. Every helper is checked: `None` means overflow (the engine maps it to
//! `MathOverflow`). No rounding happens anywhere except the redeem floor, which is exact on valid grids.

/// Ticks in one pair: YES price `p` and NO price `1000 − p`.
pub const PAIR_TICKS: u64 = 1_000;
pub const MIN_PRICE_TICKS: u16 = 1;
pub const MAX_PRICE_TICKS: u16 = 999;

/// Payout vector denominator: win `(10⁷, 0)`, void `(5·10⁶, 5·10⁶)`.
pub const PAYOUT_DENOMINATOR: u32 = 10_000_000;
pub const PAYOUT_VOID: u32 = PAYOUT_DENOMINATOR / 2;

/// Why `admin_register_series` refuses a grid (the engine maps all of these to `BadGrid`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GridError {
    /// `10^decimals` does not fit a `u64`.
    DecimalsTooLarge,
    /// `tick_base × 1000 != 10^decimals`: a pair would not cost exactly one collateral unit.
    TickNotUnit,
    /// `lot_base × tick_base` is not a whole number of base units per lot-tick.
    LotTickNotWhole,
    /// `min_lots`, `lot_base` or the derived cash unit is zero.
    Zero,
    MathOverflow,
}

pub fn pow10(decimals: u8) -> Option<u64> {
    10u64.checked_pow(u32::from(decimals))
}

pub const fn is_valid_price(price_ticks: u16) -> bool {
    price_ticks >= MIN_PRICE_TICKS && price_ticks <= MAX_PRICE_TICKS
}

/// The Series cash unit `cu = lot_base × tick_base / 10^dec`, after the registration rules.
/// Because `tick_base × 1000 == 10^dec`, `1000 × cu == lot_base`: one outcome base unit redeems for
/// exactly one collateral base unit on a win.
pub fn cash_unit(lot_base: u64, tick_base: u64, decimals: u8) -> Result<u64, GridError> {
    let pow = pow10(decimals).ok_or(GridError::DecimalsTooLarge)?;
    if lot_base == 0 || tick_base == 0 {
        return Err(GridError::Zero);
    }
    if tick_base.checked_mul(PAIR_TICKS).ok_or(GridError::MathOverflow)? != pow {
        return Err(GridError::TickNotUnit);
    }
    let product = lot_base.checked_mul(tick_base).ok_or(GridError::MathOverflow)?;
    if product % pow != 0 {
        return Err(GridError::LotTickNotWhole);
    }
    match product / pow {
        0 => Err(GridError::Zero),
        cu => Ok(cu),
    }
}

/// `lots × p × cu`: what a YES side pays or receives at YES price `p`.
pub fn yes_cash(lots: u64, price_ticks: u16, cash_unit: u64) -> Option<u64> {
    lots.checked_mul(u64::from(price_ticks))?.checked_mul(cash_unit)
}

/// `lots × (1000 − p) × cu`: what a NO side pays or receives at YES price `p`.
pub fn no_cash(lots: u64, price_ticks: u16, cash_unit: u64) -> Option<u64> {
    let no_ticks = PAIR_TICKS.checked_sub(u64::from(price_ticks))?;
    lots.checked_mul(no_ticks)?.checked_mul(cash_unit)
}

/// `lots × 1000 × cu`: the backing of `lots` complete pairs.
pub fn pair_cash(lots: u64, cash_unit: u64) -> Option<u64> {
    lots.checked_mul(PAIR_TICKS)?.checked_mul(cash_unit)
}

/// Full redeem (events-engine.md §8.4): `⌊(yes·1000·cu·yN + no·1000·cu·nN) / 10⁷⌋`, computed in `u128`.
pub fn redeem_payout(yes_lots: u64, no_lots: u64, cash_unit: u64, payout_yes: u32, payout_no: u32) -> Option<u64> {
    let unit = u128::from(PAIR_TICKS).checked_mul(u128::from(cash_unit))?;
    let yes = u128::from(yes_lots).checked_mul(unit)?.checked_mul(u128::from(payout_yes))?;
    let no = u128::from(no_lots).checked_mul(unit)?.checked_mul(u128::from(payout_no))?;
    let total = yes.checked_add(no)? / u128::from(PAYOUT_DENOMINATOR);
    u64::try_from(total).ok()
}

/// Partial redeem of one outcome (PROGRAM seats): `⌊lots·1000·cu·num / 10⁷⌋`.
pub fn partial_payout(lots: u64, cash_unit: u64, numerator: u32) -> Option<u64> {
    redeem_payout(lots, 0, cash_unit, numerator, 0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registration_rules() {
        assert_eq!(cash_unit(1_000, 1_000, 6), Ok(1));
        assert_eq!(cash_unit(1_000, 1_000_000, 9), Ok(1));
        assert_eq!(cash_unit(10_000, 1_000, 6), Ok(10));
        assert_eq!(cash_unit(1_000, 1, 6), Err(GridError::TickNotUnit));
        assert_eq!(cash_unit(1, 1_000, 6), Err(GridError::LotTickNotWhole));
        assert_eq!(cash_unit(0, 1_000, 6), Err(GridError::Zero));
        assert_eq!(cash_unit(1_000, 1_000, 30), Err(GridError::DecimalsTooLarge));
    }

    #[test]
    fn a_pair_always_costs_exactly_its_backing() {
        for p in [MIN_PRICE_TICKS, 437, 500, MAX_PRICE_TICKS] {
            let sum = yes_cash(5_000, p, 1).unwrap() + no_cash(5_000, p, 1).unwrap();
            assert_eq!(sum, pair_cash(5_000, 1).unwrap());
        }
        assert!(is_valid_price(1) && is_valid_price(999) && !is_valid_price(0) && !is_valid_price(1_000));
        assert_eq!(no_cash(1, 1_001, 1), None);
    }

    #[test]
    fn spec_worked_numbers() {
        // events-engine.md §2.2: DIRECT_YES, DIRECT_NO, MINT_PAIR and the fill-cap refund.
        assert_eq!(yes_cash(3_000, 540, 1), Some(1_620_000));
        assert_eq!(no_cash(2_000, 450, 1), Some(1_100_000));
        assert_eq!(no_cash(4_000, 620, 1), Some(1_520_000));
        assert_eq!(yes_cash(10_000, 600, 1).unwrap() - 1_110_000, 4_890_000);
        // §2.2 example 8: Up wins → A redeems 4,000 YES for 4,000,000; void → 2,000,000 each side.
        assert_eq!(redeem_payout(4_000, 0, 1, PAYOUT_DENOMINATOR, 0), Some(4_000_000));
        assert_eq!(redeem_payout(0, 4_000, 1, PAYOUT_VOID, PAYOUT_VOID), Some(2_000_000));
        assert_eq!(partial_payout(4_000, 1, PAYOUT_VOID), Some(2_000_000));
    }

    #[test]
    fn overflow_is_none_never_a_wrap() {
        assert_eq!(yes_cash(u64::MAX, 2, 1), None);
        assert_eq!(pair_cash(u64::MAX / 999, 1), None);
        assert_eq!(redeem_payout(u64::MAX, u64::MAX, u64::MAX, PAYOUT_DENOMINATOR, PAYOUT_DENOMINATOR), None);
    }
}
