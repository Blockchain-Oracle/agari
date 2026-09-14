//! `PlaceResult`, the return data of `user_place_order` (events-accounts.md §5; events-engine.md §4.4).
//!
//! The engine writes it with `set_return_data` as its last action. A product CPI caller reads it with
//! `get_return_data()` right after the CPI and must check the returning program id first.

use anchor_lang::prelude::*;

/// An order handle: the 0-based node index plus its sequence number (ABA-safe across book recycling).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Handle {
    pub node: u32,
    pub seq: u64,
}

impl Handle {
    pub const NONE: Handle = Handle { node: u32::MAX, seq: 0 };

    pub const fn is_none(&self) -> bool {
        self.node == u32::MAX
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct PlaceResult {
    pub filled_lots: u64,
    pub cash_spent: u64,
    pub cash_received: u64,
    pub credit_used: u64,
    pub transferred_in: u64,
    pub withdrawn: u64,
    /// Escrow never pulled (better-than-limit fills and the cancelled remainder); a report, nothing moves.
    pub refunded: u64,
    pub rested_lots: u64,
    pub cancelled_lots: u64,
    pub rested: Handle,
    pub seat: u16,
    pub fills: u8,
    pub evictions: u8,
    pub self_cancels: u8,
    pub stop_reason: u8,
    /// One bit per `Path` used (DIRECT_YES 0 … BURN_PAIR 3).
    pub path_mask: u8,
}

/// Borsh length of `PlaceResult`: 9 × u64 + Handle (12) + u16 + 5 × u8.
pub const PLACE_RESULT_LEN: usize = 91;

impl PlaceResult {
    /// Decodes return data only when it came from `engine` and is exactly one `PlaceResult`.
    pub fn from_return_data(engine: &Pubkey, returned: Option<(Pubkey, Vec<u8>)>) -> Option<PlaceResult> {
        let (program, data) = returned?;
        if program != *engine || data.len() != PLACE_RESULT_LEN {
            return None;
        }
        PlaceResult::try_from_slice(&data).ok()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn borsh_layout_is_91_bytes_and_round_trips() {
        let result = PlaceResult { filled_lots: 3_000, cash_spent: 1_620_000, refunded: 60_000, rested: Handle::NONE, fills: 1, path_mask: 1, ..Default::default() };
        let bytes = anchor_lang::prelude::borsh::to_vec(&result).unwrap();
        assert_eq!(bytes.len(), PLACE_RESULT_LEN);
        let engine = Pubkey::new_from_array([9u8; 32]);
        assert_eq!(PlaceResult::from_return_data(&engine, Some((engine, bytes.clone()))), Some(result));
        assert_eq!(PlaceResult::from_return_data(&Pubkey::default(), Some((engine, bytes))), None);
        assert!(Handle::NONE.is_none());
    }
}
