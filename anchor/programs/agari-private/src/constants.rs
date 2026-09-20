pub const DESK_SEED: &[u8] = b"desk";
/// The desk's engine seat. It signs every CPI, so custody is held in its name and nobody else's.
pub const SEAT_SEED: &[u8] = b"seat";
pub const CUSTODY_SEED: &[u8] = b"custody";
/// OWNER side: an owner's balance and the allowance the desk may spend of it.
pub const BUDGET_SEED: &[u8] = b"budget";
/// OWNER side: one mark per charge key and per credit key, so a key can never be used twice.
pub const CHARGE_SEED: &[u8] = b"charge";
pub const CREDIT_SEED: &[u8] = b"credit";
/// SLOT side: one bet's throwaway account. Its seed is the slot id alone; no owner is anywhere near it.
pub const SLOT_SEED: &[u8] = b"slot";

/// Price levels read when sizing a mint.
pub const LEVELS: usize = 32;

/// Order vocabulary, as the engine numbers it.
pub const ORDER_TYPE_IOC: u8 = 2;
pub const SELF_MATCH_CANCEL_TAKER: u8 = 0;
pub const MAX_FILLS: u8 = 16;
pub const MAX_EVICTIONS: u8 = 16;
/// An IOC executes at once; its expiry only has to lie ahead, and never past the Window's lock.
pub const IOC_LIFE_SEC: i64 = 60;

const fn pda(seed: &[u8], program: &anchor_lang::prelude::Pubkey) -> anchor_lang::prelude::Pubkey {
    anchor_lang::prelude::Pubkey::new_from_array(anchor_lang::derive_program_address(&[seed], &program.to_bytes()).0)
}

/// agari-events `["config"]` and `["__event_authority"]`, derived at compile time so a constraint compares 32 bytes.
pub const EVENTS_CONFIG: anchor_lang::prelude::Pubkey = pda(agari_common::seeds::CONFIG_SEED, &agari_events::ID_CONST);
pub const EVENTS_EVENT_AUTHORITY: anchor_lang::prelude::Pubkey = pda(agari_common::seeds::EVENT_AUTHORITY_SEED, &agari_events::ID_CONST);
