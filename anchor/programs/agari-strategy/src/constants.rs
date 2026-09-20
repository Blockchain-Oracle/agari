pub const REGISTRY_SEED: &[u8] = b"registry";
pub const STRATEGY_SEED: &[u8] = b"strategy";
pub const SUBSCRIPTION_SEED: &[u8] = b"subscription";

/// The most a creator's published words and spec may run to. One transaction carries about 780 bytes of it, so it
/// is written in chunks and sealed; this is the room every Strategy account is given.
pub const MAX_METADATA_LEN: usize = 2_048;
/// `agari-vault`'s grant kinds are SESSION 0, EXECUTOR 1, STRATEGY 2. Only the last may back a subscription.
pub const GRANT_KIND_STRATEGY: u8 = 2;
