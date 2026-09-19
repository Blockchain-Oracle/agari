//! Pricing a leg and reading an outcome against real engine bytes.
//!
//! The Book here is built by the engine's own slab and ladder code and laid out as the account the chain holds,
//! so these are the refusals a manipulated or mismatched book actually meets (PD-2): an order that has not rested
//! prices nothing, an expired one prices nothing, a thin or one-sided book refuses, and an account bound to a
//! different Window is not read at all.

use super::*;
use agari_events::book::ladder::{push_back, BookSide};
use agari_events::book::slab::{alloc, node_at_mut};
use agari_events::state::{book_parts_mut, MarketState, NODE_FLAG_LIVE};
use anchor_lang::error::Error;
use core::mem::size_of;

const NOW: i64 = 1_800_000_000;
const SLOT: u64 = 10_000;
const REST: u32 = 50;
const CAPACITY: usize = 16;
const ONE: i128 = 1_000_000;

/// An 8-aligned account buffer of `len` bytes, discriminator written.
fn account_bytes(disc: &[u8], len: usize) -> Vec<u64> {
    let mut words = vec![0u64; len.div_ceil(8)];
    bytemuck::cast_slice_mut::<u64, u8>(&mut words)[..disc.len()].copy_from_slice(disc);
    words
}

struct Resting {
    side: BookSide,
    price: u16,
    lots: u64,
    placed_slot: u64,
    expire_ts: i64,
}

fn ask(price: u16, lots: u64) -> Resting {
    Resting { side: BookSide::Ask, price, lots, placed_slot: SLOT - 500, expire_ts: NOW + 600 }
}

fn bid(price: u16, lots: u64) -> Resting {
    Resting { side: BookSide::Bid, ..ask(price, lots) }
}

struct Venue {
    engine: Pubkey,
    keys: [Pubkey; 3],
    market: Vec<u64>,
    book: Vec<u64>,
    series: Vec<u64>,
}

impl Venue {
    fn new(orders: &[Resting]) -> Self {
        let engine = Pubkey::new_from_array([9; 32]);
        let keys = [Pubkey::new_from_array([1; 32]), Pubkey::new_from_array([2; 32]), Pubkey::new_from_array([3; 32])];

        let mut market = account_bytes(Market::DISCRIMINATOR, 8 + size_of::<Market>());
        let m: &mut Market = bytemuck::from_bytes_mut(&mut bytemuck::cast_slice_mut::<u64, u8>(&mut market)[8..8 + size_of::<Market>()]);
        (m.book, m.series) = (keys[1], keys[2]);
        (m.trading_start, m.lock_at, m.expiry) = (NOW - 120, NOW + 240, NOW + 300);

        let mut series = account_bytes(Series::DISCRIMINATOR, 8 + size_of::<Series>());
        let s: &mut Series = bytemuck::from_bytes_mut(&mut bytemuck::cast_slice_mut::<u64, u8>(&mut series)[8..8 + size_of::<Series>()]);
        (s.tick_base, s.lot_base, s.min_rest_slots) = (1_000, 1_000, REST);

        let mut book = account_bytes(Book::DISCRIMINATOR, 8 + BOOK_FIXED_LEN + CAPACITY * size_of::<OrderNode>());
        {
            let data = bytemuck::cast_slice_mut::<u64, u8>(&mut book);
            let fixed: &mut Book = bytemuck::from_bytes_mut(&mut data[8..8 + BOOK_FIXED_LEN]);
            (fixed.market, fixed.capacity) = (keys[0], CAPACITY as u32);
            let (fixed, nodes) = book_parts_mut(data).expect("a well-formed Book");
            for o in orders {
                let r = alloc(fixed, nodes).expect("room in the slab");
                let node = node_at_mut(nodes, r).expect("the node just allocated");
                (node.lots, node.price, node.placed_slot, node.expire_ts, node.flags) = (o.lots, o.price, o.placed_slot, o.expire_ts, NODE_FLAG_LIVE);
                push_back(fixed, nodes, o.side, o.price, r).expect("a valid level");
                fixed.order_count += 1;
            }
        }
        Self { engine, keys, market, book, series }
    }

