//! `operator_buy` and `operator_sell` (desk.md §4.5), the checks in the spec's order. The route is an operator
//! argument (opaque bytes plus remaining accounts), so what the program pins is the outcome: the exact spend, at
//! least the band floor back, and no token account of the desk's slipped into the route.

use anchor_lang::prelude::*;
use anchor_spl::token::Token;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

use super::swap_rules::{common_checks, invoke_router, premium_reference, require_no_leak};
use crate::chain;
use crate::constants::{DESK_CONFIG, DESK_REF_SEED, DESK_SEED};
use crate::errors::DeskError;
use crate::events::{Bought, Sold};
use crate::guard::{buy_floor, counted, effective_min_out, premium_ok, sell_floor, sell_oracle_value, spend};
use crate::reference::require_fresh;
use crate::state::{Desk, DeskConfig, DeskRef};

/// Shared by buy and sell. The route's accounts follow as remaining accounts.
#[event_cpi]
#[derive(Accounts)]
pub struct OperatorSwap<'info> {
    pub operator: Signer<'info>,
    /// CHECK: the desk's owner, bound by the desk's seeds and `has_one`; only its key is read.
    pub owner: UncheckedAccount<'info>,
    #[account(address = DESK_CONFIG)]
    pub config: AccountLoader<'info, DeskConfig>,
    #[account(mut, seeds = [DESK_SEED, owner.key().as_ref()], bump = desk.load()?.bump, has_one = owner @ DeskError::NotOwner)]
    pub desk: AccountLoader<'info, Desk>,
    #[account(address = config.load()?.usdc_mint @ DeskError::WrongMint)]
    pub usdc_mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = desk, associated_token::token_program = usdc_token_program)]
    pub desk_usdc: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = token_mint, associated_token::authority = desk, associated_token::token_program = token_program)]
    pub desk_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(seeds = [DESK_REF_SEED, token_mint.key().as_ref()], bump = desk_ref.load()?.bump)]
    pub desk_ref: AccountLoader<'info, DeskRef>,
    /// CHECK: address-constrained to the configured router; its instruction data is opaque to this program.
    #[account(address = config.load()?.swap_program @ DeskError::WrongSwapProgram)]
    pub swap_program: UncheckedAccount<'info>,
    pub usdc_token_program: Program<'info, Token>,
    pub token_program: Interface<'info, TokenInterface>,
    /// Pyth's `Equity.Index` update for this name; required only when the owner set `require_pyth_index`.
    pub price_update: Option<Account<'info, PriceUpdateV2>>,
}

pub fn operator_buy<'info>(ctx: Context<'info, OperatorSwap<'info>>, usdc_in: u64, min_token_out: u64, deadline_sec: i64, decision_hash: [u8; 32], swap_data: Vec<u8>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &ctx.accounts;
    let mint = a.token_mint.key();
    // Steps 1–10.
    let (owner, bump, token_price_e8, reference_e8, reference_source, floor) = {
        let mut desk = a.desk.load_mut()?;
        common_checks(&desk, &a.operator.key(), &decision_hash, usdc_in, deadline_sec, now)?;
        let index = desk.token_index(&mint).ok_or(DeskError::TokenNotConfigured)?;
        require!(desk.tokens[index].enabled != 0, DeskError::TokenNotEnabled);
        let r = a.desk_ref.load()?;
        require_fresh(r.fetched_at_sec, now)?;
        let (reference_e8, source) = premium_reference(&desk, &r, a.price_update.as_ref(), now)?;
        require!(premium_ok(r.token_price_e8, reference_e8, desk.max_premium_bps), DeskError::PremiumTooHigh);
        spend(&mut desk, usdc_in, now)?;
        let floor = buy_floor(usdc_in, r.multiplier_e12, r.token_price_e8)?;
        (desk.owner, desk.bump, r.token_price_e8, reference_e8, source, floor)
    };
    let min_out = effective_min_out(min_token_out, floor);
    // Steps 11–12.
    let (usdc_before, token_before) = (a.desk_usdc.amount, a.desk_token.amount);
    invoke_router(&a.swap_program.to_account_info(), ctx.remaining_accounts, &a.desk.key(), &owner, bump, swap_data)?;
    // Step 13: trust balances, not return values.
    ctx.accounts.desk_usdc.reload()?;
    ctx.accounts.desk_token.reload()?;
    let a = &ctx.accounts;
    let spent = usdc_before.checked_sub(a.desk_usdc.amount).ok_or(DeskError::UnexpectedSpend)?;
    require!(spent == usdc_in, DeskError::UnexpectedSpend);
    let token_out = a.desk_token.amount.checked_sub(token_before).ok_or(DeskError::NothingReceived)?;
    require!(token_out > 0, DeskError::NothingReceived);
    require!(token_out >= min_out, DeskError::BelowOracleFloor);
    // Step 14.
    require_no_leak(ctx.remaining_accounts, &a.desk.key(), [&a.desk_usdc.key(), &a.desk_token.key()])?;
    // Steps 15–16.
    let (seq, head) = {
        let mut desk = a.desk.load_mut()?;
        let seq = chain::seal(&mut desk, &decision_hash)?;
        (seq, desk.head)
    };
    emit_cpi!(Bought { owner, seq, mint, usdc_in, token_out, token_price_e8, reference_e8, reference_source, decision_hash, head });
    Ok(())
}

