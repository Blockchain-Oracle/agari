//! The median rule shared with the RedStone SDK (`utils/median.rs`) and the TS mirror: the middle value for an odd
//! count, `⌊(a + b) / 2⌋` computed without overflow for an even count (prints.md §4.2 step 7).

/// `⌊(a + b) / 2⌋` without overflow: `(a >> 1) + (b >> 1) + (((a & 1) + (b & 1)) >> 1)`.
pub const fn avg_floor(a: u128, b: u128) -> u128 {
    (a >> 1) + (b >> 1) + (((a & 1) + (b & 1)) >> 1)
}

/// Median of `values` (sorted in place); `None` when empty.
pub fn median(values: &mut [u128]) -> Option<u128> {
    if values.is_empty() {
        return None;
    }
    values.sort_unstable();
    let mid = values.len() / 2;
    Some(if values.len() % 2 == 0 { avg_floor(values[mid - 1], values[mid]) } else { values[mid] })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn odd_even_and_overflow_safe() {
        assert_eq!(median(&mut []), None);
        assert_eq!(median(&mut [7]), Some(7));
        assert_eq!(median(&mut [5, 1, 3]), Some(3));
        assert_eq!(median(&mut [4, 1, 3, 2]), Some(2)); // ⌊(2 + 3) / 2⌋
        assert_eq!(median(&mut [36_547_600_001, 36_547_600_000]), Some(36_547_600_000));
        assert_eq!(median(&mut [u128::MAX, u128::MAX - 2]), Some(u128::MAX - 1));
        assert_eq!(avg_floor(u128::MAX, u128::MAX), u128::MAX);
    }
}