    fn market_mut(&mut self) -> &mut Market {
        bytemuck::from_bytes_mut(&mut bytemuck::cast_slice_mut::<u64, u8>(&mut self.market)[8..8 + size_of::<Market>()])
    }

    fn series_mut(&mut self) -> &mut Series {
        bytemuck::from_bytes_mut(&mut bytemuck::cast_slice_mut::<u64, u8>(&mut self.series)[8..8 + size_of::<Series>()])
    }

    fn with_accounts<T>(&mut self, f: impl FnOnce(&LegAccounts, &Pubkey) -> T) -> T {
        let engine = self.engine;
        let mut lamports = [1u64; 3];
        let [l0, l1, l2] = &mut lamports;
        let market = AccountInfo::new(&self.keys[0], false, false, l0, bytemuck::cast_slice_mut(&mut self.market), &engine, false);
        let book = AccountInfo::new(&self.keys[1], false, false, l1, bytemuck::cast_slice_mut(&mut self.book), &engine, false);
        let series = AccountInfo::new(&self.keys[2], false, false, l2, bytemuck::cast_slice_mut(&mut self.series), &engine, false);
        f(&LegAccounts { market: &market, book: &book, series: &series }, &engine)
    }

    fn price(&mut self, is_up: bool, quantity_raw: u64, params: &ParlayParams) -> Result<u64> {
        let clock = PricingClock { now: NOW, slot: SLOT, one: ONE };
        self.with_accounts(|leg, engine| price_leg(leg, engine, is_up, quantity_raw, params, &clock).map(|p| p.price_raw))
    }

    fn outcome(&mut self, is_up: bool) -> Result<LegStatus> {
        self.with_accounts(|leg, engine| read_leg_outcome(leg.market, engine, is_up, NOW + 400))
    }
}

fn params() -> ParlayParams {
    ParlayParams { max_legs: 4, min_time_left_sec: 60, price_depth_raw: 1_000_000, ..ParlayParams::default() }
}

fn refusal(result: Result<u64>) -> u32 {
    match result {
        Err(Error::AnchorError(e)) => e.error_code_number,
        other => panic!("expected a refusal, got {other:?}"),
    }
}

fn code(e: ParlayError) -> u32 {
    e.into()
}

#[test]
fn a_rested_book_prices_a_leg_in_the_clients_terms() {
    let mut v = Venue::new(&[ask(600, 3_000), ask(610, 3_000), bid(580, 5_000)]);
    // 5 tUSDC of payout is 5,000 lots: 3,000 at 600 and 2,000 at 610, which the client computes as 604,000.
    assert_eq!(v.price(true, 5_000_000, &params()).unwrap(), 604_000);
    // Down buys NO, which is the YES bids inverted: a 580 bid is a 420 offer of NO.
    assert_eq!(v.price(false, 5_000_000, &params()).unwrap(), 420_000);
}

#[test]
fn a_price_that_does_not_land_on_a_tick_rounds_up_for_the_reserve() {
    let mut v = Venue::new(&[ask(600, 1_000), ask(601, 2_000)]);
    // (1,000 × 600 + 2,000 × 601) / 3,000 = 600.666… ticks.
    assert_eq!(v.price(true, 3_000_000, &params()).unwrap(), 600_667);
}

