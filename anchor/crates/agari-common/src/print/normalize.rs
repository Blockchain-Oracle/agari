//! Normalization to the stored exponent (prints.md §4.6): checked `i128`, exact for sources at or coarser than
//! 10⁻⁸ (Pyth equities `expo −5` → × 1,000), a floor for finer ones (Switchboard 10⁻¹⁸ → ÷ 10¹⁰). Both
//! boundaries of a Window use the same source and rule, so `close ≥ open` stays consistent.

use super::PrintError;

/// Every recorded print is `price × 10⁻⁸`.
pub const PRINT_EXPO: i32 = -8;
pub const MIN_SOURCE_EXPO: i32 = -18;

/// `raw_price × 10^raw_expo` as an `expo −8` price. `InvalidPrintValue` for a non-positive price, an exponent
/// outside `−18..=0`, a result of 0 after the floor, or a result above `i64::MAX`.
pub fn normalize(raw_price: i128, raw_expo: i32) -> Result<i64, PrintError> {
    if raw_price <= 0 || !(MIN_SOURCE_EXPO..=0).contains(&raw_expo) {
        return Err(PrintError::InvalidPrintValue);
    }
    let q = if raw_expo >= PRINT_EXPO {
        // 0 ≤ e + 8 ≤ 8, so the power always fits.
        raw_price.checked_mul(10i128.pow((raw_expo - PRINT_EXPO) as u32)).ok_or(PrintError::InvalidPrintValue)?
    } else {
        // 1 ≤ −8 − e ≤ 10; floor division of a positive value.
        raw_price / 10i128.pow((PRINT_EXPO - raw_expo) as u32)
    };
    if q <= 0 {
        return Err(PrintError::InvalidPrintValue);
    }
    i64::try_from(q).map_err(|_| PrintError::InvalidPrintValue)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exact_at_or_above_minus_eight() {
        // Archived TSLA 2026-09-11 20:00:00Z: 36,547,600 × 10⁻⁵ = 365.476.
        assert_eq!(normalize(36_547_600, -5), Ok(36_547_600_000));
        assert_eq!(normalize(365, 0), Ok(36_500_000_000));
        assert_eq!(normalize(36_547_600_000, -8), Ok(36_547_600_000));
    }

    #[test]
    fn floors_finer_sources() {
        // Switchboard-style 10¹⁸ scale: 365.4760000009 → 365.47600000.
        assert_eq!(normalize(365_476_000_000_900_000_000, -18), Ok(36_547_600_000));
        assert_eq!(normalize(9, -9), Err(PrintError::InvalidPrintValue)); // floors to 0
        assert_eq!(normalize(19, -9), Ok(1));
    }

    #[test]
    fn refuses_bad_inputs_and_overflow() {
        assert_eq!(normalize(0, -5), Err(PrintError::InvalidPrintValue));
        assert_eq!(normalize(-1, -5), Err(PrintError::InvalidPrintValue));
        assert_eq!(normalize(1, 1), Err(PrintError::InvalidPrintValue));
        assert_eq!(normalize(1, -19), Err(PrintError::InvalidPrintValue));
        assert_eq!(normalize(i128::from(i64::MAX), 0), Err(PrintError::InvalidPrintValue));
        assert_eq!(normalize(i128::from(i64::MAX / 100_000_000), 0), Ok(i64::MAX / 100_000_000 * 100_000_000));
        assert_eq!(normalize(i128::MAX, -1), Err(PrintError::InvalidPrintValue));
    }
}
