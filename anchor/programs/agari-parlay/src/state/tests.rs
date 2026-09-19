//! The ticket's deciding order, and randomized sequences over the reserve's balance sheet.
//!
//! The sequences drive the same pure methods the instructions call, against a vault that is only a number, and
//! check after every operation that the counters still say exactly what the tickets say. A refused operation
//! restores the snapshot, as a reverted transaction does. A failure names the seed and the step.

use super::*;
use crate::constants::EXPIRY_SLOTS;
use crate::errors::ParlayError;
use anchor_lang::prelude::Pubkey;

fn params() -> ParlayParams {
    ParlayParams {
        margin_bps: 1_200,
        max_exposure_bps: 6_000,
        correlation_bps: 4_000,
        max_spread_ticks: 0,
        max_legs: 4,
        min_rest_slots: 50,
        min_time_left_sec: 60,
        max_payout_cap_base: 50_000_000,
        max_expiry_locked_base: 120_000_000,
        min_combined_prob_raw: 10_000,
        price_depth_raw: 1_000_000,
    }
}

fn reserve() -> ParlayReserve {
    ParlayReserve {
        admin: Pubkey::default(),
        collateral_mint: Pubkey::default(),
        events_program: Pubkey::default(),
        params: params(),
        user_escrow_base: 0,
        locked_base: 0,
        supply_shares: 0,
        next_parlay_id: 1,
        tickets_open: 0,
        paused: false,
        bump: 0,
        vault_bump: 0,
        expiry_locks: [ExpiryLock::default(); EXPIRY_SLOTS],
    }
}

fn ticket(expiries: &[i64], stake_base: u64, max_payout_base: u64) -> ParlayTicket {
    let legs = expiries
        .iter()
        .enumerate()
        .map(|(i, e)| ParlayLeg { market: Pubkey::new_from_array([i as u8 + 1; 32]), is_up: true, status: LegStatus::Pending, expiry_sec: *e, resolved_at_sec: 0, price_raw: 500_000 })
        .collect::<Vec<_>>();
    ParlayTicket {
        reserve: Pubkey::default(),
        owner: Pubkey::default(),
        parlay_id: 0,
        status: ParlayStatus::Live,
        leg_count: expiries.len() as u8,
        won_count: 0,
        legs,
        opened_at_sec: 0,
        settled_at_sec: 0,
        last_expiry_sec: expiries.iter().copied().max().unwrap_or(0),
        stake_base,
        max_payout_base,
        house_locked_base: max_payout_base - stake_base,
        combined_prob_raw: 250_000,
        claimed_base: 0,
        bump: 0,
    }
}

#[test]
fn legs_are_decided_in_the_order_their_windows_close() {
    let mut t = ticket(&[900, 300, 600], 10, 100);
    assert_eq!(t.next_leg(), Some(1));
    assert_eq!(t.apply_leg(0, LegStatus::Won, 1), Err(ParlayError::LegOutOfOrder));
    assert_eq!(t.apply_leg(1, LegStatus::Won, 1), Ok(None));
    assert_eq!(t.next_leg(), Some(2));
    assert_eq!(t.apply_leg(2, LegStatus::Won, 2), Ok(None));
    assert_eq!(t.apply_leg(0, LegStatus::Won, 3), Ok(Some(Settled::Won)));
    assert_eq!(t.status, ParlayStatus::Won);
    assert_eq!(t.claimable_base(), Ok(100));
}

#[test]
fn legs_sharing_a_boundary_are_decided_lowest_index_first() {
    let mut t = ticket(&[600, 600], 10, 100);
    assert_eq!(t.apply_leg(1, LegStatus::Won, 1), Err(ParlayError::LegOutOfOrder));
    assert_eq!(t.apply_leg(0, LegStatus::Won, 1), Ok(None));
    assert_eq!(t.apply_leg(1, LegStatus::Won, 1), Ok(Some(Settled::Won)));
}

