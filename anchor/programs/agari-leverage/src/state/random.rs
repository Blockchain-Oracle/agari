//! The reserve's books under randomized sequences, against a custody that is only a number.
//!
//! The sequences drive the same pure methods the instructions call and check after every operation that the
//! counters still say exactly what the positions say. A refused operation restores the snapshot, as a reverted
//! transaction does. A failure names the seed and the step.

use super::tests::{position, reserve, window};
use super::*;
use crate::errors::LeverageError;
use crate::math::terms;

/// xorshift64*: deterministic, dependency-free (the engine's randomized tests use the same).
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
}

const SEEDS: u64 = 16;
const OPS_PER_SEED: usize = 3_000;
const PROVIDERS: usize = 4;
const WINDOWS: usize = 5;

#[derive(Clone)]
struct World {
    reserve: LeverageReserve,
    custody: u64,
    windows: Vec<WindowBook>,
    positions: Vec<(Position, usize)>,
    shares: [u64; PROVIDERS],
    paid_in: u128,
    paid_out: u128,
    now: i64,
}

impl World {
    fn check(&self, seed: u64, step: usize) {
        let at = format!("seed {seed} step {step}");
        let r = &self.reserve;
        let live = || self.positions.iter().filter(|(p, _)| p.status == PositionStatus::Live);
        assert_eq!(r.outstanding_base, live().map(|(p, _)| p.fronted_base).sum::<u64>(), "outstanding, {at}");
        assert_eq!(r.user_owed_base, self.positions.iter().map(|(p, _)| p.owed_base).sum::<u64>(), "user_owed, {at}");
        for (i, w) in self.windows.iter().enumerate() {
            assert_eq!(w.fronted_base, live().filter(|(_, at_w)| *at_w == i).map(|(p, _)| p.fronted_base).sum::<u64>(), "window {i} fronted, {at}");
            assert_eq!(w.positions_open as usize, live().filter(|(_, at_w)| *at_w == i).count(), "window {i} open, {at}");
            assert!(w.fronted_base <= r.params.max_window_fronted_base, "window {i} cap, {at}");
        }
        let mut tracked: Vec<u64> = r.open.iter().filter(|s| s.position_id != 0).map(|s| s.position_id).collect();
        let mut expected: Vec<u64> = live().map(|(p, _)| p.position_id).collect();
        tracked.sort_unstable();
        expected.sort_unstable();
        assert_eq!(tracked, expected, "the open table is exactly the live positions, {at}");
        assert!(tracked.len() <= usize::from(r.params.max_open_positions), "open limit, {at}");
        // What is owed to owners is really in custody, with no help from saturation.
        assert!(self.custody >= r.user_owed_base, "custody covers what is owed, {at}");
        assert_eq!(u128::from(self.custody), self.paid_in - self.paid_out, "conservation, {at}");
        assert_eq!(r.supply_shares, self.shares.iter().sum::<u64>(), "supply_shares, {at}");
        for (p, _) in &self.positions {
            assert!(p.reclaimed_base + p.returned_base == p.proceeds_base, "every unit a position fetched went to the reserve or its owner, {at}");
        }
    }

    fn supply(&mut self, who: usize, amount: u64) -> Result<(), LeverageError> {
        let shares = self.reserve.shares_for(self.custody, amount)?;
        if shares == 0 {
            return Err(LeverageError::ZeroAmount);
        }
        self.custody += amount;
        self.paid_in += u128::from(amount);
        self.shares[who] += shares;
        self.reserve.supply_shares += shares;
        Ok(())
    }

    fn withdraw(&mut self, who: usize, shares: u64) -> Result<(), LeverageError> {
        if shares == 0 || shares > self.shares[who] {
            return Err(LeverageError::InsufficientShares);
        }
        let amount = self.reserve.amount_for(self.custody, shares, self.now)?;
        self.custody -= amount;
        self.paid_out += u128::from(amount);
        self.shares[who] -= shares;
        self.reserve.supply_shares -= shares;
        Ok(())
    }

    /// A fill that cost `cost` at `leverage`: the stake comes in, the cost goes out to the venue.
    fn open(&mut self, at_window: usize, cost: u64, lots: u64, leverage_bps: u32) -> Result<(), LeverageError> {
        let t = terms(u128::from(cost), leverage_bps, self.reserve.params.premium_bps);
        let (stake, fronted, premium) = (t.stake_base as u64, t.fronted_base as u64, t.premium_base as u64);
        let liquid_before = self.reserve.liquid_base(self.custody);
        if u128::from(liquid_before) + u128::from(stake) < u128::from(cost) {
            return Err(LeverageError::InsufficientLiquidity);
        }
        let id = self.reserve.next_position_id;
        let expiry = self.now + 300 * (1 + at_window as i64);
        self.reserve.book_front(liquid_before, fronted, premium, &mut self.windows[at_window], id, expiry)?;
        self.reserve.next_position_id += 1;
        self.custody = self.custody + stake - cost;
        self.paid_in += u128::from(stake);
        self.paid_out += u128::from(cost);
        self.positions.push((position(id, self.windows[at_window].market, lots, stake, fronted, premium, expiry), at_window));
        Ok(())
    }

