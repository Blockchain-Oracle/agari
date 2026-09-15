//! Seeds, singleton addresses and limits (vault.md §2). Singleton PDAs are derived at compile time, so account
//! constraints compare 32 bytes instead of hashing, and the IDL carries their addresses.

use anchor_lang::prelude::Pubkey;

pub use agari_common::seeds::SEAT_SEED;

pub const VAULT_CONFIG_SEED: &[u8] = b"vault-config";
pub const ACCOUNT_SEED: &[u8] = b"acct";
pub const CUSTODY_SEED: &[u8] = b"custody";
pub const GRANT_SEED: &[u8] = b"grant";

const fn pda(seed: &[u8], program: &Pubkey) -> (Pubkey, u8) {
    let (address, bump) = anchor_lang::derive_program_address(&[seed], &program.to_bytes());
    (Pubkey::new_from_array(address), bump)
}

/// `["vault-config"]`.
pub const VAULT_CONFIG: Pubkey = pda(VAULT_CONFIG_SEED, &crate::ID_CONST).0;
/// `["seat"]`: the vault's engine authority, listed at `program_authorities[0]` (D-063).
pub const SEAT: Pubkey = pda(SEAT_SEED, &crate::ID_CONST).0;
/// agari-events `["config"]`.
pub const EVENTS_CONFIG: Pubkey = pda(agari_common::seeds::CONFIG_SEED, &agari_events::ID_CONST).0;
/// agari-events `["__event_authority"]`.
pub const EVENTS_EVENT_AUTHORITY: Pubkey = pda(agari_common::seeds::EVENT_AUTHORITY_SEED, &agari_events::ID_CONST).0;

/// Position slots per owner (Q-S7-3).
pub const MAX_POSITION_SLOTS: usize = 16;
/// Grant kinds SESSION 0, EXECUTOR 1, STRATEGY 2; `active_grants` is indexed by kind.
pub const GRANT_KINDS: usize = 3;
/// `grant_id` and `client_id` of an owner acting alone.
pub const ATTENDED: u64 = 0;

/// The engine's IOC order type and CancelTaker self-match mode (`VenueGateway.sol:20-21`).
pub const ORDER_TYPE_IOC: u8 = 2;
pub const SELF_MATCH_CANCEL_TAKER: u8 = 0;
/// Upper bounds the vault passes as `max_fills` / `max_evictions` (vault.md §3.4 CPI).
pub const MAX_FILLS: u8 = 16;
pub const MAX_EVICTIONS: u8 = 16;

pub const SECONDS_PER_DAY: i64 = 86_400;
