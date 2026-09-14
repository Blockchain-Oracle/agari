//! Randomized operation sequences over the pure matching and ledger core, with the events-engine.md §8.3
//! invariants checked after every operation, refused ones included (a refusal restores the snapshot, as a revert
//! does). A failure names the seed and the operation index; rerun that seed alone to reproduce it.

use super::support::*;
use crate::errors::EventsError;
use crate::events::OrderHandle;
use crate::matching::orders::{cancel_all, cancel_handles, reduce_order, sweep_expired};
use crate::matching::seats::{owned_seat, sweep_credit};
use crate::matching::sets::{merge_set, mint_set, withdraw_credit};
use crate::matching::redeem::{ledger_is_empty, redeem};
use crate::state::{Kind, MarketState, SEAT_FLAG_PROGRAM};
use agari_common::grid::{redeem_payout, PAYOUT_DENOMINATOR};

/// xorshift64*: deterministic, dependency-free.
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 >> 12;
        self.0 ^= self.0 << 25;
        self.0 ^= self.0 >> 27;
        self.0.wrapping_mul(0x2545_F491_4F6C_DD1D)
    }
    fn below(&mut self, n: u64) -> u64 {
        self.next() % n.max(1)
    }
    fn range(&mut self, lo: u64, hi: u64) -> u64 {
        lo + self.below(hi - lo + 1)
    }
    fn coin(&mut self) -> bool {
        self.next() & 1 == 1
    }
}

const USERS: u8 = 6;
const OPS_PER_SEED: usize = 2_500;
const SEEDS: u64 = 12;

#[derive(Default)]
struct Tally {
    ok: usize,
    refused: usize,
    fills: usize,
}

fn random_order(rng: &mut Rng, now: i64, lock_at: i64) -> crate::instructions::PlaceOrderArgs {
    let kind = [Kind::BuyYes, Kind::SellYes, Kind::BuyNo, Kind::SellNo][rng.below(4) as usize];
    let expire = (now + rng.range(1, 180) as i64).min(lock_at);
    let mut o = order(kind, rng.range(470, 530) as u16, rng.range(1, 60), rng.below(4) as u8).expires(expire).caps(rng.range(1, 8) as u8, rng.below(5) as u8);
    o.self_match = rng.below(2) as u8;
    o.use_credit = rng.coin();
    o.withdraw_proceeds = rng.below(4) == 0;
    o
}