pub fn operator_sell<'info>(ctx: Context<'info, OperatorSwap<'info>>, token_in: u64, min_usdc_out: u64, deadline_sec: i64, decision_hash: [u8; 32], swap_data: Vec<u8>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &ctx.accounts;
    let mint = a.token_mint.key();
    // Steps 1–7, then the early per-action check on the attested value (before anything moves), no premium check.
    let (owner, bump, token_price_e8, oracle_value) = {
        let desk = a.desk.load()?;
        common_checks(&desk, &a.operator.key(), &decision_hash, token_in, deadline_sec, now)?;
        require!(desk.token_index(&mint).is_some(), DeskError::TokenNotConfigured);
        let r = a.desk_ref.load()?;
        require_fresh(r.fetched_at_sec, now)?;
        let oracle_value = sell_oracle_value(token_in, r.multiplier_e12, r.token_price_e8)?;
        require!(oracle_value <= desk.per_action_cap, DeskError::OverPerActionCap);
        (desk.owner, desk.bump, r.token_price_e8, oracle_value)
    };
    let min_out = effective_min_out(min_usdc_out, sell_floor(oracle_value)?);
    let (usdc_before, token_before) = (a.desk_usdc.amount, a.desk_token.amount);
    invoke_router(&a.swap_program.to_account_info(), ctx.remaining_accounts, &a.desk.key(), &owner, bump, swap_data)?;
    ctx.accounts.desk_usdc.reload()?;
    ctx.accounts.desk_token.reload()?;
    let a = &ctx.accounts;
    // The gross amount leaves the desk: the transfer fee is the route's problem, not the post-check's.
    let sent = token_before.checked_sub(a.desk_token.amount).ok_or(DeskError::UnexpectedSpend)?;
    require!(sent == token_in, DeskError::UnexpectedSpend);
    let usdc_out = a.desk_usdc.amount.checked_sub(usdc_before).ok_or(DeskError::NothingReceived)?;
    require!(usdc_out > 0, DeskError::NothingReceived);
    require!(usdc_out >= min_out, DeskError::BelowOracleFloor);
    require_no_leak(ctx.remaining_accounts, &a.desk.key(), [&a.desk_usdc.key(), &a.desk_token.key()])?;
    // The caps count the larger of what came back and the attested value, then the chain advances.
    let counted_usdc = counted(usdc_out, oracle_value);
    let (seq, head) = {
        let mut desk = a.desk.load_mut()?;
        spend(&mut desk, counted_usdc, now)?;
        let seq = chain::seal(&mut desk, &decision_hash)?;
        (seq, desk.head)
    };
    emit_cpi!(Sold { owner, seq, mint, token_in, usdc_out, token_price_e8, counted_usdc, decision_hash, head });
    Ok(())
}
