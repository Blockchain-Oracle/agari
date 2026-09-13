use anchor_lang::prelude::*;
use hex_literal::hex;
use redstone::{
    core::{config::Config, process_payload},
    solana::{SolanaCrypto, SolanaRedStoneConfig},
    FeedId, SignerAddress,
};

use crate::SpikeError;

/// redstone-primary-prod signers from the RedStone Solana price adapter config
/// (redstone-oracles-monorepo@519cd10, packages/solana-connector/solana/programs/
/// redstone-solana-price-adapter/src/config/config_prod.rs).
pub const PRIMARY_PROD_SIGNERS: [[u8; 20]; 5] = [
    hex!("8bb8f32df04c8b654987daaed53d6b6091e3b774"),
    hex!("deb22f54738d54976c4c0fe5ce6d408e40d88499"),
    hex!("51ce04be4b3e32572c4ec9135221d0691ba7d202"),
    hex!("dd682daec5a90dd295d14da4b0bec9281017b5be"),
    hex!("9c5ae89c4af6aa32ce58588dbaf90d18a855b6de"),
];
pub const SIGNER_THRESHOLD: u8 = 3;

/// Verifies `payload` (RedStone wire format, marker-terminated) for `feed_id` at exactly
/// `boundary_ms`. Using T as the SDK's `block_timestamp` with zero delay/ahead tolerance
/// forces every package timestamp to equal T, independent of `Clock`.
/// Returns the median value (32-byte big-endian, 8 decimals for prices).
pub fn verify_at(feed_id: [u8; 32], boundary_ms: u64, payload: Vec<u8>) -> Result<[u8; 32]> {
    let signers: Vec<SignerAddress> = PRIMARY_PROD_SIGNERS.iter().map(|s| s.to_vec().into()).collect();
    let config = Config::try_new(
        SIGNER_THRESHOLD,
        signers,
        vec![FeedId::from(feed_id)],
        boundary_ms.into(),
        Some(0.into()),
        Some(0.into()),
    )?;
    let mut rs: SolanaRedStoneConfig = (config, SolanaCrypto).into();
    let validated = process_payload(&mut rs, payload)?;
    require!(validated.timestamp.as_millis() == boundary_ms, SpikeError::RedstoneTimestamp);
    let fv = validated.values.first().ok_or(SpikeError::RedstoneFeed)?;
    require!(fv.feed.to_array() == feed_id, SpikeError::RedstoneFeed);
    Ok(fv.value.0)
}
