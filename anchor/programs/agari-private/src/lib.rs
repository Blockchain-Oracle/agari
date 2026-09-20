//! agari-private: Masayume's PrivateDesk on Solana. Link-private bets on the venue's Windows: a budget only its
//! owner can withdraw, a throwaway slot per bet, and a pool in between that neither half names.
//!
//! An owner deposits and sets an allowance the desk may spend. A bet is then three transactions from the desk key,
//! never fewer: `desk_charge_to_pool` names the owner and an opaque key; `desk_fund_slot` names the slot;
//! `desk_mint_in_slot` names the slot and the market. Settlement is permissionless. The way home is the same split
//! in reverse: `desk_sweep_slot_to_pool` names the slot, `desk_credit_from_pool` names the owner and another opaque
//! key. Only the owner's own `owner_withdraw` ever pays out, and only to the signer. No instruction, account or event
//! holds an owner and a slot at the same time.
//!
//! What this is NOT: anonymity. A charge and a fund land seconds apart for the same figure, signed by the same desk
//! key, and a determined observer can line them up; the desk process sees both halves while it works. What the desk
//! can take is bounded by the allowance an owner sets, and the pool it could misdirect holds only what was just
//! charged or just won. The claim of ownership is the desk's signed ticket, held by the owner alone.
//!
//! The desk trades as a PROGRAM seat of agari-events (`program_authorities[3]`, D-063), so every slot's contracts
//! sit pooled in one seat and a settlement redeems exactly one slot's lots.

use anchor_lang::prelude::*;

pub mod constants;
pub mod engine;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;
use state::PrivateParams;

declare_id!("6qjoqeiGt8K5RoYvsRCDoS4QsDXrsPAZjHwy4vU98d9j");

#[program]
pub mod agari_private {
    use super::*;

    pub fn admin_init_desk(ctx: Context<AdminInitDesk>, desk: Pubkey, params: PrivateParams) -> Result<()> {
        instructions::admin::admin_init_desk(ctx, desk, params)
    }

    pub fn admin_set_desk(ctx: Context<AdminOnly>, desk: Pubkey) -> Result<()> {
        instructions::admin::admin_set_desk(ctx, desk)
    }

    pub fn admin_set_params(ctx: Context<AdminOnly>, params: PrivateParams) -> Result<()> {
        instructions::admin::admin_set_params(ctx, params)
    }

    pub fn admin_set_paused(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        instructions::admin::admin_set_paused(ctx, paused)
    }

    pub fn owner_deposit_and_allow(ctx: Context<OwnerFunds>, amount_base: u64, allowance_base: u64) -> Result<()> {
        instructions::owner::owner_deposit_and_allow(ctx, amount_base, allowance_base)
    }

    pub fn owner_allow(ctx: Context<OwnerAllow>, allowance_base: u64) -> Result<()> {
        instructions::owner::owner_allow(ctx, allowance_base)
    }

    pub fn owner_revoke(ctx: Context<OwnerAllow>) -> Result<()> {
        instructions::owner::owner_revoke(ctx)
    }

    pub fn owner_withdraw(ctx: Context<OwnerFunds>, amount_base: u64) -> Result<()> {
        instructions::owner::owner_withdraw(ctx, amount_base)
    }

    pub fn desk_charge_to_pool(ctx: Context<DeskChargeToPool>, amount_base: u64, charge_key: [u8; 32]) -> Result<()> {
        instructions::open::desk_charge_to_pool(ctx, amount_base, charge_key)
    }

    pub fn desk_fund_slot(ctx: Context<DeskFundSlot>, slot_id: [u8; 32], amount_base: u64) -> Result<()> {
        instructions::open::desk_fund_slot(ctx, slot_id, amount_base)
    }

    pub fn desk_mint_in_slot(ctx: Context<DeskMintInSlot>, slot_id: [u8; 32], outcome: u8, min_lots: u64) -> Result<()> {
        instructions::open::desk_mint_in_slot(ctx, slot_id, outcome, min_lots)
    }

    pub fn public_settle_slot(ctx: Context<PublicSettleSlot>, slot_id: [u8; 32]) -> Result<()> {
        instructions::home::public_settle_slot(ctx, slot_id)
    }

    pub fn desk_sweep_slot_to_pool(ctx: Context<DeskSweepSlot>, slot_id: [u8; 32]) -> Result<()> {
        instructions::home::desk_sweep_slot_to_pool(ctx, slot_id)
    }

    pub fn desk_credit_from_pool(ctx: Context<DeskCreditFromPool>, amount_base: u64, credit_key: [u8; 32]) -> Result<()> {
        instructions::home::desk_credit_from_pool(ctx, amount_base, credit_key)
    }
}
