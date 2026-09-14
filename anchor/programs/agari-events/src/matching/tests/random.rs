//! Randomized operation sequences over the pure matching and ledger core, with the events-engine.md §8.3
//! invariants checked after every operation, refused ones included (a refusal restores the snapshot, as a revert
//! does). A failure names the seed and the operation index; rerun that seed alone to reproduce it.

use super::support::*;
use crate::errors::EventsError;
use crate::events::OrderHandle;
use crate::matching::orders::{cancel_all, cancel_handles, reduce_order, sweep_expired};
use crate::matching::seats::{owned_seat, sweep_credit};
use crate::matching::sets::{merge_set, mint_set, withdraw_credit};
use crate::state::Kind;

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