    /// A sale or a redemption: proceeds arrive in custody, then the owner's part leaves now or is left owed.
    fn exit(&mut self, at: usize, ended_as: PositionStatus, lots_sold: u64, proceeds: u64, pay_now: bool) -> Result<(), LeverageError> {
        let (p, at_window) = &mut self.positions[at];
        if p.status != PositionStatus::Live {
            return Err(LeverageError::NotLive);
        }
        self.custody += proceeds;
        self.paid_in += u128::from(proceeds);
        let split = self.reserve.book_exit(p, &mut self.windows[*at_window], ended_as, lots_sold, proceeds, self.now);
        if pay_now {
            self.custody -= split.returned_base;
            self.paid_out += u128::from(split.returned_base);
        } else if split.returned_base > 0 {
            self.reserve.book_owed(p, split.returned_base)?;
        }
        Ok(())
    }

    fn claim(&mut self, at: usize) -> Result<(), LeverageError> {
        let (p, _) = &mut self.positions[at];
        if p.owed_base == 0 {
            return Err(LeverageError::NothingOwed);
        }
        let amount = self.reserve.book_claim(p);
        self.custody -= amount;
        self.paid_out += u128::from(amount);
        Ok(())
    }
}

#[test]
fn randomized_sequences_keep_the_books_equal_to_the_positions() {
    for seed in 1..=SEEDS {
        let mut rng = Rng(seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) | 1);
        let mut w = World {
            reserve: reserve(),
            custody: 0,
            windows: (0..WINDOWS as u8).map(|n| window(n + 1)).collect(),
            positions: Vec::new(),
            shares: [0; PROVIDERS],
            paid_in: 0,
            paid_out: 0,
            now: 0,
        };
        let (mut opened, mut refused, mut losses) = (0usize, 0usize, 0usize);

        for step in 0..OPS_PER_SEED {
            let snapshot = w.clone();
            w.now += rng.range(0, 40) as i64;
            // Mostly a live position, so exits are exercised; sometimes any, so the refusals are too.
            let live: Vec<usize> = w.positions.iter().enumerate().filter(|(_, (p, _))| p.status == PositionStatus::Live).map(|(i, _)| i).collect();
            let pick = if !live.is_empty() && rng.below(5) != 0 {
                live[rng.below(live.len() as u64) as usize]
            } else if w.positions.is_empty() {
                0
            } else {
                rng.below(w.positions.len() as u64) as usize
            };
            let result = match rng.below(100) {
                0..=14 => w.supply(rng.below(PROVIDERS as u64) as usize, rng.range(1, 120_000_000)),
                15..=24 => {
                    let who = rng.below(PROVIDERS as u64) as usize;
                    let held = w.shares[who];
                    w.withdraw(who, rng.range(0, held.max(1)))
                }
                25..=54 => {
                    let lots = rng.range(1_000, 60_000);
                    // A fill between 20¢ and 80¢ a contract, at 1.5x to 3x.
                    let cost = lots * rng.range(200, 800);
                    let r = w.open(rng.below(WINDOWS as u64) as usize, cost, lots, rng.range(15_000, 30_000) as u32);
                    opened += usize::from(r.is_ok());
                    r
                }
                55..=74 if !w.positions.is_empty() => {
                    // A sale of some or all of it, at anything from nothing to a full unit a contract.
                    let lots = w.positions[pick].0.lots.max(1);
                    let sold = if rng.below(2) == 0 { lots } else { rng.range(1, lots) };
                    let proceeds = sold * rng.range(0, 1_000);
                    let ended = if rng.below(2) == 0 { PositionStatus::Closed } else { PositionStatus::KnockedOut };
                    let before = w.positions[pick].0.fronted_base;
                    let r = w.exit(pick, ended, sold, proceeds, rng.below(3) != 0);
                    losses += usize::from(r.is_ok() && sold == lots && proceeds < before);
                    r
                }
                75..=89 if !w.positions.is_empty() => {
                    let lots = w.positions[pick].0.lots;
                    let payout = lots * [0, 500, 1_000][rng.below(3) as usize];
                    let before = w.positions[pick].0.fronted_base;
                    let r = w.exit(pick, PositionStatus::Settled, lots, payout, rng.below(3) != 0);
                    losses += usize::from(r.is_ok() && payout < before);
                    r
                }
                _ if !w.positions.is_empty() => w.claim(pick),
                _ => Ok(()),
            };
            if result.is_err() {
                refused += 1;
                let now = w.now;
                w = snapshot;
                w.now = now;
            }
            w.check(seed, step);
        }
        assert!(opened > 40 && refused > 40 && losses > 0, "seed {seed} exercised every path: {opened} opened, {refused} refused, {losses} under-water exits");

        // Wind down: settle everything, pay every claim, and let the providers out. Nothing may be left behind.
        for at in 0..w.positions.len() {
            if w.positions[at].0.status == PositionStatus::Live {
                let lots = w.positions[at].0.lots;
                w.exit(at, PositionStatus::Settled, lots, lots * 1_000, false).unwrap();
            }
            let _ = w.claim(at);
        }
        w.now += 1_000_000;
        w.check(seed, OPS_PER_SEED);
        assert_eq!((w.reserve.outstanding_base, w.reserve.user_owed_base, w.reserve.open_count()), (0, 0, 0), "seed {seed} wound down");
        for who in 0..PROVIDERS {
            let held = w.shares[who];
            if held > 0 {
                w.withdraw(who, held).unwrap_or_else(|e| panic!("seed {seed}: provider {who} could not leave: {e:?}"));
            }
        }
        assert_eq!(w.reserve.supply_shares, 0, "seed {seed}");
        assert_eq!(w.custody, 0, "seed {seed}: custody is empty once everyone has been paid");
    }
}
