//! The season prize pool: the payout rail for a season's standings, which live off chain. Anyone may fund it; funds
//! leave only through one single-shot distribution or the admin's withdrawal of what is left.

use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{MAX_SEASON_ID_LEN, MAX_SEASON_WINNERS, SEASON_SEED, SEASON_VAULT_SEED};
use crate::errors::ArenaError;
use crate::events::{SeasonCreated, SeasonDeposited, SeasonDistributed, SeasonRemainderWithdrawn};
use crate::state::SeasonPool;

#[derive(Accounts)]
#[instruction(season_id: String)]
pub struct AdminCreateSeason<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + SeasonPool::INIT_SPACE, seeds = [SEASON_SEED, season_id.as_bytes()], bump)]
    pub season: Box<Account<'info, SeasonPool>>,
    /// The pool's own money. Its authority is the season account, which only this program can sign for.
    #[account(init, payer = admin, seeds = [SEASON_VAULT_SEED, season.key().as_ref()], bump, token::mint = collateral_mint, token::authority = season)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn admin_create_season(ctx: Context<AdminCreateSeason>, season_id: String, ends_at_sec: i64) -> Result<()> {
    require!(!season_id.is_empty() && season_id.len() <= MAX_SEASON_ID_LEN, ArenaError::BadParams);
    let season = &mut ctx.accounts.season;
    season.admin = ctx.accounts.admin.key();
    season.collateral_mint = ctx.accounts.collateral_mint.key();
    season.season_id = season_id.clone();
    season.ends_at_sec = ends_at_sec;
    season.distributed = false;
    season.deposited_base = 0;
    season.bump = ctx.bumps.season;
    season.vault_bump = ctx.bumps.vault;
    emit!(SeasonCreated { season: season.key(), season_id, ends_at_sec });
    Ok(())
}

#[derive(Accounts)]
pub struct PublicDepositSeason<'info> {
    pub from: Signer<'info>,
    #[account(mut, seeds = [SEASON_SEED, season.season_id.as_bytes()], bump = season.bump)]
    pub season: Box<Account<'info, SeasonPool>>,
    #[account(mut, seeds = [SEASON_VAULT_SEED, season.key().as_ref()], bump = season.vault_bump)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = collateral_mint, token::authority = from)]
    pub from_token: InterfaceAccount<'info, TokenAccount>,
    #[account(address = season.collateral_mint @ ArenaError::WrongCollateral)]
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

/// Top the pool up. Anyone may: funding is always safe.
pub fn public_deposit_season(ctx: Context<PublicDepositSeason>, amount_base: u64) -> Result<()> {
    require!(amount_base > 0, ArenaError::ZeroAmount);
    let a = &mut *ctx.accounts;
    transfer_checked(
        CpiContext::new(a.token_program.key(), TransferChecked { from: a.from_token.to_account_info(), mint: a.collateral_mint.to_account_info(), to: a.vault.to_account_info(), authority: a.from.to_account_info() }),
        amount_base,
        a.collateral_mint.decimals,
    )?;
    a.season.deposited_base = a.season.deposited_base.checked_add(amount_base).ok_or(ArenaError::MathOverflow)?;
    a.vault.reload()?;
    emit!(SeasonDeposited { season: a.season.key(), from: a.from.key(), amount_base, balance_base: a.vault.amount });
    Ok(())
}

#[derive(Accounts)]
pub struct AdminSeason<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [SEASON_SEED, season.season_id.as_bytes()], bump = season.bump, has_one = admin @ ArenaError::NotAdmin)]
    pub season: Box<Account<'info, SeasonPool>>,
    #[account(mut, seeds = [SEASON_VAULT_SEED, season.key().as_ref()], bump = season.vault_bump)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(address = season.collateral_mint @ ArenaError::WrongCollateral)]
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

fn pay_from_vault<'info>(a: &AdminSeason<'info>, to: &AccountInfo<'info>, amount_base: u64) -> Result<()> {
    if amount_base == 0 {
        return Ok(());
    }
    let bump = [a.season.bump];
    let seeds: &[&[u8]] = &[SEASON_SEED, a.season.season_id.as_bytes(), &bump];
    transfer_checked(
        CpiContext::new_with_signer(a.token_program.key(), TransferChecked { from: a.vault.to_account_info(), mint: a.collateral_mint.to_account_info(), to: to.clone(), authority: a.season.to_account_info() }, &[seeds]),
        amount_base,
        a.collateral_mint.decimals,
    )
}

/// Pay each winner their amount, then lock the pool. Admin-only, single-shot. The winners' token accounts follow the
/// named accounts, one per amount; a zero amount is skipped. Any leftover stays for `admin_withdraw_season_remainder`.
pub fn admin_distribute_season<'info>(ctx: Context<'info, AdminSeason<'info>>, amounts_base: Vec<u64>) -> Result<()> {
    let winners = ctx.remaining_accounts;
    let a = &mut *ctx.accounts;
    require!(!a.season.distributed, ArenaError::AlreadyDistributed);
    require!(!amounts_base.is_empty() && amounts_base.len() == winners.len() && winners.len() <= MAX_SEASON_WINNERS, ArenaError::BadWinners);
    let total = amounts_base.iter().try_fold(0u64, |sum, v| sum.checked_add(*v)).ok_or(ArenaError::MathOverflow)?;
    require!(total <= a.vault.amount, ArenaError::InsufficientPool);
    // Locked before a unit moves, so a distribution can never be replayed.
    a.season.distributed = true;
    for (to, amount_base) in winners.iter().zip(&amounts_base) {
        pay_from_vault(a, to, *amount_base)?;
    }
    emit!(SeasonDistributed { season: a.season.key(), total_base: total, winners: winners.len() as u8 });
    Ok(())
}

/// Recover what is left: a cancelled season, an over-funded pool, dust after a distribution. The safety hatch that
/// means funds are never stuck. The destination is the one token account handed in after the named accounts.
pub fn admin_withdraw_season_remainder<'info>(ctx: Context<'info, AdminSeason<'info>>) -> Result<()> {
    let to = ctx.remaining_accounts.first().ok_or(ArenaError::BadWinners)?;
    let a = &mut *ctx.accounts;
    let amount_base = a.vault.amount;
    pay_from_vault(a, to, amount_base)?;
    emit!(SeasonRemainderWithdrawn { season: a.season.key(), amount_base });
    Ok(())
}
