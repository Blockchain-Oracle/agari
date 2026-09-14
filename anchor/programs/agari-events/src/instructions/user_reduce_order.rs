//! `user_reduce_order(handle, seat_idx, new_lots)` (events-instructions.md §3.3) and `public_sweep_expired(max)`
//! (§3.5). Both work in every status and mode (D-009). The sweep reads `series` for the refund cash unit (D-020).

use anchor_lang::prelude::*;

use super::venue_io::{bind_market, next_seq};
use crate::errors::EventsError;
use crate::events::{OrderHandle, OrderReduced, OrdersCancelled};
use crate::matching::orders::{reduce_order, sweep_expired};
use crate::matching::seats::owned_seat;
use crate::matching::Venue;
use crate::state::{book_parts_mut, ledger_parts_mut, Book, Ledger, Market, RemoveReason, Series};

#[event_cpi]
#[derive(Accounts)]
pub struct UserReduceOrder<'info> {
    pub authority: Signer<'info>,
    pub series: AccountLoader<'info, Series>,
    #[account(mut)]
    pub market: AccountLoader<'info, Market>,
    #[account(mut)]
    pub book: AccountLoader<'info, Book>,
    #[account(mut)]
    pub ledger: AccountLoader<'info, Ledger>,
}

pub fn user_reduce_order(ctx: Context<UserReduceOrder>, handle: OrderHandle, seat_idx: u16, new_lots: u64) -> Result<()> {
    let clock = Clock::get()?;
    let a = &ctx.accounts;
    let authority = a.authority.key();
    let market_key = a.market.key();
    let (cash_unit, min_lots) = {
        let s = a.series.load()?;
        (s.cash_unit, s.min_lots)
    };
    let mut market = a.market.load_mut()?;
    let book_info = a.book.to_account_info();
    let mut book_data = book_info.try_borrow_mut_data()?;
    let (book, nodes) = book_parts_mut(&mut book_data)?;
    let ledger_info = a.ledger.to_account_info();
    let mut ledger_data = ledger_info.try_borrow_mut_data()?;
    let (ledger, seats) = ledger_parts_mut(&mut ledger_data)?;
    bind_market(&market_key, &market, Some(&a.series.key()), Some((&a.book.key(), book)), Some((&a.ledger.key(), ledger)), None)?;
    owned_seat(ledger, seats, &authority, seat_idx)?;

    let (old_lots, kind, price) = {
        let mut venue = Venue { book, nodes, ledger, seats, market: &mut market, cu: cash_unit, now: clock.unix_timestamp, slot: clock.slot };
        reduce_order(&mut venue, seat_idx, handle, new_lots, min_lots)?
    };
    let seq = next_seq(&mut market)?;
    emit_cpi!(OrderReduced { market: market_key, seq, owner: authority, seat: seat_idx, handle, kind, price, old_lots, new_lots });
    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct PublicSweepExpired<'info> {
    pub series: AccountLoader<'info, Series>,
    #[account(mut)]
    pub market: AccountLoader<'info, Market>,
    #[account(mut)]
    pub book: AccountLoader<'info, Book>,
    #[account(mut)]
    pub ledger: AccountLoader<'info, Ledger>,
}

pub fn public_sweep_expired(ctx: Context<PublicSweepExpired>, max: u8) -> Result<()> {
    let clock = Clock::get()?;
    let a = &ctx.accounts;
    let market_key = a.market.key();
    let cash_unit = a.series.load()?.cash_unit;
    let mut market = a.market.load_mut()?;
    let book_info = a.book.to_account_info();
    let mut book_data = book_info.try_borrow_mut_data()?;
    let (book, nodes) = book_parts_mut(&mut book_data)?;
    let ledger_info = a.ledger.to_account_info();
    let mut ledger_data = ledger_info.try_borrow_mut_data()?;
    let (ledger, seats) = ledger_parts_mut(&mut ledger_data)?;
    bind_market(&market_key, &market, Some(&a.series.key()), Some((&a.book.key(), book)), Some((&a.ledger.key(), ledger)), None)?;
    require!((1..=32).contains(&max), EventsError::InvalidOrderArgs);

    let drain_all = market.is_terminal() || clock.unix_timestamp >= market.lock_at;
    let removed = {
        let mut venue = Venue { book, nodes, ledger, seats, market: &mut market, cu: cash_unit, now: clock.unix_timestamp, slot: clock.slot };
        sweep_expired(&mut venue, max, drain_all)?
    };
    if removed.is_empty() {
        return Ok(());
    }
    let seq = next_seq(&mut market)?;
    emit_cpi!(OrdersCancelled { market: market_key, seq, caller: Pubkey::default(), reason: u8::from(RemoveReason::Sweep), removed, skipped: 0, withdrawn: 0 });
    Ok(())
}
