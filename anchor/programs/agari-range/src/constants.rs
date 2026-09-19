/// PDA seeds. One reserve per program, one vault under it, one Round per id.
pub const RESERVE_SEED: &[u8] = b"reserve";
pub const VAULT_SEED: &[u8] = b"vault";
pub const ROUND_SEED: &[u8] = b"round";

/// The probability scale shared with the client (`P_ONE` in `packages/core/src/range/pricing.ts`).
pub const ONE_RAW: i128 = 1_000_000;

/// A Window the engine never answered is refunded this long after its close, so a round can never be stuck.
pub const VOID_GRACE_SEC: i64 = 3_600;
