//! Byte layouts asserted against vault.md §2, rent, and the compile-time singleton addresses.

use core::mem::{align_of, offset_of, size_of};

use anchor_lang::prelude::Pubkey;
use anchor_lang::Discriminator;

use super::*;
use crate::constants::{EVENTS_CONFIG, EVENTS_EVENT_AUTHORITY, SEAT, VAULT_CONFIG};

macro_rules! offsets {
    ($t:ty { $($field:ident @ $off:expr),+ $(,)? }) => {
        $(assert_eq!(offset_of!($t, $field), $off, concat!(stringify!($t), ".", stringify!($field)));)+
    };
}

/// Devnet rent: `(account bytes + 128) × 5,080` lamports.
const fn rent(account_bytes: usize) -> u64 {
    (account_bytes as u64 + 128) * 5_080
}

#[test]
fn sizes_alignment_and_rent() {
    assert_eq!((size_of::<VaultConfig>(), align_of::<VaultConfig>()), (208, 8));
    assert_eq!((size_of::<PositionSlot>(), align_of::<PositionSlot>()), (64, 8));
    assert_eq!((size_of::<VaultAccount>(), align_of::<VaultAccount>()), (1_152, 8));
    assert_eq!((size_of::<Grant>(), align_of::<Grant>()), (168, 8));
    for disc in [VaultConfig::DISCRIMINATOR, VaultAccount::DISCRIMINATOR, Grant::DISCRIMINATOR] {
        assert_eq!(disc.len(), 8);
    }
    assert_eq!(rent(8 + size_of::<VaultConfig>()), 1_747_520);
    assert_eq!(rent(8 + size_of::<VaultAccount>()), 6_543_040);
    assert_eq!(rent(8 + size_of::<Grant>()), 1_544_320);
}

#[test]
fn offsets() {
    offsets!(VaultConfig { admin @ 0, events_config @ 32, collateral_mint @ 64, seat @ 96, next_grant_id @ 128, seat_bump @ 136,
        bump @ 137, _pad @ 138, _reserved @ 144 });
    offsets!(VaultAccount { owner @ 0, available @ 32, private_available @ 40, total_deposited @ 48, total_withdrawn @ 56,
        active_grants @ 64, custody_bump @ 88, bump @ 89, slots_used @ 90, _pad @ 92, _reserved @ 96, positions @ 128 });
    offsets!(PositionSlot { market @ 0, yes_lots @ 32, no_lots @ 40, yes_grant @ 48, no_grant @ 56 });
    offsets!(Grant { owner @ 0, actor @ 32, grant_id @ 64, expires_at_sec @ 72, spent_day @ 80, spent_today @ 88, budget @ 96,
        max_stake_per_trade @ 104, max_daily_spend @ 112, max_open_positions @ 120, open_positions @ 124, max_price_ticks @ 128,
        kind @ 130, revoked @ 131, bump @ 132, _pad @ 133, _reserved @ 136 });
}

#[test]
fn compile_time_addresses_match_the_runtime_derivation() {
    let pda = |seed: &[u8], program: &Pubkey| Pubkey::find_program_address(&[seed], program).0;
    assert_eq!(VAULT_CONFIG, pda(b"vault-config", &crate::ID));
    assert_eq!(SEAT, agari_common::seeds::seat_address(&crate::ID).0);
    assert_eq!(EVENTS_CONFIG, agari_common::seeds::config_address(&agari_events::ID).0);
    assert_eq!(EVENTS_EVENT_AUTHORITY, agari_common::seeds::event_authority_address(&agari_events::ID).0);
}