/// The case the ordering exists for: one leg lost and a later one voided. Whoever cranks, the earlier boundary
/// speaks first, so the owner cannot turn a lost ticket into a refund by reaching for the voided leg.
#[test]
fn a_lost_leg_cannot_be_outrun_by_a_later_void() {
    let mut t = ticket(&[300, 600], 10, 100);
    assert_eq!(t.apply_leg(1, LegStatus::Void, 700), Err(ParlayError::LegOutOfOrder));
    assert_eq!(t.status, ParlayStatus::Live);
    assert_eq!(t.apply_leg(0, LegStatus::Lost, 700), Ok(Some(Settled::Lost)));
    assert_eq!(t.claimable_base(), Err(ParlayError::NothingToClaim));
    assert_eq!(t.apply_leg(1, LegStatus::Void, 701), Err(ParlayError::TicketNotLive));
}

#[test]
fn an_earlier_void_refunds_whatever_a_later_leg_did() {
    let mut t = ticket(&[300, 600], 10, 100);
    assert_eq!(t.apply_leg(0, LegStatus::Void, 700), Ok(Some(Settled::Void)));
    assert_eq!(t.claimable_base(), Ok(10));
}

#[test]
fn a_pending_outcome_decides_nothing() {
    let mut t = ticket(&[300, 600], 10, 100);
    assert_eq!(t.apply_leg(0, LegStatus::Pending, 1), Err(ParlayError::LegNotSettled));
    assert_eq!(t.legs[0].status, LegStatus::Pending);
}

#[test]
fn params_outside_the_reserves_bounds_are_refused() {
    assert_eq!(params().validate(), Ok(()));
    for bad in [
        ParlayParams { max_legs: 1, ..params() },
        ParlayParams { max_legs: 5, ..params() },
        ParlayParams { max_exposure_bps: 10_001, ..params() },
        ParlayParams { correlation_bps: 10_001, ..params() },
        ParlayParams { max_payout_cap_base: 0, ..params() },
        ParlayParams { max_expiry_locked_base: 0, ..params() },
        ParlayParams { price_depth_raw: 0, ..params() },
    ] {
        assert_eq!(bad.validate(), Err(ParlayError::BadParams));
    }
}

#[test]
fn a_ticket_locks_each_boundary_once_however_many_legs_share_it() {
    let mut r = reserve();
    let vault = 100_000_000;
    r.supply_shares = vault;
    r.book_open(vault, 2_000_000, 8_000_000, &[600, 600, 900]).unwrap();
    assert_eq!((r.locked_at(600), r.locked_at(900), r.locked_base), (8_000_000, 8_000_000, 8_000_000));
    r.book_settled(Settled::Lost, 2_000_000, 8_000_000, 10_000_000, &[600, 600, 900]).unwrap();
    assert_eq!((r.locked_at(600), r.locked_at(900), r.locked_base, r.user_escrow_base), (0, 0, 0, 0));
}

#[test]
fn the_three_caps_refuse_in_the_references_order() {
    let mut r = reserve();
    assert_eq!(r.check_capacity(0, 1, &[600]), Err(ParlayError::InsufficientLiquidity));
    // 60% of 100 may be promised.
    assert_eq!(r.check_capacity(100_000_000, 60_000_001, &[600]), Err(ParlayError::OverExposure));
    assert_eq!(r.check_capacity(100_000_000, 60_000_000, &[600]), Ok(()));
    r.params.max_expiry_locked_base = 10_000_000;
    assert_eq!(r.check_capacity(100_000_000, 10_000_001, &[600]), Err(ParlayError::OverExpiryCap));
}

#[test]
fn a_thirty_third_boundary_is_refused_and_a_freed_slot_is_reused() {
    let mut r = reserve();
    let vault = 1_000_000_000;
    for i in 0..EXPIRY_SLOTS as i64 {
        r.book_open(vault, 1, 1_000, &[300 * (i + 1)]).unwrap();
    }
    assert_eq!(r.book_open(vault, 1, 1_000, &[999_999]), Err(ParlayError::TooManyExpiries));
    r.book_settled(Settled::Lost, 1, 1_000, 1_001, &[300]).unwrap();
    assert!(r.book_open(vault, 1, 1_000, &[999_999]).is_ok());
    assert_eq!(r.locked_at(999_999), 1_000);
}

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

struct World {
    reserve: ParlayReserve,
    vault: u64,
    shares: [u64; PROVIDERS],
    tickets: Vec<ParlayTicket>,
    paid_in: u128,
    paid_out: u128,
}

