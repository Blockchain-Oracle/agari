//! `public_copy_open_from_prev` (prints.md §4.5): a back-to-back Window's opening print is its predecessor's closing
//! print at the same instant, from the same Series and policy version, so it's copied instead of re-proven.

use anchor_lang::prelude::*;

use super::print_rules::window_version;
use crate::errors::EventsError;
use crate::events::PrintRecorded;
use crate::state::{Market, Print, Series, Which, PRINT_FLAG_COPIED_FROM_PREV};

#[event_cpi]
#[derive(Accounts)]
pub struct PublicCopyOpenFromPrev<'info> {
    pub series: AccountLoader<'info, Series>,
    #[account(mut)]
    pub market: AccountLoader<'info, Market>,
    pub prev_market: AccountLoader<'info, Market>,
}

fn copied_event(market: Pubkey, seq: u64, which: Which, print: &Print, now: i64) -> PrintRecorded {
    PrintRecorded {
        market,
        seq,
        which: u8::from(which),
        source: print.source,
        price: print.price,
        expo: print.expo,
        source_ts: print.source_ts,
        signers: print.signers,
        copied: true,
        recorded_ts: now,
    }
}

pub fn public_copy_open_from_prev(ctx: Context<PublicCopyOpenFromPrev>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &ctx.accounts;
    // Compare keys before loading: the same account as both Markets would otherwise fail on the borrow, not the rule.
    require_keys_neq!(a.prev_market.key(), a.market.key(), EventsError::PrintNotAdjacent);
    let series = a.series.load()?;
    let prev = a.prev_market.load()?;
    let mut market = a.market.load_mut()?;

    // 1. Bindings.
    require_keys_eq!(market.series, a.series.key(), EventsError::SeriesMarketMismatch);
    require_keys_eq!(prev.series, a.series.key(), EventsError::PrintNotAdjacent);
    // 2. Not terminal, open slot empty.
    require!(!market.is_terminal(), EventsError::MarketAlreadyTerminal);
    require!(market.open.is_empty(), EventsError::PrintAlreadyRecorded);
    // 3. PD-6: the copy is a print, admitted only until the open deadline.
    require!(now <= market.open_deadline, EventsError::PrintTooLate);
    // 4. Adjacent and on the same version (a Friday close never becomes a Monday open).
    require!(prev.expiry == market.trading_start && prev.policy_version == market.policy_version, EventsError::PrintNotAdjacent);
    // 5. The predecessor's close exists.
    require!(!prev.close.is_empty(), EventsError::PrintsMissing);

    let mut events = Vec::with_capacity(2);
    let mut open = prev.close;
    open.flags |= PRINT_FLAG_COPIED_FROM_PREV;
    market.open = open;
    let seq = market.next_seq().ok_or(error!(EventsError::MathOverflow))?;
    events.push(copied_event(a.market.key(), seq, Which::Open, &open, now));

    let version = window_version(&series, &market)?;
    let check_deadline = market.trading_start.checked_add(i64::from(version.check_admission_sec)).ok_or(error!(EventsError::MathOverflow))?;
    if !prev.check_close.is_empty() && market.check_open.is_empty() && now <= check_deadline {
        let mut check = prev.check_close;
        check.flags |= PRINT_FLAG_COPIED_FROM_PREV;
        market.check_open = check;
        let seq = market.next_seq().ok_or(error!(EventsError::MathOverflow))?;
        events.push(copied_event(a.market.key(), seq, Which::CheckOpen, &check, now));
    }
    drop(market);
    drop(prev);
    drop(series);
    for event in events {
        emit_cpi!(event);
    }
    Ok(())
}
