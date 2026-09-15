//! agari-vault: Masayume's EventVault on Solana (plan P§3.2 vault row; spec `docs/plan/specs/vault.md`, D-062…D-064).
//! A Trading Balance per owner in its own custody, typed grants with Masayume's caps, and IOC taps and settlement
//! through the vault's PROGRAM seat in agari-events. Collateral leaves only to the owner (AD-5).
//! This file is dispatch only; logic lives in `instructions/`, `engine`, `caps`, `positions` and `tokens`.

use anchor_lang::prelude::*;

pub mod caps;
pub mod constants;
pub mod engine;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod positions;
pub mod state;
pub mod tokens;

use instructions::*;

declare_id!("84puRVxGcjs7JNcPCVAEkkK6ZFXneEC8yky8RTMzhPi9");

#[program]
pub mod agari_vault {
    use super::*;

    pub fn admin_init_vault(ctx: Context<AdminInitVault>) -> Result<()> {
        instructions::admin_init_vault::admin_init_vault(ctx)
    }

    pub fn owner_open_account(ctx: Context<OwnerOpenAccount>) -> Result<()> {
        instructions::open_account::owner_open_account(ctx)
    }

    pub fn owner_deposit(ctx: Context<OwnerDeposit>, amount: u64) -> Result<()> {
        instructions::funding::owner_deposit(ctx, amount)
    }

    pub fn owner_withdraw(ctx: Context<OwnerWithdraw>, amount: u64) -> Result<()> {
        instructions::funding::owner_withdraw(ctx, amount)
    }

    pub fn owner_move_to_private(ctx: Context<OwnerMoveToPrivate>, amount: u64) -> Result<()> {
        instructions::funding::owner_move_to_private(ctx, amount)
    }

    pub fn owner_withdraw_private(ctx: Context<OwnerWithdraw>, amount: u64) -> Result<()> {
        instructions::funding::owner_withdraw_private(ctx, amount)
    }

    pub fn owner_grant(ctx: Context<OwnerGrant>, grant_id: u64, kind: u8, actor: Pubkey, caps: CapsArgs, expires_at_sec: i64, budget: u64) -> Result<()> {
        instructions::grants::owner_grant(ctx, Terms { grant_id, kind, actor, caps, expires_at_sec, budget })
    }

    #[allow(clippy::too_many_arguments)]
    pub fn owner_deposit_and_grant(
        ctx: Context<OwnerDepositAndGrant>,
        amount: u64,
        grant_id: u64,
        kind: u8,
        actor: Pubkey,
        caps: CapsArgs,
        expires_at_sec: i64,
        budget: u64,
    ) -> Result<()> {
        instructions::grants::owner_deposit_and_grant(ctx, amount, Terms { grant_id, kind, actor, caps, expires_at_sec, budget })
    }

    pub fn owner_fund_grant(ctx: Context<OwnerManageGrant>, amount: u64) -> Result<()> {
        instructions::grants::owner_fund_grant(ctx, amount)
    }

    pub fn owner_revoke(ctx: Context<OwnerManageGrant>) -> Result<()> {
        instructions::grants::owner_revoke(ctx)
    }

    pub fn owner_place(ctx: Context<OwnerPlace>, outcome: u8, is_buy: bool, price_ticks: u16, lots: u64, expire_ts: i64) -> Result<()> {
        instructions::place::owner_place(ctx, outcome, is_buy, price_ticks, lots, expire_ts)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn actor_place_for(
        ctx: Context<ActorPlaceFor>,
        grant_id: u64,
        outcome: u8,
        is_buy: bool,
        price_ticks: u16,
        lots: u64,
        expire_ts: i64,
    ) -> Result<()> {
        instructions::place::actor_place_for(ctx, grant_id, outcome, is_buy, price_ticks, lots, expire_ts)
    }

    pub fn public_crank_settle(ctx: Context<PublicCrankSettle>) -> Result<()> {
        instructions::crank::public_crank_settle(ctx)
    }
}
