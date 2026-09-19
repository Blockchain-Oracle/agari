//! The reserve's one seam to the venue: pricing a leg off a Window's own book, and reading how a Window ended.
//!
//! Engine accounts are read by cast through `load_checked` against the engine this reserve was initialised with,
//! never re-decoded, so the reserve and the venue cannot disagree about a Window. Every binding is checked both
//! ways: a Book that does not point back at its Market prices nothing.
//!
//! A price taken off a book is only as honest as the book. Someone can rest a cheap offer, buy a ticket priced
//! off it and cancel, all in one transaction. So a leg is priced only from orders that have already rested
//! `min_rest_slots` (PD-2), which means the cheap offer had to sit where anyone could take it; over a depth no
//! smaller than the payout, so it had to be large; and, when the reserve sets `max_spread_ticks`, only while the
//! other side of the book still stands close by. The plan's fourth defence, a bound against an oracle's fair
//! value, needs a live price in this transaction and is not here; the per-ticket, exposure and per-boundary caps
//! are what bound the loss to a manipulated book.

use agari_common::book_walk::{outcome_levels, NodeFilter, TakerKind};
use agari_common::grid::PAIR_TICKS;
use agari_common::view::{bound_both_ways, load_checked, load_slice_checked};
use agari_events::book::walk::{walk_asks, walk_bids};
use agari_events::constants::BOOK_FIXED_LEN;
use agari_events::state::{Book, Market, MarketStatus, OrderNode, Series};
use anchor_lang::{prelude::*, Discriminator};

use crate::constants::PRICE_LEVELS;
use crate::errors::ParlayError;
use crate::math::vwap;
use crate::state::{LegStatus, ParlayParams};

/// The three engine accounts one leg names.
pub struct LegAccounts<'a, 'info> {
    pub market: &'a AccountInfo<'info>,
    pub book: &'a AccountInfo<'info>,
    pub series: &'a AccountInfo<'info>,
}

pub struct PricedLeg {
    pub expiry_sec: i64,
    pub price_raw: u64,
}

/// When and against what a leg is priced.
pub struct PricingClock {
    pub now: i64,
    pub slot: u64,
    /// One whole unit of collateral: the scale of every price and probability.
    pub one: i128,
}

/// The cost-weighted price of `quantity_raw` contracts of the chosen side, or the reason this leg cannot be priced.
pub fn price_leg(leg: &LegAccounts, engine: &Pubkey, is_up: bool, quantity_raw: u64, params: &ParlayParams, clock: &PricingClock) -> Result<PricedLeg> {
    let market = load_checked::<Market>(leg.market, engine)?;
    require!(market.status(clock.now) == MarketStatus::Trading, ParlayError::WindowNotTrading);
    // A leg whose Window is about to close would let the buyer pick an outcome they can already see.
    let left = market.expiry.saturating_sub(clock.now);
    require!(left > 0 && left >= i64::from(params.min_time_left_sec), ParlayError::TooLate);

    let book = load_checked::<Book>(leg.book, engine)?;
    require!(bound_both_ways(&leg.market.key(), &market.book, &leg.book.key(), &book.market), ParlayError::WrongBook);
    let series = load_checked::<Series>(leg.series, engine)?;
    require_keys_eq!(market.series, leg.series.key(), ParlayError::WrongSeries);
    // `tick_base × 1000` is one whole unit of the Series' collateral; it has to be the reserve's.
    require!(i128::from(series.tick_base) * i128::from(PAIR_TICKS) == clock.one, ParlayError::WrongGrid);

    let capacity = usize::try_from(book.capacity).map_err(|_| ParlayError::MathOverflow)?;
    let nodes = load_slice_checked::<OrderNode>(leg.book, Book::DISCRIMINATOR.len() + BOOK_FIXED_LEN, capacity)?;
    let (bids, asks) = (walk_bids(&book, &nodes), walk_asks(&book, &nodes));
    let filter = NodeFilter {
        now: clock.now,
        slot: clock.slot,
        rested_only: true,
        min_rest_slots: u64::from(series.min_rest_slots.max(params.min_rest_slots)),
    };

    // Up buys the YES asks as they rest; Down buys NO, which is the YES bids inverted.
    let (buy, sell) = if is_up { (TakerKind::BuyYes, TakerKind::SellYes) } else { (TakerKind::BuyNo, TakerKind::SellNo) };
    let (tick_base, lot_base) = (i128::from(series.tick_base), i128::from(series.lot_base));
    let levels: Vec<(i128, i128)> = outcome_levels(buy, &bids, &asks, PRICE_LEVELS, &filter)
        .into_iter()
        .map(|(ticks, lots)| (i128::from(ticks) * tick_base, i128::from(lots) * lot_base))
        .collect();
    let (price_raw, filled_raw) = vwap(&levels, i128::from(quantity_raw));
    require!(filled_raw >= i128::from(quantity_raw), ParlayError::ThinBook);

    if params.max_spread_ticks > 0 {
        let touch = outcome_levels(sell, &bids, &asks, 1, &filter).first().map(|(ticks, _)| i128::from(*ticks) * tick_base);
        let widest = i128::from(params.max_spread_ticks) * tick_base;
        require!(touch.is_some_and(|touch| price_raw.saturating_sub(touch) <= widest), ParlayError::WideSpread);
    }

    Ok(PricedLeg {
        expiry_sec: market.expiry,
        price_raw: u64::try_from(price_raw).map_err(|_| ParlayError::MathOverflow)?,
    })
}

/// The venue's verdict for one side: void when the Window voided or named no winner, won when this side's payout
/// beats the other's, lost when the other's beats it. A Window still waiting on its print is `LegNotSettled`.
pub fn read_leg_outcome(market: &AccountInfo, engine: &Pubkey, is_up: bool, now: i64) -> Result<LegStatus> {
    let market = load_checked::<Market>(market, engine)?;
    match market.status(now) {
        MarketStatus::Voided => Ok(LegStatus::Void),
        MarketStatus::Resolved => {
            let (mine, other) = if is_up { (market.payout_yes, market.payout_no) } else { (market.payout_no, market.payout_yes) };
            Ok(match mine.cmp(&other) {
                core::cmp::Ordering::Greater => LegStatus::Won,
                core::cmp::Ordering::Less => LegStatus::Lost,
                core::cmp::Ordering::Equal => LegStatus::Void,
            })
        }
        _ => Err(ParlayError::LegNotSettled.into()),
    }
}

/// Whether the venue still holds this Window and has already decided it. A Market account the engine has closed,
/// or one still waiting on a print, has no answer to give.
pub fn engine_has_answer(market: &AccountInfo, engine: &Pubkey, now: i64) -> bool {
    load_checked::<Market>(market, engine).is_ok_and(|m| matches!(m.status(now), MarketStatus::Resolved | MarketStatus::Voided))
}

#[cfg(test)]
mod tests;
