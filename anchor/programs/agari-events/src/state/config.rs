//! `GlobalConfig` PDA `["config"]` (events-accounts.md §3.1). `mode` never blocks cancel, redeem or withdraw.

use anchor_lang::prelude::*;

use crate::constants::{MAX_ATTESTORS, MAX_PROGRAM_AUTHORITIES, MAX_REDSTONE_SIGNERS, MAX_ROLLERS};

/// 848 B struct, 856 B account.
#[account(zero_copy)]
pub struct GlobalConfig {
    /// Must equal the program upgrade authority at init.
    pub admin: Pubkey,
    /// SPL Token mint; Token-2022 is rejected.
    pub collateral_mint: Pubkey,
    pub token_program: Pubkey,
    /// Collateral token account that receives donated residue at ledger close.
    pub treasury: Pubkey,
    pub rollers: [Pubkey; MAX_ROLLERS],
    /// ed25519 keys allowed to sign attested prints.
    pub attestors: [Pubkey; MAX_ATTESTORS],
    /// Product seat PDAs; index `i` owns Ledger seat `i` in every Window.
    pub program_authorities: [Pubkey; MAX_PROGRAM_AUTHORITIES],
    pub switchboard_queue: Pubkey,
    /// 20-byte EVM addresses from RedStone's adapter config (D-002).
    pub redstone_signers: [[u8; 20]; MAX_REDSTONE_SIGNERS],
    pub redstone_signer_count: u8,
    /// Liveness threshold after `strict_sec`.
    pub redstone_threshold: u8,
    pub switchboard_min_oracles: u8,
    pub mode: u8,
    pub collateral_decimals: u8,
    /// Core `CLUSTER_ID` (101 / 103 / 104), bound into attested messages.
    pub cluster_tag: u8,
    pub bump: u8,
    pub _pad0: u8,
    pub result_retention_sec: u32,
    pub _reserved: [u8; 64],
}

fn listed(list: &[Pubkey], key: &Pubkey) -> bool {
    *key != Pubkey::default() && list.contains(key)
}

impl GlobalConfig {
    pub fn is_roller(&self, key: &Pubkey) -> bool {
        listed(&self.rollers, key)
    }

    pub fn is_attestor(&self, key: &Pubkey) -> bool {
        listed(&self.attestors, key)
    }

    /// The Ledger seat index a product authority owns, if it is configured.
    pub fn program_authority_index(&self, key: &Pubkey) -> Option<usize> {
        if *key == Pubkey::default() {
            return None;
        }
        self.program_authorities.iter().position(|a| a == key)
    }

    pub fn redstone_signers(&self) -> &[[u8; 20]] {
        &self.redstone_signers[..usize::from(self.redstone_signer_count).min(MAX_REDSTONE_SIGNERS)]
    }
}
