/// PDA seeds. One vault per program, its custody and its engine seat under it, one book per Window.
pub const VAULT_SEED: &[u8] = b"vault";
pub const CUSTODY_SEED: &[u8] = b"custody";
/// The vault's engine seat: the authority every CPI into agari-events signs as.
pub const SEAT_SEED: &[u8] = b"seat";
pub const PROVIDER_SEED: &[u8] = b"provider";
pub const WINDOW_SEED: &[u8] = b"window";

pub const BPS: u64 = 10_000;
