pub const RESERVE_SEED: &[u8] = b"reserve";
pub const VAULT_SEED: &[u8] = b"vault";
pub const TICKET_SEED: &[u8] = b"ticket";
pub const PROVIDER_SEED: &[u8] = b"provider";
pub const EXPIRY_SEED: &[u8] = b"expiry";

/// The probability scale shared with the client.
pub const ONE_RAW: i128 = 1_000_000;
/// A ticket whose Windows never answered is refunded this long after its last boundary.
pub const VOID_GRACE_SEC: i64 = 3_600;
