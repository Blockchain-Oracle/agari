//! Reading one Window's pricing basis out of the engine, with every guard that decides whether it is priceable.
//!
//! The reserve is the counterparty to every round, so the basis it prices on is the only thing standing between
//! it and a one-sided book. It comes from the engine's own `Market` account — read by cast through
//! `load_checked`, never re-decoded — so the reserve and the venue can never disagree about a Window's state.
//!
//! `center_q_e6` is the venue's last traded YES price. In this engine a YES tick *is* P(close ≥ open) in
//! thousandths (the grid runs 1..=999 of `PAIR_TICKS` = 1,000), so the conversion to the maths' 1e6 scale is
//! `1e6 / PAIR_TICKS` and nothing more. It is derived from the grid rather than restated, because it was once
//! restated wrong: as 100, which read a 65.0¢ market as a 6.5% centre and mispriced every round.

use agari_common::grid::PAIR_TICKS;
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

/// A YES tick is a probability in thousandths; the maths works in millionths.
const TICK_TO_E6: u32 = 1_000_000 / PAIR_TICKS as u32;

/// The venue's mark on the maths' scale.
pub fn center_q_e6_of(last_price_ticks: u16) -> u32 {
    u32::from(last_price_ticks).saturating_mul(TICK_TO_E6)
}

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

    let center_q_e6 = center_q_e6_of(market.last_price);
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

/// Whether the venue still holds this Window and has already decided it. A Market account the engine has closed,
/// or one still waiting on a print, has no answer to give.
pub fn engine_has_answer(market_account: &AccountInfo, events_program: &Pubkey, now: i64) -> bool {
    load_checked::<Market>(market_account, events_program).is_ok_and(|m| matches!(m.status(now), MarketStatus::Resolved | MarketStatus::Voided))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The mark is a probability, so a coin-flip market must read as one half, not one twentieth.
    #[test]
    fn a_yes_tick_is_a_thousandth_of_probability() {
        assert_eq!(center_q_e6_of(500), 500_000);
        assert_eq!(center_q_e6_of(650), 650_000);
        assert_eq!(center_q_e6_of(1), 1_000);
        assert_eq!(center_q_e6_of(999), 999_000);
        // The whole grid lands inside the maths' open interval (0, 1e6).
        assert!((1..=999u16).all(|tick| (1..1_000_000).contains(&center_q_e6_of(tick))));
    }
}
