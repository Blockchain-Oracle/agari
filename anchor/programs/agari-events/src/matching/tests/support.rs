//! A native Window for tests: heap Book, nodes, Ledger, seats and Market; an mvault model moved only by the cash
//! each call reports; atomic calls (a failed call restores the snapshot, as a Solana revert would); and the
//! events-engine.md §8.3 invariants.

use agari_common::place_result::PlaceResult;
use anchor_lang::prelude::Pubkey;
use bytemuck::Zeroable;

use crate::errors::EventsError;
use crate::events::OrderHandle;
use crate::instructions::PlaceOrderArgs;
use crate::matching::place::{check_order, place, SeriesRules};
use crate::matching::seats::resolve_seat;
use crate::matching::Venue;
use crate::state::{Book, Kind, Ledger, Market, OrderNode, Seat, NODE_FLAG_LIVE, SEAT_FLAG_BONDED};

pub const START: i64 = 1_000;
/// `seat_hint` placeholder the helper replaces with the owner's seat (or `u16::MAX` to claim one).
pub const AUTO_SEAT: u16 = u16::MAX - 1;

pub fn who(n: u8) -> Pubkey {
    Pubkey::new_from_array([n; 32])
}

#[derive(Clone)]
pub struct TestVenue {
    pub book: Box<Book>,
    pub nodes: Vec<OrderNode>,
    pub ledger: Ledger,
    pub seats: Vec<Seat>,
    pub market: Market,
    pub cu: u64,
    pub now: i64,
    pub slot: u64,
    /// What the mvault token account would hold: only reported pulls and payouts move it.
    pub mvault: u64,
}

impl TestVenue {
    pub fn new(book_nodes: u32, seat_capacity: u16, seat_bond: u64) -> Self {
        let mut book: Box<Book> = Box::new(Zeroable::zeroed());
        book.capacity = book_nodes;
        let mut ledger: Ledger = Zeroable::zeroed();
        ledger.capacity = seat_capacity;
        ledger.seat_bond = seat_bond;
        let mut market: Market = Zeroable::zeroed();
        market.trading_start = START;
        market.lock_at = START + 100_000;
        market.expiry = market.lock_at;
        TestVenue { book, nodes: vec![OrderNode::default(); book_nodes as usize], ledger, seats: vec![Seat::default(); usize::from(seat_capacity)], market, cu: 1, now: START, slot: 1, mvault: 0 }
    }

