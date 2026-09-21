use anchor_lang::prelude::*;

use crate::state::Envelope;

#[event]
pub struct RegistryInitialized {
    pub registry: Pubkey,
    pub admin: Pubkey,
    pub collateral_mint: Pubkey,
}

#[event]
pub struct Published {
    pub strategy: Pubkey,
    pub strategy_id: u64,
    pub creator: Pubkey,
    pub runner: Pubkey,
    pub spec_hash: [u8; 32],
    pub metadata_hash: [u8; 32],
    pub envelope: Envelope,
    pub subscription_fee_base: u64,
}

#[event]
pub struct Updated {
    pub strategy_id: u64,
    pub spec_hash: [u8; 32],
    pub metadata_hash: [u8; 32],
    pub subscription_fee_base: u64,
    pub revision: u32,
}

#[event]
pub struct Sealed {
    pub strategy_id: u64,
    pub revision: u32,
    pub metadata_len: u32,
}

#[event]
pub struct RunnerChanged {
    pub strategy_id: u64,
    pub runner: Pubkey,
}

#[event]
pub struct Deactivated {
    pub strategy_id: u64,
}

#[event]
pub struct Subscribed {
    pub strategy_id: u64,
    pub subscriber: Pubkey,
    pub grant_id: u64,
    pub fee_base: u64,
    pub subscribers: u32,
}

#[event]
pub struct Unsubscribed {
    pub strategy_id: u64,
    pub subscriber: Pubkey,
    pub subscribers: u32,
}

/// A wallet consented to be copied in the opposite direction (A-1c).
#[event]
pub struct Faded {
    pub strategy_id: u64,
    pub subscriber: Pubkey,
    pub grant_id: u64,
    pub fee_base: u64,
    pub subscribers: u32,
}

#[event]
pub struct Unfaded {
    pub strategy_id: u64,
    pub subscriber: Pubkey,
    pub subscribers: u32,
}