fn step(t: &mut TestVenue, rng: &mut Rng, tally: &mut Tally) -> Result<(), EventsError> {
    let n = rng.range(1, u64::from(USERS)) as u8;
    let seat = t.seat_of(n);
    match rng.below(100) {
        0..=54 => {
            let o = random_order(rng, t.now, t.market.lock_at);
            let r = t.place(n, o)?;
            tally.fills += usize::from(r.fills);
        }
        55..=64 => {
            let handles = t.live_handles();
            let (handle, owner) = match handles.get(rng.below(handles.len() as u64 + 1) as usize) {
                Some(&(h, owner, _)) => (h, owner),
                None => (OrderHandle { node: rng.below(64) as u32, seq: rng.below(8) }, seat.unwrap_or(0)),
            };
            let withdraw = rng.coin();
            t.atomic(|t| {
                cancel_handles(&mut t.venue(), owner, &[handle])?;
                let paid = sweep_credit(&mut t.seats[usize::from(owner)], withdraw);
                Ok(((), 0, paid))
            })?;
        }
        65..=69 => {
            let handles = t.live_handles();
            let Some(&(h, owner, lots)) = handles.get(rng.below(handles.len() as u64) as usize) else { return Ok(()) };
            let new_lots = rng.range(0, lots);
            t.atomic(|t| reduce_order(&mut t.venue(), owner, h, new_lots, 1).map(|_| ((), 0, 0)))?;
        }
        70..=72 => {
            let Some(seat) = seat else { return Ok(()) };
            let max_scan = rng.range(1, 64) as u16;
            t.atomic(|t| cancel_all(&mut t.venue(), seat, max_scan).map(|_| ((), 0, 0)))?;
        }
        73..=77 => {
            let drain = t.now >= t.market.lock_at;
            let max = rng.range(1, 32) as u8;
            t.atomic(|t| sweep_expired(&mut t.venue(), max, drain).map(|_| ((), 0, 0)))?;
        }
        78..=85 => {
            let (lots, use_credit) = (rng.range(1, 40), rng.coin());
            let hint = seat.unwrap_or(u16::MAX);
            t.atomic(|t| {
                let (cu, who) = (t.cu, who(n));
                let o = mint_set(&mut t.ledger, &mut t.seats, &mut t.market, cu, &who, hint, lots, use_credit)?;
                Ok(((), o.funding.transferred_in, 0))
            })?;
        }
        86..=90 => {
            let Some(seat) = seat else { return Ok(()) };
            let s = t.seats[usize::from(seat)];
            let (lots, withdraw) = (rng.range(1, s.yes_free.min(s.no_free) + 1), rng.coin());
            t.atomic(|t| {
                owned_seat(&t.ledger, &t.seats, &who(n), seat)?;
                let cu = t.cu;
                let o = merge_set(&mut t.seats, &mut t.market, cu, seat, lots, withdraw)?;
                Ok(((), 0, o.withdrawn))
            })?;
        }
        91..=95 => {
            let Some(seat) = seat else { return Ok(()) };
            let amount = rng.range(1, t.seats[usize::from(seat)].credit + 1);
            t.atomic(|t| withdraw_credit(&mut t.seats[usize::from(seat)], amount).map(|_| ((), 0, amount)))?;
        }
        _ => {
            t.now += rng.range(1, 90) as i64;
            t.slot += 1;
        }
    }
    tally.ok += 1;
    Ok(())
}

#[test]
fn random_operation_sequences_keep_every_invariant() {
    let (mut ops, mut refusals, mut fills) = (0, 0, 0);
    for seed in 1..=SEEDS {
        let mut rng = Rng(seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) | 1);
        let bond = if seed % 2 == 0 { 250 } else { 0 };
        let mut t = TestVenue::new(48, 8, bond);
        t.market.lock_at = START + 30_000;
        t.market.expiry = t.market.lock_at;
        let mut tally = Tally::default();
        for i in 0..OPS_PER_SEED {
            if step(&mut t, &mut rng, &mut tally).is_err() {
                tally.refused += 1;
            }
            if let Err(broken) = t.check() {
                panic!("seed {seed}, op {i}: {broken}");
            }
        }
        (ops, refusals, fills) = (ops + OPS_PER_SEED, refusals + tally.refused, fills + tally.fills);
        assert!(tally.ok > OPS_PER_SEED / 4, "seed {seed}: too few successful ops ({})", tally.ok);
    }
    assert!(fills > 1_000, "the sequences must actually trade ({fills} fills)");
    println!("randomized: {SEEDS} seeds × {OPS_PER_SEED} ops = {ops} ops, {refusals} refused, {fills} fills");
}

/// What the seats are still owed after settlement: credit, escrow, bonds and the payout of every outcome lot
/// (events-engine.md §8.3, after settlement). With no donations the mvault model holds exactly this.
fn owed_after_settlement(t: &TestVenue) -> u128 {
    t.seats
        .iter()
        .map(|s| {
            let payout = redeem_payout(s.yes_free + s.yes_locked, s.no_free + s.no_locked, t.cu, t.market.payout_yes, t.market.payout_no).unwrap();
            let bond = if s.flags & crate::state::SEAT_FLAG_BONDED != 0 { t.ledger.seat_bond } else { 0 };
            u128::from(s.credit) + u128::from(s.locked_cash) + u128::from(payout) + u128::from(bond)
        })
        .sum()
}