/// The manipulation PD-2 names: rest a cheap offer, price a ticket off it, cancel. Until it has rested it prices
/// nothing, so the honest offer behind it sets the price; once it has rested it counts, because by then it sat
/// where anyone could take it.
#[test]
fn an_order_that_has_not_rested_prices_nothing() {
    let fresh = Resting { placed_slot: SLOT - u64::from(REST) + 1, ..ask(50, 5_000) };
    let mut v = Venue::new(&[fresh, ask(600, 5_000)]);
    assert_eq!(v.price(true, 5_000_000, &params()).unwrap(), 600_000);

    let rested = Resting { placed_slot: SLOT - u64::from(REST), ..ask(50, 5_000) };
    let mut v = Venue::new(&[rested, ask(600, 5_000)]);
    assert_eq!(v.price(true, 5_000_000, &params()).unwrap(), 50_000);

    let mut v = Venue::new(&[Resting { placed_slot: SLOT, ..ask(50, 5_000) }]);
    assert_eq!(refusal(v.price(true, 5_000_000, &params())), code(ParlayError::ThinBook));
}

#[test]
fn the_reserve_can_ask_for_a_longer_rest_than_the_series_does() {
    let mut v = Venue::new(&[Resting { placed_slot: SLOT - 60, ..ask(50, 5_000) }, ask(600, 5_000)]);
    assert_eq!(v.price(true, 5_000_000, &params()).unwrap(), 50_000);
    assert_eq!(v.price(true, 5_000_000, &ParlayParams { min_rest_slots: 100, ..params() }).unwrap(), 600_000);
}

#[test]
fn an_expired_order_prices_nothing() {
    let mut v = Venue::new(&[Resting { expire_ts: NOW, ..ask(50, 5_000) }, ask(600, 5_000)]);
    assert_eq!(v.price(true, 5_000_000, &params()).unwrap(), 600_000);
}

#[test]
fn a_book_thinner_than_the_payout_refuses() {
    let mut v = Venue::new(&[ask(600, 4_999)]);
    assert_eq!(refusal(v.price(true, 5_000_000, &params())), code(ParlayError::ThinBook));
    assert_eq!(v.price(true, 4_999_000, &params()).unwrap(), 600_000);
    // The other side being deep is no help to this one.
    let mut v = Venue::new(&[bid(580, 50_000)]);
    assert_eq!(refusal(v.price(true, 1_000_000, &params())), code(ParlayError::ThinBook));
}

#[test]
fn a_one_sided_or_wide_book_refuses_when_the_spread_guard_is_on() {
    let guarded = ParlayParams { max_spread_ticks: 40, ..params() };
    let mut v = Venue::new(&[ask(600, 5_000)]);
    assert_eq!(v.price(true, 5_000_000, &params()).unwrap(), 600_000);
    assert_eq!(refusal(v.price(true, 5_000_000, &guarded)), code(ParlayError::WideSpread));

    let mut v = Venue::new(&[ask(600, 5_000), bid(559, 5_000)]);
    assert_eq!(refusal(v.price(true, 5_000_000, &guarded)), code(ParlayError::WideSpread));
    let mut v = Venue::new(&[ask(600, 5_000), bid(560, 5_000)]);
    assert_eq!(v.price(true, 5_000_000, &guarded).unwrap(), 600_000);
    assert_eq!(v.price(false, 5_000_000, &guarded).unwrap(), 440_000);
}

#[test]
fn a_window_that_is_not_trading_or_nearly_done_refuses() {
    let mut v = Venue::new(&[ask(600, 5_000)]);
    v.market_mut().lock_at = NOW;
    assert_eq!(refusal(v.price(true, 1_000_000, &params())), code(ParlayError::WindowNotTrading));

    let mut v = Venue::new(&[ask(600, 5_000)]);
    v.market_mut().trading_start = NOW + 1;
    assert_eq!(refusal(v.price(true, 1_000_000, &params())), code(ParlayError::WindowNotTrading));

    let mut v = Venue::new(&[ask(600, 5_000)]);
    (v.market_mut().lock_at, v.market_mut().expiry) = (NOW + 50, NOW + 59);
    assert_eq!(refusal(v.price(true, 1_000_000, &params())), code(ParlayError::TooLate));
}

