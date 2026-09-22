//! Byte layouts asserted against desk.md §2, the mainnet rent, and the compile-time config address.

use core::mem::{align_of, offset_of, size_of};

use anchor_lang::prelude::Pubkey;
use anchor_lang::Discriminator;

use super::*;
use crate::constants::DESK_CONFIG;

macro_rules! offsets {
    ($t:ty { $($field:ident @ $off:expr),+ $(,)? }) => {
        $(assert_eq!(offset_of!($t, $field), $off, concat!(stringify!($t), ".", stringify!($field)));)+
    };
}

/// Mainnet rent (2026-09-22): `(account bytes + 128) × 6,960` lamports.
const fn rent(account_bytes: usize) -> u64 {
    (account_bytes as u64 + 128) * 6_960
}

#[test]
fn sizes_alignment_and_rent() {
    assert_eq!((size_of::<DeskConfig>(), align_of::<DeskConfig>()), (296, 1));
    assert_eq!((size_of::<DeskToken>(), align_of::<DeskToken>()), (40, 1));
    assert_eq!((size_of::<Desk>(), align_of::<Desk>()), (528, 8));
    assert_eq!((size_of::<DeskRef>(), align_of::<DeskRef>()), (168, 8));
    for disc in [DeskConfig::DISCRIMINATOR, Desk::DISCRIMINATOR, DeskRef::DISCRIMINATOR] {
        assert_eq!(disc.len(), 8);
    }
    assert_eq!(rent(8 + size_of::<DeskConfig>()), 3_006_720);
    assert_eq!(rent(8 + size_of::<Desk>()), 4_621_440);
    assert_eq!(rent(8 + size_of::<DeskRef>()), 2_115_840);
}

#[test]
fn offsets() {
    offsets!(DeskConfig { admin @ 0, usdc_mint @ 32, swap_program @ 64, attestors @ 96, cluster_tag @ 224, bump @ 225, _pad @ 226, _reserved @ 232 });
    offsets!(DeskToken { mint @ 0, enabled @ 32, _pad @ 33 });
    offsets!(Desk { owner @ 0, operator @ 32, head @ 64, seq @ 96, per_action_cap @ 104, daily_cap @ 112, spent_in_window @ 120,
        window_start_sec @ 128, tokens @ 136, max_premium_bps @ 456, mode @ 458, paused @ 459, require_pyth_index @ 460, bump @ 461,
        token_count @ 462, _pad0 @ 463, _reserved @ 464 });
    offsets!(DeskRef { mint @ 0, pyth_feed_id @ 32, token_price_e8 @ 64, mark_price_e8 @ 72, multiplier_e12 @ 80, fetched_at_sec @ 88,
        posted_by @ 96, bump @ 128, _pad @ 129, _reserved @ 136 });
}

#[test]
fn compile_time_config_address_matches_the_runtime_derivation() {
    assert_eq!(DESK_CONFIG, Pubkey::find_program_address(&[b"desk-config"], &crate::ID).0);
}

#[test]
fn desk_helpers() {
    let mut desk = Desk { owner: Pubkey::new_unique(), operator: Pubkey::default(), head: [0; 32], seq: 0, per_action_cap: 50, daily_cap: 150, spent_in_window: 100, window_start_sec: 1_000, tokens: [DeskToken::default(); 8], max_premium_bps: 1000, mode: 2, paused: 0, require_pyth_index: 0, bump: 0, token_count: 0, _pad0: 0, _reserved: [0; 64] };
    assert!(!desk.is_operator(&Pubkey::default()));
    let mint = Pubkey::new_unique();
    assert_eq!(desk.token_index(&mint), None);
    assert_eq!(desk.free_slot(), Some(0));
    desk.tokens[0] = DeskToken { mint, enabled: 1, _pad: [0; 7] };
    assert_eq!(desk.token_index(&mint), Some(0));
    assert_eq!(desk.free_slot(), Some(1));
    assert_eq!(desk.remaining_daily_cap(1_000), 50);
    assert_eq!(desk.remaining_daily_cap(1_000 + 86_400), 150);
}