#[test]
fn random_sequences_then_settle_and_redeem_every_seat_conserve_exactly() {
    let (mut redeemed, mut paid_total) = (0usize, 0u128);
    for seed in 1..=SEEDS {
        let mut rng = Rng(seed.wrapping_mul(0xD1B5_4A32_D192_ED03) | 1);
        let bond = if seed % 2 == 0 { 250 } else { 0 };
        let mut t = TestVenue::new(48, 8, bond);
        // User 1 trades from a PROGRAM seat (no bond, partial redeem allowed); the others claim bonded seats.
        (t.seats[0].owner, t.seats[0].flags, t.ledger.seats_used) = (who(1), SEAT_FLAG_PROGRAM, 1);
        t.market.lock_at = START + 30_000;
        t.market.expiry = t.market.lock_at;
        let mut tally = Tally::default();
        for i in 0..1_500 {
            let _ = step(&mut t, &mut rng, &mut tally);
            if let Err(broken) = t.check() {
                panic!("seed {seed}, trading op {i}: {broken}");
            }
        }
        // Lock, drain the Book (a terminal Window drains everything), settle a random outcome.
        t.now = t.now.max(t.market.lock_at);
        while t.book.order_count > 0 {
            t.atomic(|t| sweep_expired(&mut t.venue(), 32, true).map(|_| ((), 0, 0))).unwrap();
        }
        t.check().unwrap_or_else(|e| panic!("seed {seed}, after drain: {e}"));
        let (yes_n, no_n) = [(PAYOUT_DENOMINATOR, 0), (0, PAYOUT_DENOMINATOR), (PAYOUT_DENOMINATOR / 2, PAYOUT_DENOMINATOR / 2)][rng.below(3) as usize];
        t.market.state = u8::from(if yes_n == no_n { MarketState::Voided } else { MarketState::Resolved });
        (t.market.payout_yes, t.market.payout_no) = (yes_n, no_n);
        let before = t.mvault;
        assert_eq!(u128::from(before), owed_after_settlement(&t), "seed {seed}: owed at settlement");

        // Redeem every seat in a random order; a PROGRAM seat sometimes takes a partial first.
        let mut order: Vec<usize> = (0..t.seats.len()).filter(|&i| !t.seats[i].is_empty()).collect();
        for i in (1..order.len()).rev() {
            order.swap(i, rng.below(i as u64 + 1) as usize);
        }
        let (market, cu, seat_bond) = (t.market, t.cu, t.ledger.seat_bond);
        for si in order {
            if t.seats[si].is_program() && t.seats[si].yes_free > 0 && rng.coin() {
                let lots = rng.range(1, t.seats[si].yes_free);
                t.atomic(|t| redeem(&mut t.seats[si], &market, cu, seat_bond, Some(0), Some(lots)).map(|r| ((), 0, r.total))).unwrap();
                assert_eq!(u128::from(t.mvault), owed_after_settlement(&t), "seed {seed}: after a partial redeem of seat {si}");
            }
            let owner = t.seats[si].owner;
            let total = t.atomic(|t| redeem(&mut t.seats[si], &market, cu, seat_bond, None, None).map(|r| (r.total, 0, r.total))).unwrap();
            paid_total += u128::from(total);
            redeemed += 1;
            assert_eq!(u128::from(t.mvault), owed_after_settlement(&t), "seed {seed}: after redeeming seat {si}");
            if !t.seats[si].is_program() {
                assert_eq!(err_code(owned_seat(&t.ledger, &t.seats, &owner, si as u16)), EventsError::SeatMismatch as u32, "seed {seed}: seat {si} paid twice");
            }
        }
        assert_eq!(t.mvault, 0, "seed {seed}: paid {} of {before}", before - t.mvault);
        assert!(ledger_is_empty(&t.ledger, &t.seats), "seed {seed}: the Ledger must be closable");
    }
    println!("post-settlement: {SEEDS} seeds × 1,500 trading ops, {redeemed} seats redeemed, {paid_total} base units paid exactly");
}

/// The error code of a refused call (`EventsError` carries no `PartialEq`).
fn err_code<T: core::fmt::Debug>(r: Result<T, EventsError>) -> u32 {
    r.unwrap_err() as u32
}
