//! `user_mint_complete_set`, `user_merge_complete_set` and `user_withdraw_credit` (events-instructions.md §4.1–§4.3).
//! Mint is Normal-mode and Trading only; merge is Trading only in any mode; withdraw works in every status and
//! mode and pays only the authority's own token account (AD-5).

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use agari_common::seeds::CONFIG_SEED;

use super::venue_io::{bind_market, bind_tokens, next_seq, MarketSigner, TokenMove};
use crate::errors::EventsError;
use crate::events::{CompleteSet, CreditWithdrawn};
use crate::matching::seats::owned_seat;
use crate::matching::sets::{merge_set, mint_set, withdraw_credit, SetOutcome};
use crate::state::{ledger_parts_mut, GlobalConfig, Ledger, Market, MarketStatus, Mode, Series};

#[event_cpi]
#[derive(Accounts)]
pub struct UserCompleteSet<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.load()?.bump)]
    pub config: AccountLoader<'info, GlobalConfig>,
    pub series: AccountLoader<'info, Series>,
    #[account(mut)]
    pub market: AccountLoader<'info, Market>,
    #[account(mut)]
    pub ledger: AccountLoader<'info, Ledger>,
    #[account(mut)]
    pub mvault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub authority_token: Box<Account<'info, TokenAccount>>,
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

pub fn user_mint_complete_set(ctx: Context<UserCompleteSet>, lots: u64, seat_hint: u16, use_credit: bool) -> Result<()> {
    require!(ctx.accounts.config.load()?.mode == u8::from(Mode::Normal), EventsError::InvalidMode);
    complete_set(ctx, true, lots, seat_hint, use_credit)
}

pub fn user_merge_complete_set(ctx: Context<UserCompleteSet>, lots: u64, seat_idx: u16, withdraw: bool) -> Result<()> {
    complete_set(ctx, false, lots, seat_idx, withdraw)
}

fn complete_set(ctx: Context<UserCompleteSet>, minted: bool, lots: u64, seat: u16, flag: bool) -> Result<()> {
    let clock = Clock::get()?;
    let a = &ctx.accounts;
    let authority = a.authority.key();
    let market_key = a.market.key();
    let cash_unit = a.series.load()?.cash_unit;
    let mut market = a.market.load_mut()?;
    let ledger_info = a.ledger.to_account_info();
    let mut ledger_data = ledger_info.try_borrow_mut_data()?;
    let (ledger, seats) = ledger_parts_mut(&mut ledger_data)?;
    bind_market(&market_key, &market, Some(&a.series.key()), None, Some((&a.ledger.key(), ledger)), Some(&a.mvault.key()))?;
    bind_tokens(&*a.config.load()?, &a.collateral_mint.key(), &a.token_program.key(), &a.authority_token, &authority)?;
    require!(market.status(clock.unix_timestamp) == MarketStatus::Trading, EventsError::MarketNotTrading);

    let outcome: SetOutcome = if minted {
        mint_set(ledger, seats, &mut market, cash_unit, &authority, seat, lots, flag)?
    } else {
        owned_seat(ledger, seats, &authority, seat)?;
        merge_set(seats, &mut market, cash_unit, seat, lots, flag)?
    };
    let backing_lots = market.backing_lots;
    let seq = next_seq(&mut market)?;
    let signer = MarketSigner::of(&market);
    drop(market);
    drop(ledger_data);

    let (program, mint, mvault, token) = (a.token_program.to_account_info(), a.collateral_mint.to_account_info(), a.mvault.to_account_info(), a.authority_token.to_account_info());
    let io = TokenMove { token_program: &program, mint: &mint, mvault: &mvault, authority_token: &token, decimals: a.collateral_mint.decimals };
    io.pull(&a.authority.to_account_info(), outcome.funding.transferred_in)?;
    io.pay(&a.market.to_account_info(), &signer.series, signer.index, signer.bump, outcome.withdrawn)?;
    emit_cpi!(CompleteSet {
        market: market_key,
        seq,
        owner: authority,
        seat: outcome.seat,
        minted,
        lots,
        cash: outcome.cash,
        credit_used: outcome.funding.credit_used,
        transferred_in: outcome.funding.transferred_in,
        withdrawn: outcome.withdrawn,
        backing_lots,
    });
    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct UserWithdrawCredit<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.load()?.bump)]
    pub config: AccountLoader<'info, GlobalConfig>,
    #[account(mut)]
    pub market: AccountLoader<'info, Market>,
    #[account(mut)]
    pub ledger: AccountLoader<'info, Ledger>,
    #[account(mut)]
    pub mvault: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub authority_token: Box<Account<'info, TokenAccount>>,
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

pub fn user_withdraw_credit(ctx: Context<UserWithdrawCredit>, seat_idx: u16, amount: u64) -> Result<()> {
    let a = &ctx.accounts;
    let authority = a.authority.key();
    let market_key = a.market.key();
    let mut market = a.market.load_mut()?;
    let ledger_info = a.ledger.to_account_info();
    let mut ledger_data = ledger_info.try_borrow_mut_data()?;
    let (ledger, seats) = ledger_parts_mut(&mut ledger_data)?;
    bind_market(&market_key, &market, None, None, Some((&a.ledger.key(), ledger)), Some(&a.mvault.key()))?;
    bind_tokens(&*a.config.load()?, &a.collateral_mint.key(), &a.token_program.key(), &a.authority_token, &authority)?;
    let si = owned_seat(ledger, seats, &authority, seat_idx)?;
    withdraw_credit(&mut seats[si], amount)?;
    let seq = next_seq(&mut market)?;
    let signer = MarketSigner::of(&market);
    drop(market);
    drop(ledger_data);

    let (program, mint, mvault, token) = (a.token_program.to_account_info(), a.collateral_mint.to_account_info(), a.mvault.to_account_info(), a.authority_token.to_account_info());
    let io = TokenMove { token_program: &program, mint: &mint, mvault: &mvault, authority_token: &token, decimals: a.collateral_mint.decimals };
    io.pay(&a.market.to_account_info(), &signer.series, signer.index, signer.bump, amount)?;
    emit_cpi!(CreditWithdrawn { market: market_key, seq, owner: authority, seat: seat_idx, amount });
    Ok(())
}