impl World {
    /// What the tickets themselves say the reserve owes and has promised.
    fn check(&self, seed: u64, step: usize) {
        let at = format!("seed {seed} step {step}");
        let r = &self.reserve;
        let live = || self.tickets.iter().filter(|t| t.status == ParlayStatus::Live);
        let locked: u64 = live().map(|t| t.house_locked_base).sum();
        let owed: u64 = self
            .tickets
            .iter()
            .map(|t| match t.status {
                ParlayStatus::Live | ParlayStatus::Void => t.stake_base,
                ParlayStatus::Won => t.max_payout_base,
                ParlayStatus::Lost | ParlayStatus::Claimed => 0,
            })
            .sum();
        assert_eq!(r.locked_base, locked, "locked_base, {at}");
        assert_eq!(r.user_escrow_base, owed, "user_escrow_base, {at}");
        assert_eq!(r.tickets_open, live().count() as u64, "tickets_open, {at}");
        // Every promise is covered by money actually in the vault, with no help from saturation.
        assert!(u128::from(self.vault) >= u128::from(owed) + u128::from(locked), "the vault covers escrow and locks, {at}");
        assert_eq!(u128::from(self.vault), self.paid_in - self.paid_out, "conservation, {at}");
        assert_eq!(r.supply_shares, self.shares.iter().sum::<u64>(), "supply_shares, {at}");

        let mut boundaries: Vec<i64> = live().flat_map(|t| t.expiries()).collect();
        boundaries.sort_unstable();
        boundaries.dedup();
        for e in &boundaries {
            let want: u64 = live().filter(|t| t.expiries().contains(e)).map(|t| t.house_locked_base).sum();
            assert_eq!(r.locked_at(*e), want, "locked at {e}, {at}");
            assert!(want <= r.params.max_expiry_locked_base, "per-boundary cap at {e}, {at}");
        }
        let slots: u64 = r.expiry_locks.iter().map(|s| s.locked_base).sum();
        let want: u64 = boundaries.iter().map(|e| r.locked_at(*e)).sum();
        assert_eq!(slots, want, "no slot holds a lock no live ticket explains, {at}");
    }

    fn supply(&mut self, who: usize, amount: u64) -> Result<(), ParlayError> {
        let shares = self.reserve.shares_for(self.vault, amount)?;
        if shares == 0 {
            return Err(ParlayError::ZeroAmount);
        }
        self.vault += amount;
        self.paid_in += u128::from(amount);
        self.shares[who] += shares;
        self.reserve.supply_shares += shares;
        Ok(())
    }

    fn withdraw(&mut self, who: usize, shares: u64) -> Result<(), ParlayError> {
        if shares == 0 || shares > self.shares[who] {
            return Err(ParlayError::InsufficientShares);
        }
        let amount = self.reserve.amount_for(self.vault, shares)?;
        self.vault -= amount;
        self.paid_out += u128::from(amount);
        self.shares[who] -= shares;
        self.reserve.supply_shares -= shares;
        Ok(())
    }

    fn open(&mut self, stake: u64, payout: u64, expiries: &[i64]) -> Result<(), ParlayError> {
        let equity_before = self.reserve.equity_base(self.vault);
        let id = self.reserve.book_open(self.vault, stake, payout - stake, expiries)?;
        let cap = u128::from(equity_before) * u128::from(self.reserve.params.max_exposure_bps) / 10_000;
        assert!(u128::from(self.reserve.locked_base) <= cap, "an open never takes the reserve past its exposure limit");
        self.vault += stake;
        self.paid_in += u128::from(stake);
        let mut t = ticket(expiries, stake, payout);
        t.parlay_id = id;
        self.tickets.push(t);
        Ok(())
    }

    fn resolve(&mut self, at: usize, outcome: LegStatus, now: i64) -> Result<(), ParlayError> {
        let t = &mut self.tickets[at];
        let idx = t.next_leg().ok_or(ParlayError::TicketNotLive)?;
        if let Some(how) = t.apply_leg(idx, outcome, now)? {
            self.reserve.book_settled(how, t.stake_base, t.house_locked_base, t.max_payout_base, &t.expiries())?;
        }
        Ok(())
    }

