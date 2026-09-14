//! PDA seeds for every engine account (events-accounts.md §2). Integers are little-endian.

use anchor_lang::prelude::Pubkey;

pub const CONFIG_SEED: &[u8] = b"config";
pub const SERIES_SEED: &[u8] = b"series";
pub const MARKET_SEED: &[u8] = b"market";
pub const LEDGER_SEED: &[u8] = b"ledger";
pub const MVAULT_SEED: &[u8] = b"mvault";
pub const RESULT_SEED: &[u8] = b"result";
/// A product program's seat authority (its engine seat signer).
pub const SEAT_SEED: &[u8] = b"seat";
/// Anchor `#[event_cpi]` authority.
pub const EVENT_AUTHORITY_SEED: &[u8] = b"__event_authority";

pub fn config_address(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[CONFIG_SEED], program_id)
}

pub fn series_address(program_id: &Pubkey, ticker: u16, cadence_sec: u32, basis: u8) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[SERIES_SEED, &ticker.to_le_bytes(), &cadence_sec.to_le_bytes(), &[basis]], program_id)
}

pub fn market_address(program_id: &Pubkey, series: &Pubkey, index: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[MARKET_SEED, series.as_ref(), &index.to_le_bytes()], program_id)
}

pub fn ledger_address(program_id: &Pubkey, market: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[LEDGER_SEED, market.as_ref()], program_id)
}

pub fn mvault_address(program_id: &Pubkey, market: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[MVAULT_SEED, market.as_ref()], program_id)
}

pub fn result_address(program_id: &Pubkey, market: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[RESULT_SEED, market.as_ref()], program_id)
}

pub fn event_authority_address(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[EVENT_AUTHORITY_SEED], program_id)
}

/// The seat PDA a product program signs engine calls with; it is what `config.program_authorities` lists.
pub fn seat_address(product_program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[SEAT_SEED], product_program_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    const PROGRAM: Pubkey = Pubkey::new_from_array([7u8; 32]);

    #[test]
    fn series_seed_bytes_are_ticker_cadence_basis_little_endian() {
        let (expected, _) = Pubkey::find_program_address(&[b"series", &[1, 0], &[0x2c, 0x01, 0, 0], &[0]], &PROGRAM);
        assert_eq!(series_address(&PROGRAM, 1, 300, 0).0, expected);
        let (gap, _) = Pubkey::find_program_address(&[b"series", &[1, 0], &604_800u32.to_le_bytes(), &[1]], &PROGRAM);
        assert_eq!(series_address(&PROGRAM, 1, 604_800, 1).0, gap);
    }

    #[test]
    fn every_window_account_is_distinct_and_market_scoped() {
        let series = series_address(&PROGRAM, 1, 300, 0).0;
        let m0 = market_address(&PROGRAM, &series, 0).0;
        let m1 = market_address(&PROGRAM, &series, 1).0;
        assert_ne!(m0, m1);
        let accounts = [ledger_address(&PROGRAM, &m0).0, mvault_address(&PROGRAM, &m0).0, result_address(&PROGRAM, &m0).0];
        assert!(accounts.iter().all(|a| *a != m0) && accounts[0] != accounts[1] && accounts[1] != accounts[2]);
        assert_ne!(ledger_address(&PROGRAM, &m0).0, ledger_address(&PROGRAM, &m1).0);
    }
}