    pub fn venue(&mut self) -> Venue<'_> {
        Venue { book: &mut self.book, nodes: &mut self.nodes, ledger: &mut self.ledger, seats: &mut self.seats, market: &mut self.market, cu: self.cu, now: self.now, slot: self.slot }
    }

    /// Runs `f` atomically; `f` returns `(pulled into mvault, paid out of mvault)`.
    pub fn atomic<T>(&mut self, f: impl FnOnce(&mut TestVenue) -> Result<(T, u64, u64), EventsError>) -> Result<T, EventsError> {
        let snapshot = self.clone();
        match f(self) {
            Ok((value, pulled, paid)) => {
                self.mvault = self.mvault + pulled - paid;
                Ok(value)
            }
            Err(e) => {
                *self = snapshot;
                Err(e)
            }
        }
    }

    pub fn seat_of(&self, n: u8) -> Option<u16> {
        self.seats.iter().position(|s| s.owner == who(n)).map(|i| i as u16)
    }

    pub fn seat(&self, n: u8) -> Seat {
        self.seats[usize::from(self.seat_of(n).expect("seat"))]
    }

    pub fn place(&mut self, n: u8, mut args: PlaceOrderArgs) -> Result<PlaceResult, EventsError> {
        if args.seat_hint == AUTO_SEAT {
            args.seat_hint = self.seat_of(n).unwrap_or(u16::MAX);
        }
        let rules = SeriesRules { min_lots: 1, fills_cap: 32, evictions_cap: 16 };
        self.atomic(|t| {
            let order = check_order(&t.market, t.now, &args, rules)?;
            let p = place(&mut t.venue(), &who(n), &order)?;
            Ok((p.result, p.result.transferred_in, p.result.withdrawn))
        })
    }

    /// Seeds `lots` pairs outside the book: `yes_to` holds the YES, `no_to` the NO, the mvault holds the backing.
    pub fn seed_pair(&mut self, yes_to: u8, no_to: u8, lots: u64) {
        for (n, yes) in [(yes_to, true), (no_to, false)] {
            let hint = self.seat_of(n).unwrap_or(u16::MAX);
            let i = usize::from(resolve_seat(&mut self.ledger, &mut self.seats, &who(n), hint).expect("seat").index);
            if yes {
                self.seats[i].yes_free += lots;
            } else {
                self.seats[i].no_free += lots;
            }
        }
        self.market.backing_lots += lots;
        self.mvault += lots * 1_000 * self.cu;
    }

    pub fn seed_credit(&mut self, n: u8, credit: u64) {
        let hint = self.seat_of(n).unwrap_or(u16::MAX);
        let i = usize::from(resolve_seat(&mut self.ledger, &mut self.seats, &who(n), hint).expect("seat").index);
        self.seats[i].credit += credit;
        self.mvault += credit;
    }

    pub fn live_handles(&self) -> Vec<(OrderHandle, u16, u64)> {
        (0..self.book.high_water as usize)
            .filter(|&i| self.nodes[i].flags & NODE_FLAG_LIVE != 0)
            .map(|i| (OrderHandle { node: i as u32, seq: self.nodes[i].seq }, self.nodes[i].seat, self.nodes[i].lots))
            .collect()
    }

    /// events-engine.md §8.3, plus free-list integrity. `Err` names the first broken invariant.
    pub fn check(&self) -> Result<(), String> {
        let sum = |f: fn(&Seat) -> u64| self.seats.iter().map(|s| u128::from(f(s))).sum::<u128>();
        let (yes, no) = (sum(|s| s.yes_free + s.yes_locked), sum(|s| s.no_free + s.no_locked));
        let backing = u128::from(self.market.backing_lots);
        if yes != backing || no != backing {
            return Err(format!("pairs: yes {yes} no {no} backing {backing}"));
        }
        let bonds = self.seats.iter().filter(|s| s.flags & SEAT_FLAG_BONDED != 0).count() as u128 * u128::from(self.ledger.seat_bond);
        let owed = backing * 1_000 * u128::from(self.cu) + sum(|s| s.credit) + sum(|s| s.locked_cash) + bonds;
        if u128::from(self.mvault) != owed {
            return Err(format!("conservation: mvault {} owed {owed}", self.mvault));
        }
        self.check_book()
    }

    fn check_book(&self) -> Result<(), String> {
        let b = &*self.book;
        let hw = b.high_water as usize;
        let live = (0..hw).filter(|&i| self.nodes[i].flags & NODE_FLAG_LIVE != 0).count();
        if live != b.order_count as usize {
            return Err(format!("order_count {} live {live}", b.order_count));
        }
        let mut linked = 0usize;
        for (bits, levels, bid) in [(&b.bid_bits, &b.bids, true), (&b.ask_bits, &b.asks, false)] {
            for p in 0..levels.len() {
                let level = levels[p];
                let (mut r, mut prev, mut lots, mut steps) = (level.head, 0u32, 0u64, 0usize);
                while r != 0 {
                    let n = self.nodes[(r - 1) as usize];
                    let kind = Kind::try_from(n.kind).map_err(|_| format!("bad kind at {r}"))?;
                    if n.flags & NODE_FLAG_LIVE == 0 || usize::from(n.price) != p || kind.is_bid() != bid || n.prev != prev {
                        return Err(format!("level {p} bid={bid} node {r} out of place"));
                    }
                    (lots, prev, r, steps) = (lots + n.lots, r, n.next, steps + 1);
                    if steps > self.nodes.len() {
                        return Err(format!("cycle at level {p}"));
                    }
                }
                linked += steps;
                let bit = bits[p / 64] & (1 << (p % 64)) != 0;
                if level.tail != prev || level.live_lots != lots || bit != (level.head != 0) {
                    return Err(format!("level {p} bid={bid}: tail/live_lots/bit disagree"));
                }
            }
        }
        if linked != live {
            return Err(format!("{live} live nodes but {linked} linked"));
        }
        let (mut free, mut r) = (0usize, b.free_head);
        while r != 0 {
            (free, r) = (free + 1, self.nodes[(r - 1) as usize].next);
            if free > hw {
                return Err("free list cycle".into());
            }
        }
        if free + live != hw {
            return Err(format!("free {free} + live {live} != high_water {hw}"));
        }
        self.check_escrow()
    }

    fn check_escrow(&self) -> Result<(), String> {
        for (si, seat) in self.seats.iter().enumerate() {
            let mine = (0..self.book.high_water as usize).map(|i| self.nodes[i]).filter(|n| n.flags & NODE_FLAG_LIVE != 0 && usize::from(n.seat) == si);
            let (mut orders, mut cash, mut yes, mut no) = (0u16, 0u64, 0u64, 0u64);
            for n in mine {
                orders += 1;
                match Kind::try_from(n.kind).unwrap() {
                    Kind::BuyYes => cash += n.lots * u64::from(n.price) * self.cu,
                    Kind::BuyNo => cash += n.lots * (1_000 - u64::from(n.price)) * self.cu,
                    Kind::SellYes => yes += n.lots,
                    Kind::SellNo => no += n.lots,
                }
            }
            if (orders, cash, yes, no) != (seat.open_orders, seat.locked_cash, seat.yes_locked, seat.no_locked) {
                return Err(format!("seat {si} escrow: orders/cash/yes/no {:?} vs seat {:?}", (orders, cash, yes, no), (seat.open_orders, seat.locked_cash, seat.yes_locked, seat.no_locked)));
            }
        }
        Ok(())
    }
}