    fn void_stale(&mut self, at: usize, now: i64) -> Result<(), ParlayError> {
        let t = &mut self.tickets[at];
        if t.status != ParlayStatus::Live {
            return Err(ParlayError::TicketNotLive);
        }
        t.finish(Settled::Void, now);
        self.reserve.book_settled(Settled::Void, t.stake_base, t.house_locked_base, t.max_payout_base, &t.expiries())
    }

    fn claim(&mut self, at: usize) -> Result<(), ParlayError> {
        let t = &mut self.tickets[at];
        let amount = t.claimable_base()?;
        t.status = ParlayStatus::Claimed;
        t.claimed_base = amount;
        self.reserve.book_claim(amount);
        self.vault -= amount;
        self.paid_out += u128::from(amount);
        Ok(())
    }
}

#[test]
fn randomized_sequences_keep_the_books_equal_to_the_tickets() {
    for seed in 1..=SEEDS {
        let mut rng = Rng(seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) | 1);
        let mut w = World { reserve: reserve(), vault: 0, shares: [0; PROVIDERS], tickets: Vec::new(), paid_in: 0, paid_out: 0 };
        let (mut refused, mut opened) = (0usize, 0usize);

        for step in 0..OPS_PER_SEED {
            let snapshot = (w.reserve.clone(), w.vault, w.shares, w.tickets.clone(), w.paid_in, w.paid_out);
            let pick = if w.tickets.is_empty() { 0 } else { rng.below(w.tickets.len() as u64) as usize };
            let result = match rng.below(100) {
                0..=14 => w.supply(rng.below(PROVIDERS as u64) as usize, rng.range(1, 80_000_000)),
                15..=24 => {
                    let who = rng.below(PROVIDERS as u64) as usize;
                    let held = w.shares[who];
                    w.withdraw(who, rng.range(0, held.max(1)))
                }
                25..=54 => {
                    let payout = rng.range(2, 60_000_000);
                    let stake = rng.range(1, payout - 1);
                    let legs = rng.range(2, 4) as usize;
                    // A handful of boundaries, so tickets share them and legs of one ticket collide.
                    let expiries: Vec<i64> = (0..legs).map(|_| 300 * rng.range(1, 40) as i64).collect();
                    let r = w.open(stake, payout, &expiries);
                    opened += usize::from(r.is_ok());
                    r
                }
                55..=84 if !w.tickets.is_empty() => {
                    let outcome = match rng.below(10) {
                        0 => LegStatus::Void,
                        1..=3 => LegStatus::Lost,
                        _ => LegStatus::Won,
                    };
                    w.resolve(pick, outcome, step as i64)
                }
                85..=89 if !w.tickets.is_empty() => w.void_stale(pick, step as i64),
                _ if !w.tickets.is_empty() => w.claim(pick),
                _ => Ok(()),
            };
            if result.is_err() {
                refused += 1;
                (w.reserve, w.vault, w.shares, w.tickets, w.paid_in, w.paid_out) = snapshot;
            }
            w.check(seed, step);
        }
        assert!(opened > 50 && refused > 50, "seed {seed} exercised both paths: {opened} opened, {refused} refused");

        // Wind down: decide every ticket, pay every claim, and let the providers out. Nothing may be left behind.
        for at in 0..w.tickets.len() {
            while w.tickets[at].status == ParlayStatus::Live {
                w.resolve(at, LegStatus::Won, 0).unwrap();
            }
            let _ = w.claim(at);
        }
        w.check(seed, OPS_PER_SEED);
        assert_eq!((w.reserve.locked_base, w.reserve.user_escrow_base, w.reserve.tickets_open), (0, 0, 0), "seed {seed} wound down");
        for who in 0..PROVIDERS {
            let held = w.shares[who];
            if held > 0 {
                w.withdraw(who, held).unwrap_or_else(|e| panic!("seed {seed}: provider {who} could not leave: {e:?}"));
            }
        }
        assert_eq!(w.reserve.supply_shares, 0, "seed {seed}");
        assert_eq!(w.vault, 0, "seed {seed}: the vault is empty once everyone has been paid");
    }
}
