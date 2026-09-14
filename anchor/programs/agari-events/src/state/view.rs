//! Typed engine views for products (events-accounts.md §6): `agari_common::view::load_checked` plus the
//! market ⇄ book ⇄ ledger ⇄ series bindings, returning engine error codes.

use anchor_lang::{error::ErrorCode, prelude::*};
use core::cell::Ref;

use agari_common::view::{bound_both_ways, load_checked};

use super::{book::Book, ledger::Ledger, market::Market, result::MarketResult, series::Series};
use crate::errors::EventsError;

pub fn load_market<'a>(market: &'a AccountInfo, series: Option<&AccountInfo>) -> Result<Ref<'a, Market>> {
    let m = load_checked::<Market>(market, &crate::ID)?;
    if let Some(series) = series {
        load_checked::<Series>(series, &crate::ID)?;
        require_keys_eq!(m.series, series.key(), EventsError::SeriesMarketMismatch);
    }
    Ok(m)
}

pub fn load_book<'a>(market_key: &Pubkey, market: &Market, book: &'a AccountInfo) -> Result<Ref<'a, Book>> {
    let b = load_checked::<Book>(book, &crate::ID)?;
    require!(bound_both_ways(market_key, &market.book, &book.key(), &b.market), EventsError::BookMarketMismatch);
    Ok(b)
}

pub fn load_ledger<'a>(market_key: &Pubkey, market: &Market, ledger: &'a AccountInfo) -> Result<Ref<'a, Ledger>> {
    let l = load_checked::<Ledger>(ledger, &crate::ID)?;
    require!(bound_both_ways(market_key, &market.ledger, &ledger.key(), &l.market), EventsError::LedgerMarketMismatch);
    Ok(l)
}

/// Only the canonical `["result", market]` PDA is a MarketResult.
pub fn load_result<'a>(market_key: &Pubkey, result: &'a AccountInfo) -> Result<Ref<'a, MarketResult>> {
    require!(agari_common::view::is_result_of(&crate::ID, market_key, &result.key()), ErrorCode::ConstraintSeeds);
    let r = load_checked::<MarketResult>(result, &crate::ID)?;
    require_keys_eq!(r.market, *market_key, ErrorCode::ConstraintSeeds);
    Ok(r)
}