#[test]
fn accounts_bound_to_another_window_are_not_read() {
    let mut v = Venue::new(&[ask(600, 5_000)]);
    v.market_mut().book = Pubkey::new_from_array([7; 32]);
    assert_eq!(refusal(v.price(true, 1_000_000, &params())), code(ParlayError::WrongBook));

    let mut v = Venue::new(&[ask(600, 5_000)]);
    v.market_mut().series = Pubkey::new_from_array([7; 32]);
    assert_eq!(refusal(v.price(true, 1_000_000, &params())), code(ParlayError::WrongSeries));

    let mut v = Venue::new(&[ask(600, 5_000)]);
    v.series_mut().tick_base = 100;
    assert_eq!(refusal(v.price(true, 1_000_000, &params())), code(ParlayError::WrongGrid));

    // The same bytes under another program are not the venue's.
    let mut v = Venue::new(&[ask(600, 5_000)]);
    v.engine = Pubkey::new_from_array([8; 32]);
    let clock = PricingClock { now: NOW, slot: SLOT, one: ONE };
    let venue = Pubkey::new_from_array([9; 32]);
    let refused = v.with_accounts(|leg, _| price_leg(leg, &venue, true, 1_000_000, &params(), &clock).map(|p| p.price_raw));
    assert!(matches!(refused, Err(Error::AnchorError(e)) if e.error_code_number == u32::from(anchor_lang::error::ErrorCode::AccountOwnedByWrongProgram)));
}

#[test]
fn a_leg_ends_as_the_venue_recorded_it() {
    let mut v = Venue::new(&[]);
    assert!(matches!(v.outcome(true), Err(Error::AnchorError(e)) if e.error_code_number == code(ParlayError::LegNotSettled)));

    (v.market_mut().state, v.market_mut().payout_yes, v.market_mut().payout_no) = (MarketState::Resolved.into(), 10_000_000, 0);
    assert_eq!((v.outcome(true).unwrap(), v.outcome(false).unwrap()), (LegStatus::Won, LegStatus::Lost));
    (v.market_mut().payout_yes, v.market_mut().payout_no) = (0, 10_000_000);
    assert_eq!((v.outcome(true).unwrap(), v.outcome(false).unwrap()), (LegStatus::Lost, LegStatus::Won));
    // A resolution that names no winner is a void, not a coin toss.
    (v.market_mut().payout_yes, v.market_mut().payout_no) = (5_000_000, 5_000_000);
    assert_eq!(v.outcome(true).unwrap(), LegStatus::Void);

    v.market_mut().state = MarketState::Voided.into();
    assert_eq!((v.outcome(true).unwrap(), v.outcome(false).unwrap()), (LegStatus::Void, LegStatus::Void));
}

/// The stale sweep's guard. It may void only what the venue cannot answer: a Window still waiting on its print,
/// or a Market account the engine has already closed. A decided Window has to be resolved instead, so a winning
/// ticket cannot be voided out from under its owner.
#[test]
fn only_a_window_with_no_answer_can_be_swept() {
    let mut v = Venue::new(&[]);
    let late = NOW + 10_000;
    assert!(!v.with_accounts(|leg, engine| engine_has_answer(leg.market, engine, late)));
    v.market_mut().state = MarketState::Resolved.into();
    assert!(v.with_accounts(|leg, engine| engine_has_answer(leg.market, engine, late)));
    v.market_mut().state = MarketState::Voided.into();
    assert!(v.with_accounts(|leg, engine| engine_has_answer(leg.market, engine, late)));

    let (key, system, mut lamports, mut empty) = (Pubkey::new_from_array([1; 32]), Pubkey::default(), 0u64, [0u8; 0]);
    let closed = AccountInfo::new(&key, false, false, &mut lamports, &mut empty, &system, false);
    assert!(!engine_has_answer(&closed, &Pubkey::new_from_array([9; 32]), late));
}
