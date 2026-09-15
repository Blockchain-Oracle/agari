//! `owner_open_account()` (vault.md §3.2): the owner pays the rent of their VaultAccount and custody once. The
//! custody is an SPL token account owned by the seat PDA, so the engine's `authority_token.owner == authority`
//! check holds when the seat trades from it.

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use core::mem::size_of;

use crate::constants::{ACCOUNT_SEED, CUSTODY_SEED, SEAT, VAULT_CONFIG};
use crate::errors::VaultError;
use crate::events::AccountOpened;
use crate::state::{VaultAccount, VaultConfig};

#[event_cpi]
#[derive(Accounts)]
pub struct OwnerOpenAccount<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(address = VAULT_CONFIG)]
    pub vault_config: AccountLoader<'info, VaultConfig>,
    #[account(init, payer = owner, space = 8 + size_of::<VaultAccount>(), seeds = [ACCOUNT_SEED, owner.key().as_ref()], bump)]
    pub account: AccountLoader<'info, VaultAccount>,
    #[account(
        init,
        payer = owner,
        seeds = [CUSTODY_SEED, owner.key().as_ref()],
        bump,
        token::mint = collateral_mint,
        token::authority = seat,
        token::token_program = token_program,
    )]
    pub custody: Box<Account<'info, TokenAccount>>,
    /// CHECK: the vault's seat PDA, set as the custody's owner.
    #[account(address = SEAT)]
    pub seat: UncheckedAccount<'info>,
    #[account(address = vault_config.load()?.collateral_mint @ VaultError::WrongCollateral)]
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn owner_open_account(ctx: Context<OwnerOpenAccount>) -> Result<()> {
    let a = &ctx.accounts;
    let mut account = a.account.load_init()?;
    account.owner = a.owner.key();
    account.custody_bump = ctx.bumps.custody;
    account.bump = ctx.bumps.account;
    drop(account);
    emit_cpi!(AccountOpened { owner: a.owner.key(), custody: a.custody.key() });
    Ok(())
}