/// An order with test defaults: expires 500 s out, CancelTaker, 16 fills, 16 evictions, the owner's own seat.
pub fn order(kind: Kind, price: u16, lots: u64, order_type: u8) -> PlaceOrderArgs {
    PlaceOrderArgs { kind: u8::from(kind), price_ticks: price, lots, expire_ts: START + 500, order_type, self_match: 0, max_fills: 16, max_evictions: 16, seat_hint: AUTO_SEAT, use_credit: false, withdraw_proceeds: false, client_id: 0 }
}

pub const NORMAL: u8 = 0;
pub const FOK: u8 = 1;
pub const IOC: u8 = 2;
pub const POST_ONLY: u8 = 3;

/// Builder tweaks for `order(...)`.
pub trait OrderExt {
    fn with_credit(self) -> Self;
    fn cancel_maker(self) -> Self;
    fn caps(self, max_fills: u8, max_evictions: u8) -> Self;
    fn expires(self, expire_ts: i64) -> Self;
    fn hint(self, seat: u16) -> Self;
}

impl OrderExt for PlaceOrderArgs {
    fn with_credit(mut self) -> Self {
        self.use_credit = true;
        self
    }
    fn cancel_maker(mut self) -> Self {
        self.self_match = 1;
        self
    }
    fn caps(mut self, max_fills: u8, max_evictions: u8) -> Self {
        (self.max_fills, self.max_evictions) = (max_fills, max_evictions);
        self
    }
    fn expires(mut self, expire_ts: i64) -> Self {
        self.expire_ts = expire_ts;
        self
    }
    fn hint(mut self, seat: u16) -> Self {
        self.seat_hint = seat;
        self
    }
}
