pub const RESERVE_SEED: &[u8] = b"reserve";
/// The reserve's engine seat. It signs every CPI, so custody is held in its name and nobody else's.
pub const SEAT_SEED: &[u8] = b"seat";
pub const CUSTODY_SEED: &[u8] = b"custody";
pub const PROVIDER_SEED: &[u8] = b"provider";
pub const POSITION_SEED: &[u8] = b"position";
/// Fronted capital per Window: every boost on one print loses together.
pub const WINDOW_SEED: &[u8] = b"lwin";

/// The most positions the reserve can have live at once. The table of them lives in the reserve so a withdrawal
/// can see, without being handed any accounts, whether an expired position is still unsettled.
pub const MAX_OPEN: usize = 128;
/// Price levels read per side when sizing, marking or exiting a position.
pub const LEVELS: usize = 32;

/// Order vocabulary, as the engine numbers it.
pub const ORDER_TYPE_IOC: u8 = 2;
pub const SELF_MATCH_CANCEL_TAKER: u8 = 0;
pub const MAX_FILLS: u8 = 16;
pub const MAX_EVICTIONS: u8 = 16;
/// An IOC executes at once; its expiry only has to lie ahead, and never past the Window's lock.
pub const IOC_LIFE_SEC: i64 = 60;

/// 1× in basis points. A boost is anything above it.
pub const LEVERAGE_ONE_BPS: u32 = 10_000;

const fn pda(seed: &[u8], program: &anchor_lang::prelude::Pubkey) -> anchor_lang::prelude::Pubkey {
    anchor_lang::prelude::Pubkey::new_from_array(anchor_lang::derive_program_address(&[seed], &program.to_bytes()).0)
}

/// agari-events `["config"]` and `["__event_authority"]`, derived at compile time so a constraint compares 32 bytes.
pub const EVENTS_CONFIG: anchor_lang::prelude::Pubkey = pda(agari_common::seeds::CONFIG_SEED, &agari_events::ID_CONST);
pub const EVENTS_EVENT_AUTHORITY: anchor_lang::prelude::Pubkey = pda(agari_common::seeds::EVENT_AUTHORITY_SEED, &agari_events::ID_CONST);
