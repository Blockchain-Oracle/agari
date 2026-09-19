pub const RESERVE_SEED: &[u8] = b"reserve";
pub const VAULT_SEED: &[u8] = b"vault";
pub const TICKET_SEED: &[u8] = b"ticket";
pub const PROVIDER_SEED: &[u8] = b"provider";

/// The most legs one ticket can carry. Each leg is three engine accounts, and a transaction has to hold them all.
pub const MAX_LEGS: usize = 4;
pub const MIN_LEGS: usize = 2;
/// Each leg names its Market, that Market's Book and its Series, in that order, as remaining accounts.
pub const ACCOUNTS_PER_LEG: usize = 3;
/// Distinct boundaries the reserve can have capital riding on at once.
pub const EXPIRY_SLOTS: usize = 32;
/// Price levels read per side when pricing a leg; a book thinner than the depth over these refuses the leg.
pub const PRICE_LEVELS: usize = 32;
/// A ticket whose Windows never answered is refunded this long after its last boundary.
pub const VOID_GRACE_SEC: i64 = 3_600;
