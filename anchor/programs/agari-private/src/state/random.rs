//! Randomized: many owners, many slots, every operation in any order, some of them nonsense. After every one the
//! desk's books must equal the money a real custody account would hold, and every owner's balance must equal what
//! they put in, less what they took out, plus what their bets made or lost.

use super::tests::{desk, UNIT};
use super::*;
use anchor_lang::prelude::Pubkey;

/// xorshift64*: deterministic and dependency-free, so a failing seed reproduces anywhere.
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
}

struct Bet {
    owner: usize,
    slot: Slot,
    charged: u64,
    swept_uncredited: u64,
    credit: KeyMark,
}

#[derive(Default)]
struct Counts {
    charges: u32,
    refusals: u32,
    wins: u32,
    losses: u32,
    refunds: u32,
    credits: u32,
}

fn run(seed: u64, ops: usize) -> Counts {
    let mut rng = Rng(seed | 1);
    let mut d = desk();
    let mut budgets: Vec<Budget> = (0..6).map(|_| Budget::default()).collect();
    let mut bets: Vec<Bet> = Vec::new();
    // What a real custody token account would hold: deposits in, withdrawals out, fills out, payouts in.
    let mut custody: u128 = 0;
    let mut counts = Counts::default();

    for step in 0..ops {
        let now = 1_000 + step as i64;
        match rng.below(9) {
            0 => {
                let (who, amount) = (rng.below(6) as usize, rng.below(30 * UNIT));
                if d.book_deposit(&mut budgets[who], amount).is_ok() {
                    custody += u128::from(amount);
                } else {
                    counts.refusals += 1;
                }
            }
            1 => {
                let who = rng.below(6) as usize;
                budgets[who].allowance_base = rng.below(40 * UNIT);
            }
            2 => {
                let (who, amount) = (rng.below(6) as usize, rng.below(20 * UNIT));
                if d.book_withdraw(&mut budgets[who], amount).is_ok() {
                    custody -= u128::from(amount);
                } else {
                    counts.refusals += 1;
                }
            }
            3 => {
                let (who, amount) = (rng.below(6) as usize, rng.below(12 * UNIT));
                let mut mark = KeyMark::default();
                if d.book_charge(&mut budgets[who], &mut mark, amount).is_ok() {
                    counts.charges += 1;
                    bets.push(Bet { owner: who, slot: Slot::default(), charged: amount, swept_uncredited: 0, credit: KeyMark::default() });
                } else {
                    counts.refusals += 1;
                }
            }
            4 => {
                // Fund: the right amount, or a wrong one the pool may or may not cover.
                if let Some(bet) = pick(&mut rng, &mut bets) {
                    let amount = if rng.below(4) == 0 { rng.below(15 * UNIT) } else { bet.charged };
                    let funded_before = bet.slot.funded_at_sec != 0;
                    match d.book_fund(&mut bet.slot, amount, now) {
                        // A wrong amount that landed is still money the pool really held; track what the slot now carries.
                        Ok(()) => bet.charged = amount,
                        Err(_) => {
                            assert!(funded_before || amount == 0 || d.pool_base < amount);
                            counts.refusals += 1;
                        }
                    }
                }
            }
            5 => {
                if let Some(bet) = pick(&mut rng, &mut bets) {
                    match d.mintable_stake(&bet.slot) {
                        Ok(stake) => {
                            // The fill costs the stake or less; one time in six the engine would report more, and is refused.
                            let cost = if rng.below(6) == 0 { stake + 1 + rng.below(UNIT) } else { stake - rng.below(stake / 10 + 1) };
                            let lots = cost / 600 + 1;
                            if d.book_mint(&mut bet.slot, Pubkey::new_unique(), rng.below(2) as u8, lots, 1_000, cost, now + 300, now).is_ok() {
                                custody -= u128::from(cost);
                            } else {
                                counts.refusals += 1;
                            }
                        }
                        Err(_) => counts.refusals += 1,
                    }
                }
            }
            6 => {
                if let Some(bet) = pick(&mut rng, &mut bets) {
                    // Win, lose or void: a full payout, nothing, or half.
                    let payout = match rng.below(3) {
                        0 => bet.slot.lots * 1_000,
                        1 => 0,
                        _ => bet.slot.lots * 500,
                    };
                    let had = bet.slot.lots;
                    if d.book_settle(&mut bet.slot, payout, now).is_ok() {
                        custody += u128::from(payout);
                        if payout > bet.slot.cost_base {
                            counts.wins += 1;
                        } else {
                            counts.losses += 1;
                        }
                    } else {
                        assert_eq!(had, 0);
                        counts.refusals += 1;
                    }
                }
            }
            7 => {
                if let Some(bet) = pick(&mut rng, &mut bets) {
                    let unminted = bet.slot.minted_at_sec == 0;
                    match d.book_sweep(&mut bet.slot) {
                        Ok(amount) => {
                            bet.swept_uncredited += amount;
                            if unminted {
                                counts.refunds += 1;
                            }
                        }
                        Err(_) => counts.refusals += 1,
                    }
                }
            }
            _ => {
                if let Some(bet) = pick(&mut rng, &mut bets) {
                    // The honest credit, or one that asks for more than was swept.
                    let amount = if rng.below(5) == 0 { bet.swept_uncredited + 1 + rng.below(UNIT) } else { bet.swept_uncredited };
                    let pool_before = d.pool_base;
                    match d.book_credit(&mut budgets[bet.owner], &mut bet.credit, amount) {
                        Ok(()) => {
                            // Even a dishonest desk can only move what the pool really holds.
                            assert!(amount <= pool_before);
                            bet.swept_uncredited = bet.swept_uncredited.saturating_sub(amount);
                            counts.credits += 1;
                        }
                        Err(_) => counts.refusals += 1,
                    }
                }
            }
        }

        // The identity the desk rests on, after every single operation.
        assert_eq!(d.total_owed_base(), custody, "seed {seed} step {step}: books {} vs custody {custody}", d.total_owed_base());
        assert_eq!(u128::from(d.owed_base), budgets.iter().map(|b| u128::from(b.balance_base)).sum::<u128>(), "seed {seed} step {step}: owed");
        assert_eq!(u128::from(d.in_slots_base), bets.iter().map(|b| u128::from(b.slot.balance_base)).sum::<u128>(), "seed {seed} step {step}: in slots");
    }
    counts
}

fn pick<'a>(rng: &mut Rng, bets: &'a mut [Bet]) -> Option<&'a mut Bet> {
    if bets.is_empty() {
        return None;
    }
    // Prefer recent bets, so slots actually travel the whole way instead of the generator scattering across old ones.
    let span = bets.len().min(8) as u64;
    let index = bets.len() - 1 - rng.below(span) as usize;
    bets.get_mut(index)
}

#[test]
fn the_books_equal_custody_after_every_operation_across_seeds() {
    let mut total = Counts::default();
    for seed in 1..=16u64 {
        let c = run(seed * 0x9E37_79B9, 3_000);
        // Every seed has to reach every ending, or the identity was only checked on the easy half.
        assert!(c.charges > 50 && c.refusals > 100 && c.wins > 5 && c.losses > 5 && c.refunds > 0 && c.credits > 5, "seed {seed} was too tame: {} charges, {} refusals, {} wins, {} losses, {} refunds, {} credits", c.charges, c.refusals, c.wins, c.losses, c.refunds, c.credits);
        total.charges += c.charges;
        total.wins += c.wins;
        total.losses += c.losses;
    }
    assert!(total.charges > 1_000 && total.wins > 100 && total.losses > 100);
}
