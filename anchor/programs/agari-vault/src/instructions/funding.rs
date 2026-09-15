//! Funding (vault.md §3.2; Masayume `EventVault.sol:46-94`): deposit, withdraw, the private bucket. Deposits pull
//! from a token account the owner signs for; withdrawals pay only the owner's associated token account.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address_with_program_id;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::{ACCOUNT_SEED, CUSTODY_SEED, SEAT, VAULT_CONFIG};
use crate::errors::VaultError;
use crate::events::{Deposited, PrivateMoved, PrivateWithdrawn, Withdrawn};
use crate::state::{VaultAccount, VaultConfig};
use crate::tokens::Collateral;

#[event_cpi]
#[derive(Accounts)]
pub struct OwnerDeposit<'info> {
    pub owner: Signer<'info>,
    #[account(address = VAULT_CONFIG)]
    pub vault_config: AccountLoader<'info, VaultConfig>,
    #[account(mut, seeds = [ACCOUNT_SEED, owner.key().as_ref()], bump = account.load()?.bump)]
    pub account: AccountLoader<'info, VaultAccount>,
    #[account(mut, seeds = [CUSTODY_SEED, owner.key().as_ref()], bump = account.load()?.custody_bump)]
    pub custody: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub owner_ata: Box<Account<'info, TokenAccount>>,
    #[account(address = vault_config.load()?.collateral_mint @ VaultError::WrongCollateral)]
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

/// `owner_withdraw` and `owner_withdraw_private`.
#[event_cpi]
#[derive(Accounts)]
pub struct OwnerWithdraw<'info> {
    pub owner: Signer<'info>,
    #[account(address = VAULT_CONFIG)]
    pub vault_config: AccountLoader<'info, VaultConfig>,
    #[account(mut, seeds = [ACCOUNT_SEED, owner.key().as_ref()], bump = account.load()?.bump)]
    pub account: AccountLoader<'info, VaultAccount>,
    #[account(mut, seeds = [CUSTODY_SEED, owner.key().as_ref()], bump = account.load()?.custody_bump)]
    pub custody: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub owner_ata: Box<Account<'info, TokenAccount>>,
    /// CHECK: the seat PDA, which signs the transfer out of custody.
    #[account(address = SEAT)]
    pub seat: UncheckedAccount<'info>,
    #[account(address = vault_config.load()?.collateral_mint @ VaultError::WrongCollateral)]
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

#[event_cpi]
#[derive(Accounts)]
pub struct OwnerMoveToPrivate<'info> {
    pub owner: Signer<'info>,
    #[account(mut, seeds = [ACCOUNT_SEED, owner.key().as_ref()], bump = account.load()?.bump)]
    pub account: AccountLoader<'info, VaultAccount>,
}

/// Deposit effects shared with `owner_deposit_and_grant`: the checks, the pull, and the new `available`.
pub fn deposit<'info>(owner: &Signer<'info>, account: &AccountLoader<'info, VaultAccount>, custody: &Account<'info, TokenAccount>, owner_ata: &Account<'info, TokenAccount>, mint: &Account<'info, Mint>, token_program: &Program<'info, Token>, amount: u64) -> Result<u64> {
    require!(amount > 0, VaultError::ZeroAmount);
    require_keys_eq!(owner_ata.owner, owner.key(), VaultError::WrongTokenOwner);
    require_keys_eq!(owner_ata.mint, mint.key(), VaultError::WrongCollateral);
    let available = {
        let mut a = account.load_mut()?;
        a.available = a.available.checked_add(amount).ok_or(VaultError::MathOverflow)?;
        a.total_deposited = a.total_deposited.checked_add(amount).ok_or(VaultError::MathOverflow)?;
        a.available
    };
    let (program, mint_info, custody_info) = (token_program.to_account_info(), mint.to_account_info(), custody.to_account_info());
    let io = Collateral { token_program: &program, mint: &mint_info, custody: &custody_info, decimals: mint.decimals };
    io.pull(&owner.to_account_info(), &owner_ata.to_account_info(), amount)?;
    Ok(available)
}

pub fn owner_deposit(ctx: Context<OwnerDeposit>, amount: u64) -> Result<()> {
    let a = &ctx.accounts;
    let available = deposit(&a.owner, &a.account, &a.custody, &a.owner_ata, &a.collateral_mint, &a.token_program, amount)?;
    emit_cpi!(Deposited { owner: a.owner.key(), amount, available });
    Ok(())
}

/// Both withdrawals: `private` picks the bucket. Returns the bucket's new balance.
fn withdraw(a: &OwnerWithdraw, amount: u64, private: bool) -> Result<u64> {
    let owner = a.owner.key();
    // ZeroAmount, then the bucket, then the destination.
    require!(amount > 0, VaultError::ZeroAmount);
    let left = {
        let mut account = a.account.load_mut()?;
        let bucket = if private { &mut account.private_available } else { &mut account.available };
        *bucket = bucket.checked_sub(amount).ok_or(VaultError::Insufficient)?;
        let left = *bucket;
        account.total_withdrawn = account.total_withdrawn.checked_add(amount).ok_or(VaultError::MathOverflow)?;
        left
    };
    let ata = get_associated_token_address_with_program_id(&owner, &a.collateral_mint.key(), &a.token_program.key());
    require!(a.owner_ata.key() == ata && a.owner_ata.owner == owner, VaultError::WrongTokenOwner);

    let seat_bump = a.vault_config.load()?.seat_bump;
    let (program, mint, custody) = (a.token_program.to_account_info(), a.collateral_mint.to_account_info(), a.custody.to_account_info());
    let io = Collateral { token_program: &program, mint: &mint, custody: &custody, decimals: a.collateral_mint.decimals };
    io.pay(&a.seat.to_account_info(), seat_bump, &a.owner_ata.to_account_info(), amount)?;
    Ok(left)
}

pub fn owner_withdraw(ctx: Context<OwnerWithdraw>, amount: u64) -> Result<()> {
    let available = withdraw(&ctx.accounts, amount, false)?;
    emit_cpi!(Withdrawn { owner: ctx.accounts.owner.key(), amount, available });
    Ok(())
}

pub fn owner_withdraw_private(ctx: Context<OwnerWithdraw>, amount: u64) -> Result<()> {
    let private_available = withdraw(&ctx.accounts, amount, true)?;
    emit_cpi!(PrivateWithdrawn { owner: ctx.accounts.owner.key(), amount, private_available });
    Ok(())
}

pub fn owner_move_to_private(ctx: Context<OwnerMoveToPrivate>, amount: u64) -> Result<()> {
    require!(amount > 0, VaultError::ZeroAmount);
    let private_available = {
        let mut account = ctx.accounts.account.load_mut()?;
        account.available = account.available.checked_sub(amount).ok_or(VaultError::Insufficient)?;
        account.private_available = account.private_available.checked_add(amount).ok_or(VaultError::MathOverflow)?;
        account.private_available
    };
    emit_cpi!(PrivateMoved { owner: ctx.accounts.owner.key(), amount, private_available });
    Ok(())
}
