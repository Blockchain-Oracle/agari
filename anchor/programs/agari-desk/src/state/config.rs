//! `DeskConfig` PDA `["desk-config"]` (desk.md §2): the venue-wide settings every desk shares. Fields, not
//! constants, so tests pin a test mint and a stub router without a rebuild.

use anchor_lang::prelude::*;

use crate::constants::MAX_ATTESTORS;

/// 296 B struct, 304 B account.
#[account(zero_copy)]
pub struct DeskConfig {
    /// The program upgrade authority at init.
    pub admin: Pubkey,
    /// The collateral: USDC on mainnet (SPL Token, 6 dp); a test mint on LiteSVM.
    pub usdc_mint: Pubkey,
    /// The router every operator swap goes through: Jupiter v6 on mainnet; the stub in tests.
    pub swap_program: Pubkey,
    /// ed25519 keys allowed to sign reference messages.
    pub attestors: [Pubkey; MAX_ATTESTORS],
    /// Core `CLUSTER_ID` (101 / 103 / 104), bound into reference messages.
    pub cluster_tag: u8,
    pub bump: u8,
    pub _pad: [u8; 6],
    pub _reserved: [u8; 64],
}

impl DeskConfig {
    pub fn is_attestor(&self, key: &[u8; 32]) -> bool {
        *key != [0u8; 32] && self.attestors.iter().any(|a| a.to_bytes() == *key)
    }
}
