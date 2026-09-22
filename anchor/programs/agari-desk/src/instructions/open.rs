//! `owner_open_desk`, `owner_allow_token`, `owner_disallow_token` (desk.md §4.3). The desk's associated token accounts
//! are created idempotently here, owner paying, so no operator instruction ever needs `init`.

use anchor_lang::prelude::*;
use anchor_spl::associated_token::{self, AssociatedToken, Create};
use anchor_spl::token::{self, Token};
use anchor_spl::token_2022;
use anchor_spl::token_interface::{Mint, TokenInterface};
use core::mem::size_of;

use crate::constants::{is_mode, DESK_CONFIG, DESK_SEED, MAX_TOKENS, TOKEN_DECIMALS};
use crate::errors::DeskError;
use crate::events::{DeskOpened, TokenAllowed, TokenDisallowed};
use crate::state::{Desk, DeskConfig, DeskToken};

#[event_cpi]
#[derive(Accounts)]
pub struct OwnerOpenDesk<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(address = DESK_CONFIG)]
    pub config: AccountLoader<'info, DeskConfig>,
    #[account(init, payer = owner, space = 8 + size_of::<Desk>(), seeds = [DESK_SEED, owner.key().as_ref()], bump)]
    pub desk: AccountLoader<'info, Desk>,
    #[account(address = config.load()?.usdc_mint @ DeskError::WrongMint)]
    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,
    /// CHECK: the desk's USDC associated token account, created idempotently by the ATA program (which checks the derivation).
    #[account(mut)]
    pub desk_usdc: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn owner_open_desk(ctx: Context<OwnerOpenDesk>, operator: Pubkey, per_action_cap: u64, daily_cap: u64, max_premium_bps: u16, mode: u8) -> Result<()> {
    let a = &ctx.accounts;
    require!(per_action_cap > 0 && per_action_cap <= daily_cap && is_mode(mode), DeskError::BadConfig);
    require!(operator != a.owner.key(), DeskError::BadOperator);
    {
        let mut desk = a.desk.load_init()?;
        desk.owner = a.owner.key();
        desk.operator = operator;
        desk.per_action_cap = per_action_cap;
        desk.daily_cap = daily_cap;
        desk.max_premium_bps = max_premium_bps;
        desk.mode = mode;
        desk.bump = ctx.bumps.desk;
    }
    associated_token::create_idempotent(CpiContext::new(
        a.associated_token_program.key(),
        Create {
            payer: a.owner.to_account_info(),
            associated_token: a.desk_usdc.to_account_info(),
            authority: a.desk.to_account_info(),
            mint: a.usdc_mint.to_account_info(),
            system_program: a.system_program.to_account_info(),
            token_program: a.token_program.to_account_info(),
        },
    ))?;
    emit_cpi!(DeskOpened { owner: a.owner.key(), desk: a.desk.key(), operator, per_action_cap, daily_cap, max_premium_bps, mode });
    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct OwnerAllowToken<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(address = DESK_CONFIG)]
    pub config: AccountLoader<'info, DeskConfig>,
    #[account(mut, seeds = [DESK_SEED, owner.key().as_ref()], bump = desk.load()?.bump, has_one = owner @ DeskError::NotOwner)]
    pub desk: AccountLoader<'info, Desk>,
    /// A PreStocks name: Token-2022, 9 decimals, checked in the handler.
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    /// CHECK: the desk's associated token account for `mint`, created idempotently by the ATA program.
    #[account(mut)]
    pub desk_ata: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Adds or re-enables a name (at most 8), and makes sure the desk can hold it.
pub fn owner_allow_token(ctx: Context<OwnerAllowToken>) -> Result<()> {
    let a = &ctx.accounts;
    let mint = a.mint.key();
    require!(a.token_program.key() == token_2022::ID && *a.mint.to_account_info().owner == token_2022::ID, DeskError::BadToken);
    require!(a.mint.decimals == TOKEN_DECIMALS && mint != a.config.load()?.usdc_mint, DeskError::BadToken);
    require!(a.token_program.key() != token::ID, DeskError::BadToken);
    let index = {
        let mut desk = a.desk.load_mut()?;
        let index = match desk.token_index(&mint) {
            Some(i) => i,
            None => {
                let i = desk.free_slot().ok_or(DeskError::TooManyTokens)?;
                require!(usize::from(desk.token_count) < MAX_TOKENS, DeskError::TooManyTokens);
                desk.tokens[i] = DeskToken { mint, enabled: 1, _pad: [0; 7] };
                desk.token_count = desk.token_count.checked_add(1).ok_or(DeskError::MathOverflow)?;
                i
            }
        };
        desk.tokens[index].enabled = 1;
        index
    };
    associated_token::create_idempotent(CpiContext::new(
        a.associated_token_program.key(),
        Create {
            payer: a.owner.to_account_info(),
            associated_token: a.desk_ata.to_account_info(),
            authority: a.desk.to_account_info(),
            mint: a.mint.to_account_info(),
            system_program: a.system_program.to_account_info(),
            token_program: a.token_program.to_account_info(),
        },
    ))?;
    emit_cpi!(TokenAllowed { owner: a.owner.key(), mint, index: index as u8 });
    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct OwnerDisallowToken<'info> {
    pub owner: Signer<'info>,
    #[account(mut, seeds = [DESK_SEED, owner.key().as_ref()], bump = desk.load()?.bump, has_one = owner @ DeskError::NotOwner)]
    pub desk: AccountLoader<'info, Desk>,
    /// CHECK: only its key is read; it must already be configured on the desk.
    pub mint: UncheckedAccount<'info>,
}

/// Blocks buys of a name. Sells stay allowed so the desk can always exit.
pub fn owner_disallow_token(ctx: Context<OwnerDisallowToken>) -> Result<()> {
    let a = &ctx.accounts;
    let mint = a.mint.key();
    {
        let mut desk = a.desk.load_mut()?;
        let index = desk.token_index(&mint).ok_or(DeskError::TokenNotConfigured)?;
        desk.tokens[index].enabled = 0;
    }
    emit_cpi!(TokenDisallowed { owner: a.owner.key(), mint });
    Ok(())
}
