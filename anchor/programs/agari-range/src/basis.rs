//! Reading one Window's pricing basis out of the engine, with every guard that decides whether it is priceable.
//!
//! The reserve is the counterparty to every round, so the basis it prices on is the only thing standing between
//! it and a one-sided book. It comes from the engine's own `Market` account — read by cast through
//! `load_checked`, never re-decoded — so the reserve and the venue can never disagree about a Window's state.
//!
//! `center_q_e6` is the venue's last traded YES price. In this engine a YES tick *is* P(close ≥ open) in ten
//! thousandths, so the conversion to the maths' 1e6 scale is a multiplication by 100 and nothing more.

use agari_common::view::load_checked;
use agari_events::state::{Market, MarketStatus};
use anchor_lang::prelude::*;

use crate::errors::RangeError;
use crate::state::RangeParams;

/// One Window, as the pricing needs it.
pub struct Basis {
    pub opening_print: i64,
    /// The venue's mark, × 1e6.
    pub center_q_e6: u32,
    /// Seconds from now to the close boundary.
    pub tau_sec: u32,
    pub expiry_sec: i64,
}

/// A YES tick is a probability in ten thousandths; the maths works in millionths.
const TICK_TO_E6: u32 = 100;

/// The basis for an open, or the reason this Window cannot be priced right now.
pub fn read_open_basis(market_account: &AccountInfo, events_program: &Pubkey, params: &RangeParams, now: i64) -> Result<Basis> {
    let market = load_checked::<Market>(market_account, events_program)?;

    require!(market.status(now) == MarketStatus::Trading, RangeError::WindowNotTrading);
    require!(!market.open.is_empty(), RangeError::NoOpeningPrint);
    require!(market.open.price > 0, RangeError::NoOpeningPrint);

    // A mark is a trade, not a quote: with no trade, or a trade too old, the reserve has nothing to price against.
    require!(market.last_price > 0, RangeError::StaleMark);
    let age = now.saturating_sub(market.last_trade_ts);
    require!(age >= 0 && age <= i64::from(params.stale_after_sec), RangeError::StaleMark);

    let center_q_e6 = u32::from(market.last_price).saturating_mul(TICK_TO_E6);
    require!(center_q_e6 >= params.min_center_q_e6, RangeError::CenterOutOfRange);
    require!(center_q_e6 <= params.max_center_q_e6, RangeError::CenterOutOfRange);

    let left = market.expiry.saturating_sub(now);
    require!(left >= i64::from(params.min_time_left_sec), RangeError::TooLate);
    require!(left <= i64::from(params.max_horizon_sec), RangeError::BeyondHorizon);

    Ok(Basis {
        opening_print: market.open.price,
        center_q_e6,
        tau_sec: left as u32,
        expiry_sec: market.expiry,
    })
}

/// The closing print a settle decides on, or the reason there is not one to decide on yet.
///
/// A voided Window has no answer and never will, so its rounds are refunded rather than judged — the same
/// treatment a Window that never printed gets after the grace.
pub fn read_close_print(market_account: &AccountInfo, events_program: &Pubkey, now: i64) -> Result<Option<i64>> {
    let market = load_checked::<Market>(market_account, events_program)?;
    match market.status(now) {
        MarketStatus::Voided => Ok(None),
        MarketStatus::Resolved => {
            require!(!market.close.is_empty(), RangeError::NoClosingPrint);
            require!(market.close.price > 0, RangeError::NoClosingPrint);
            Ok(Some(market.close.price))
        }
        _ => Err(RangeError::NoClosingPrint.into()),
    }
}
