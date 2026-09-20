pub const ARENA_SEED: &[u8] = b"arena";
/// The arena's engine seat. It signs every CPI, so custody is held in its name and nobody else's.
pub const SEAT_SEED: &[u8] = b"seat";
pub const CUSTODY_SEED: &[u8] = b"custody";
pub const MATCH_SEED: &[u8] = b"match";
pub const AGENT_SEED: &[u8] = b"agent";
pub const CREDIT_SEED: &[u8] = b"credit";
pub const SEASON_SEED: &[u8] = b"season";
pub const SEASON_VAULT_SEED: &[u8] = b"season-vault";

/// The picked and settled masks are one byte each, a bit per card.
pub const MAX_DECK: usize = 8;
pub const TIERS: usize = 4;
/// A grant outlives no match that is still being played: the pick window is minutes. A day is a ceiling on the
/// stored deadline, not a promise of anything a finished match would still allow.
pub const MAX_AGENT_TTL_SEC: u32 = 86_400;
pub const MAX_SEASON_WINNERS: usize = 16;
pub const MAX_SEASON_ID_LEN: usize = 32;

/// Price levels read when sizing a pick.
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
