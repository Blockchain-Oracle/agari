//! `owner_deposit` and `owner_withdraw` (desk.md §4.3). Deposits pull from a token account the owner signs for, into
//! the desk's associated account of that mint. Withdrawals pay only the owner's associated token account, signed by
//! the desk PDA, for any mint the desk holds, and are never blocked: not by pause, caps, the band, a stale
//! reference or a revoked operator. No other destination exists in the program.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::get_associated_token_address_with_program_id;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::constants::{DESK_CONFIG, DESK_SEED};
use crate::errors::DeskError;
use crate::events::{Deposited, Withdrawn};
use crate::state::{Desk, DeskConfig};

#[event_cpi]
#[derive(Accounts)]
pub struct OwnerDeposit<'info> {
    pub owner: Signer<'info>,
    #[account(address = DESK_CONFIG)]
    pub config: AccountLoader<'info, DeskConfig>,
    #[account(seeds = [DESK_SEED, owner.key().as_ref()], bump = desk.load()?.bump, has_one = owner @ DeskError::NotOwner)]
    pub desk: AccountLoader<'info, Desk>,
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, token::mint = mint, token::authority = owner, token::token_program = token_program)]
    pub owner_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = desk, associated_token::token_program = token_program)]
    pub desk_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
}

/// USDC or a configured name only, so the desk never holds what it cannot value. The mint's own transfer fee applies
/// (100 bps on a PreStocks name); the program never reads or trusts the arriving amount.
pub fn owner_deposit(ctx: Context<OwnerDeposit>, amount: u64) -> Result<()> {
    let a = &ctx.accounts;
    require!(amount > 0, DeskError::ZeroAmount);
    let mint = a.mint.key();
    require!(mint == a.config.load()?.usdc_mint || a.desk.load()?.token_index(&mint).is_some(), DeskError::TokenNotConfigured);
    token_interface::transfer_checked(
        CpiContext::new(
            a.token_program.key(),
            TransferChecked { from: a.owner_token.to_account_info(), mint: a.mint.to_account_info(), to: a.desk_ata.to_account_info(), authority: a.owner.to_account_info() },
        ),
        amount,
        a.mint.decimals,
    )?;
    emit_cpi!(Deposited { owner: a.owner.key(), mint, amount });
    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct OwnerWithdraw<'info> {
    pub owner: Signer<'info>,
    #[account(seeds = [DESK_SEED, owner.key().as_ref()], bump = desk.load()?.bump, has_one = owner @ DeskError::NotOwner)]
    pub desk: AccountLoader<'info, Desk>,
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = desk, associated_token::token_program = token_program)]
    pub desk_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    /// The owner's associated token account of `mint`, and nothing else (checked in the handler).
    #[account(mut)]
    pub owner_ata: Box<InterfaceAccount<'info, TokenAccount>>,
    pub token_program: Interface<'info, TokenInterface>,
}

/// `u64::MAX` means the whole balance at that moment, so "sell everything, then send me all of it" fits one transaction.
pub fn owner_withdraw(ctx: Context<OwnerWithdraw>, amount: u64) -> Result<()> {
    let a = &ctx.accounts;
    let owner = a.owner.key();
    let mint = a.mint.key();
    let amount = if amount == u64::MAX { a.desk_ata.amount } else { amount };
    require!(amount > 0, DeskError::ZeroAmount);
    let ata = get_associated_token_address_with_program_id(&owner, &mint, &a.token_program.key());
    require!(a.owner_ata.key() == ata && a.owner_ata.owner == owner && a.owner_ata.mint == mint, DeskError::WrongTokenOwner);
    let bump = [a.desk.load()?.bump];
    let seeds: &[&[u8]] = &[DESK_SEED, owner.as_ref(), &bump];
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            a.token_program.key(),
            TransferChecked { from: a.desk_ata.to_account_info(), mint: a.mint.to_account_info(), to: a.owner_ata.to_account_info(), authority: a.desk.to_account_info() },
            &[seeds],
        ),
        amount,
        a.mint.decimals,
    )?;
    emit_cpi!(Withdrawn { owner, mint, amount });
    Ok(())
}
