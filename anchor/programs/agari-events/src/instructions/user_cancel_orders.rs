//! `user_cancel_orders(handles, seat_idx, withdraw)` and `user_cancel_all(seat_idx, max_scan, withdraw)`
//! (events-instructions.md §3.2, §3.4). Any status, any mode (D-009). The token accounts are optional and only
//! required when `withdraw` pays the seat's credit out. `series` is read for the cash unit refunds use (D-020).

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use agari_common::seeds::CONFIG_SEED;

use super::venue_io::{bind_market, bind_tokens, next_seq, MarketSigner, TokenMove};
use crate::constants::MAX_CANCEL_HANDLES;
use crate::errors::EventsError;
use crate::events::{OrderHandle, OrdersCancelled, RemovedRecord};
use crate::matching::orders::{cancel_all, cancel_handles};
use crate::matching::seats::{owned_seat, sweep_credit};
use crate::matching::Venue;
use crate::state::{book_parts_mut, ledger_parts_mut, Book, GlobalConfig, Ledger, Market, RemoveReason, Series};

#[event_cpi]
#[derive(Accounts)]
pub struct UserCancelOrders<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.load()?.bump)]
    pub config: AccountLoader<'info, GlobalConfig>,
    pub series: AccountLoader<'info, Series>,
    #[account(mut)]
    pub market: AccountLoader<'info, Market>,
    #[account(mut)]
    pub book: AccountLoader<'info, Book>,
    #[account(mut)]
    pub ledger: AccountLoader<'info, Ledger>,
    #[account(mut)]
    pub mvault: Option<Box<Account<'info, TokenAccount>>>,
    #[account(mut)]
    pub authority_token: Option<Box<Account<'info, TokenAccount>>>,
    pub collateral_mint: Option<Box<Account<'info, Mint>>>,
    pub token_program: Option<Program<'info, Token>>,
}

enum Scope<'a> {
    Handles(&'a [OrderHandle]),
    All { max_scan: u16 },
}

pub fn user_cancel_orders(ctx: Context<UserCancelOrders>, handles: Vec<OrderHandle>, seat_idx: u16, withdraw: bool) -> Result<()> {
    require!(handles.len() <= MAX_CANCEL_HANDLES, EventsError::InvalidOrderArgs);
    cancel(ctx, Scope::Handles(&handles), seat_idx, withdraw)
}

pub fn user_cancel_all(ctx: Context<UserCancelOrders>, seat_idx: u16, max_scan: u16, withdraw: bool) -> Result<()> {
    cancel(ctx, Scope::All { max_scan }, seat_idx, withdraw)
}

fn cancel(ctx: Context<UserCancelOrders>, scope: Scope, seat_idx: u16, withdraw: bool) -> Result<()> {
    let clock = Clock::get()?;
    let a = &ctx.accounts;
    let authority = a.authority.key();
    let market_key = a.market.key();
    let cash_unit = a.series.load()?.cash_unit;

    let mut market = a.market.load_mut()?;
    let book_info = a.book.to_account_info();
    let mut book_data = book_info.try_borrow_mut_data()?;
    let (book, nodes) = book_parts_mut(&mut book_data)?;
    let ledger_info = a.ledger.to_account_info();
    let mut ledger_data = ledger_info.try_borrow_mut_data()?;
    let (ledger, seats) = ledger_parts_mut(&mut ledger_data)?;
    bind_market(&market_key, &market, Some(&a.series.key()), Some((&a.book.key(), book)), Some((&a.ledger.key(), ledger)), a.mvault.as_ref().map(|m| m.key()).as_ref())?;
    let tokens = match (&a.mvault, &a.authority_token, &a.collateral_mint, &a.token_program) {
        (Some(mvault), Some(token), Some(mint), Some(program)) => {
            bind_tokens(&*a.config.load()?, &mint.key(), &program.key(), token, &authority)?;
            Some((mvault, token, mint, program))
        }
        _ => None,
    };
    let si = owned_seat(ledger, seats, &authority, seat_idx)?;
    require!(!withdraw || tokens.is_some(), EventsError::InvalidOrderArgs);

    let (removed, skipped, reason, withdrawn): (Vec<RemovedRecord>, u8, RemoveReason, u64) = {
        let mut venue = Venue { book, nodes, ledger, seats, market: &mut market, cu: cash_unit, now: clock.unix_timestamp, slot: clock.slot };
        let (removed, skipped, reason) = match scope {
            Scope::Handles(handles) => {
                let (removed, skipped) = cancel_handles(&mut venue, seat_idx, handles)?;
                (removed, skipped, RemoveReason::UserCancel)
            }
            Scope::All { max_scan } => (cancel_all(&mut venue, seat_idx, max_scan)?, 0, RemoveReason::CancelAll),
        };
        let withdrawn = sweep_credit(&mut venue.seats[si], withdraw);
        (removed, skipped, reason, withdrawn)
    };
    let seq = next_seq(&mut market)?;
    let signer = MarketSigner::of(&market);
    drop(market);
    drop(book_data);
    drop(ledger_data);

    if let (Some((mvault, token, mint, program)), true) = (tokens, withdrawn > 0) {
        let (program, mint, mvault, token) = (program.to_account_info(), mint.to_account_info(), mvault.to_account_info(), token.to_account_info());
        let io = TokenMove { token_program: &program, mint: &mint, mvault: &mvault, authority_token: &token, decimals: a.collateral_mint.as_ref().map_or(0, |m| m.decimals) };
        io.pay(&a.market.to_account_info(), &signer.series, signer.index, signer.bump, withdrawn)?;
    }
    emit_cpi!(OrdersCancelled { market: market_key, seq, caller: authority, reason: u8::from(reason), removed, skipped, withdrawn });
    Ok(())
}
