//! Randomized: many matches at once, every operation in any order, some of them nonsense. After every one the
//! arena's three counters must equal the money a real custody account would hold, and must equal the sum of what
//! they claim to count: open pots, players' credits, keys' escrows.

use super::tests::{arena, UNIT};
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

struct Live {
    m: GameMatch,
    agents: [Agent; 2],
    keys: [Pubkey; 2],
}

#[derive(Default)]
struct Counts {
    created: u32,
    refusals: u32,
    finalized: u32,
    forfeited: u32,
    refunded: u32,
    ties: u32,
    agent_picks: u32,
    released: u32,
}

const PLAYERS: usize = 5;

fn run(seed: u64, ops: usize) -> Counts {
    let mut rng = Rng(seed | 1);
    let mut a = arena();
    let players: Vec<Pubkey> = (0..PLAYERS).map(|_| Pubkey::new_unique()).collect();
    let mut credits: Vec<Credit> = (0..PLAYERS).map(|_| Credit::default()).collect();
    let mut live: Vec<Live> = Vec::new();
    // What a real custody token account would hold: pots and escrows in, fills out, payouts in, claims out.
    let mut custody: u128 = 0;
    let mut counts = Counts::default();
    let index_of = |who: &Pubkey, players: &[Pubkey]| players.iter().position(|p| p == who).unwrap();

    let mut now: i64 = 1_000;
    for step in 0..ops {
        // Mostly a second at a time, so a match can be played inside its windows; now and then a jump past every
        // deadline, which is how forfeits, timeouts and expired keys are reached.
        now += if rng.below(40) == 0 { 400 } else { 1 };
        let pick = if live.is_empty() { None } else { Some(live.len() - 1 - rng.below(live.len().min(4) as u64) as usize) };
        // Three times in four the operation is the one the chosen match is waiting for, so matches travel their whole
        // life; the rest of the time it is anything at all, which is where the refusals come from.
        let steered = pick.filter(|_| rng.below(4) != 0).map(|i| match live[i].m.status {
            MatchStatus::Waiting => 2,
            MatchStatus::ActiveUnrevealed => 3,
            MatchStatus::Picking => [4, 5, 5, 5, 5, 5, 8][rng.below(7) as usize],
            MatchStatus::Settling | MatchStatus::Forfeited => 9,
            MatchStatus::Finalized | MatchStatus::Refunded => [0, 9, 10][rng.below(3) as usize],
        });
        match steered.unwrap_or_else(|| rng.below(11)) {
            0 | 1 => {
                let (c, d) = (rng.below(PLAYERS as u64) as usize, rng.below(PLAYERS as u64) as usize);
                let mut m = GameMatch::default();
                let mut id = [0u8; 32];
                id[..8].copy_from_slice(&(step as u64).to_le_bytes());
                match a.book_create(&mut m, id, players[c], players[d], rng.below(4) as u8, [9; 32], 2 + rng.below(4) as u8, 1, now) {
                    Ok(pot) => {
                        custody += u128::from(pot);
                        counts.created += 1;
                        live.push(Live { m, agents: [Agent::default(), Agent::default()], keys: [Pubkey::new_unique(), Pubkey::new_unique()] });
                    }
                    Err(_) => counts.refusals += 1,
                }
            }
            2 => {
                if let Some(i) = pick {
                    let who = if rng.below(5) == 0 { players[rng.below(PLAYERS as u64) as usize] } else { live[i].m.challenger };
                    match a.book_join(&mut live[i].m, &who, now) {
                        Ok(pot) => custody += u128::from(pot),
                        Err(_) => counts.refusals += 1,
                    }
                }
            }
            3 => {
                if let Some(i) = pick {
                    let cards: Vec<Pubkey> = (0..live[i].m.deck_size).map(|_| Pubkey::new_unique()).collect();
                    if a.book_reveal(&mut live[i].m, &cards, now).is_err() {
                        counts.refusals += 1;
                    }
                }
            }
            4 => {
                // A seat names its key and sets the deck's ceiling aside for it.
                if let Some(i) = pick {
                    let seat = rng.below(2) as usize;
                    let l = &mut live[i];
                    let budget = l.m.agent_budget_base().unwrap();
                    match a.book_agent(&mut l.agents[seat], l.keys[seat], 1 + rng.below(2_000) as u32, budget, now) {
                        Ok(brought) => custody += u128::from(brought),
                        Err(_) => counts.refusals += 1,
                    }
                }
            }
            5 | 6 | 7 => {
                if let Some(i) = pick {
                    let seat = rng.below(2) as usize;
                    let unplayed: Vec<u8> = (0..live[i].m.deck_size).filter(|c| !live[i].m.pick(*c, seat).placed).collect();
                    let card = if unplayed.is_empty() || rng.below(6) == 0 { rng.below(6) as u8 } else { unplayed[rng.below(unplayed.len() as u64) as usize] };
                    let stake = if rng.below(8) == 0 { UNIT + rng.below(UNIT) } else { 1 + rng.below(UNIT) };
                    let l = &mut live[i];
                    let who = l.m.player(seat);
                    let by_key = l.agents[seat].escrow_base > 0 && rng.below(2) == 0;
                    match a.pick_guard(&l.m, &who, card, stake, now) {
                        Err(_) => counts.refusals += 1,
                        Ok(s) => {
                            if by_key && a.book_agent_stake(&mut l.agents[seat], &l.keys[seat], stake, now).is_err() {
                                counts.refusals += 1;
                                continue;
                            }
                            let cost = stake - rng.below(stake / 5 + 1);
                            a.book_pick(&mut l.m, s, card, rng.below(2) as u8, cost / 500 + 1, 1_000, cost, stake).unwrap();
                            if by_key {
                                // The stake was already here as escrow: the fill's cost leaves for the venue and the
                                // rest goes back beside what is still set aside.
                                a.book_agent_refund(&mut l.agents[seat], stake - cost).unwrap();
                                custody -= u128::from(cost);
                                counts.agent_picks += 1;
                            }
                            // A pick from the wallet leaves custody where it was: the stake comes in, the cost leaves
                            // for the venue and the rest returns to the wallet, all in one transaction.
                        }
                    }
                }
            }
            8 => {
                if let Some(i) = pick {
                    let l = &mut live[i];
                    let (ci, di) = (index_of(&l.m.creator, &players), index_of(&l.m.challenger, &players));
                    let (mut c0, mut c1) = (std::mem::take(&mut credits[ci]), Credit::default());
                    if ci != di {
                        c1 = std::mem::take(&mut credits[di]);
                    }
                    let before = l.m.status;
                    let creator = l.m.creator;
                    let by = if rng.below(2) == 0 { Some(&creator) } else { None };
                    let outcome = match before {
                        MatchStatus::Waiting => a.book_refund_unjoined(&mut l.m, &mut c0, by, now).map(|_| ()),
                        MatchStatus::ActiveUnrevealed => a.book_refund_unrevealed(&mut l.m, &mut c0, &mut c1, now),
                        _ => a.book_lock(&mut l.m, &mut c0, &mut c1, now).map(|locked| {
                            if matches!(locked, Locked::Forfeited(_)) {
                                counts.forfeited += 1;
                            }
                        }),
                    };
                    if outcome.is_err() {
                        counts.refusals += 1;
                    } else if l.m.status == MatchStatus::Refunded {
                        counts.refunded += 1;
                    }
                    credits[ci] = c0;
                    if ci != di {
                        credits[di] = c1;
                    }
                }
            }
            9 => {
                // Settle one card for both seats, then try to finalize.
                if let Some(i) = pick {
                    let l = &mut live[i];
                    let card = rng.below(u64::from(l.m.deck_size.max(1))) as u8;
                    let (ci, di) = (index_of(&l.m.creator, &players), index_of(&l.m.challenger, &players));
                    if a.settle_guard(&l.m, card).is_ok() {
                        for seat in 0..2 {
                            let rec = *l.m.pick(card, seat);
                            if !rec.placed || rec.settled {
                                continue;
                            }
                            // Win, lose or void: full face, nothing, or half. One match in five settles every card for
                            // exactly what it cost, so both seats end level and the pot has to split.
                            let flat = l.m.match_id[0] % 5 == 0;
                            let payout = if flat { rec.cost_base } else { [rec.lots * rec.lot_base, 0, rec.lots * rec.lot_base / 2][rng.below(3) as usize] };
                            let who = if seat == 0 { ci } else { di };
                            a.book_settle_pick(&mut l.m, card, seat, payout, &mut credits[who]).unwrap();
                            custody += u128::from(payout);
                        }
                        l.m.settled_mask |= 1 << card;
                    } else {
                        counts.refusals += 1;
                    }
                    let mut c0 = std::mem::take(&mut credits[ci]);
                    let mut c1 = if ci != di { std::mem::take(&mut credits[di]) } else { Credit::default() };
                    match a.book_finalize(&mut l.m, &mut c0, &mut c1) {
                        Ok(done) => {
                            counts.finalized += 1;
                            if done.winner.is_none() {
                                counts.ties += 1;
                            }
                        }
                        Err(_) => counts.refusals += 1,
                    }
                    credits[ci] = c0;
                    if ci != di {
                        credits[di] = c1;
                    }
                }
            }
            _ => {
                // A claim, or a key emptied once its match has moved on.
                if rng.below(2) == 0 {
                    let who = rng.below(PLAYERS as u64) as usize;
                    match a.book_claim(&mut credits[who]) {
                        Ok(paid) => custody -= u128::from(paid),
                        Err(_) => counts.refusals += 1,
                    }
                } else if let Some(i) = pick {
                    let seat = rng.below(2) as usize;
                    let l = &mut live[i];
                    let who = index_of(&l.m.player(seat), &players);
                    if l.agents[seat].escrow_base > 0 && Arena::agent_releasable(&l.m, l.agents[seat].expires_at_sec, now) {
                        a.book_agent_release(&mut l.agents[seat], &mut credits[who]).unwrap();
                        counts.released += 1;
                    } else {
                        counts.refusals += 1;
                    }
                }
            }
        }

        assert_eq!(a.total_owed_base(), custody, "seed {seed} step {step}: books {} vs custody {custody}", a.total_owed_base());
        assert_eq!(u128::from(a.credited_base), credits.iter().map(|c| u128::from(c.amount_base)).sum::<u128>(), "seed {seed} step {step}: credits");
        assert_eq!(u128::from(a.agent_escrow_base), live.iter().flat_map(|l| l.agents.iter()).map(|g| u128::from(g.escrow_base)).sum::<u128>(), "seed {seed} step {step}: key escrows");
        let open_pots: u128 = live.iter().map(|l| match l.m.status {
            MatchStatus::Waiting => u128::from(l.m.pot_base),
            MatchStatus::ActiveUnrevealed | MatchStatus::Picking | MatchStatus::Settling | MatchStatus::Forfeited => u128::from(l.m.pot_base) * 2,
            MatchStatus::Finalized | MatchStatus::Refunded => 0,
        }).sum();
        assert_eq!(u128::from(a.escrowed_base), open_pots, "seed {seed} step {step}: pots");
    }
    counts
}

#[test]
fn the_books_equal_custody_after_every_operation_across_seeds() {
    let mut total = Counts::default();
    for seed in 1..=16u64 {
        let c = run(seed * 0x9E37_79B9, 4_000);
        assert!(c.created > 100 && c.refusals > 300, "seed {seed} was too tame: {} created, {} refusals", c.created, c.refusals);
        total.finalized += c.finalized;
        total.forfeited += c.forfeited;
        total.refunded += c.refunded;
        total.ties += c.ties;
        total.agent_picks += c.agent_picks;
        total.released += c.released;
    }
    // Every ending has to be reached, or the identity was only checked on the easy half.
    assert!(total.finalized > 50 && total.forfeited > 20 && total.refunded > 200 && total.ties > 10 && total.agent_picks > 200 && total.released > 100, "endings: {} finalized, {} forfeited, {} refunded, {} ties, {} key picks, {} released", total.finalized, total.forfeited, total.refunded, total.ties, total.agent_picks, total.released);
}
